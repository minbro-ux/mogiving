import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { IMAGE_BUCKET, fileImageStore, sniffImageType, supabaseImageStore } from "@/lib/imageStore";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("sniffImageType: 내용으로 이미지 형식 판별", () => {
  it("JPEG", () => assert.equal(sniffImageType(JPEG), "image/jpeg"));
  it("PNG", () => assert.equal(sniffImageType(PNG), "image/png"));
  it("WebP", () => assert.equal(sniffImageType(WEBP), "image/webp"));
  it("SVG·HTML은 거절", () => {
    assert.equal(sniffImageType(new Uint8Array(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))), null);
    assert.equal(sniffImageType(new Uint8Array(Buffer.from("<html><script>"))), null);
  });
  it("빈 내용은 거절", () => assert.equal(sniffImageType(new Uint8Array()), null));
});

describe("supabaseImageStore", () => {
  type Call = { url: string; method: string };
  const fake = (responses: Response[]) => {
    const calls: Call[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const r = responses.shift();
      if (!r) throw new Error("unexpected call");
      return r;
    }) as typeof fetch;
    return { calls, impl };
  };

  it("버킷이 없으면 비공개 버킷을 만들고 다시 올린다", async () => {
    const { calls, impl } = fake([
      new Response(JSON.stringify({ statusCode: "404", error: "Bucket not found" }), { status: 400 }),
      new Response("{}", { status: 200 }),
      new Response("{}", { status: 200 }),
    ]);
    await supabaseImageStore("https://x.supabase.co/", "k", impl).put("abc", JPEG, "image/jpeg");
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.url}`),
      [
        `POST https://x.supabase.co/storage/v1/object/${IMAGE_BUCKET}/abc`,
        "POST https://x.supabase.co/storage/v1/bucket",
        `POST https://x.supabase.co/storage/v1/object/${IMAGE_BUCKET}/abc`,
      ],
    );
  });

  it("다른 오류는 그대로 실패", async () => {
    const { impl } = fake([new Response("boom", { status: 500 })]);
    await assert.rejects(supabaseImageStore("https://x.supabase.co", "k", impl).put("abc", JPEG, "image/jpeg"));
  });

  it("없는 사진은 null", async () => {
    const { impl } = fake([new Response(JSON.stringify({ error: "not_found" }), { status: 400 })]);
    assert.equal(await supabaseImageStore("https://x.supabase.co", "k", impl).get("nope"), null);
  });
});

describe("fileImageStore", () => {
  it("저장한 내용을 그대로 읽고, 같은 id는 덮어쓰지 않는다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mogiving-img-"));
    try {
      const s = fileImageStore(dir);
      await s.put("abc", JPEG, "image/jpeg");
      assert.deepEqual(await s.get("abc"), JPEG);
      assert.equal(await s.get("missing"), null);
      await assert.rejects(s.put("abc", PNG, "image/png"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
