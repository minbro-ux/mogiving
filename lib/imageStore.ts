import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * 직접 올린(붙여넣은) 상품 사진 저장소. 공유 링크를 다른 기기에서 열어도 사진이 보이게 서버에 둔다.
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY가 있으면 Supabase Storage 비공개 버킷(mogiving-images),
 * 없으면 로컬 개발용 파일(<SHARE_STORE_DIR 또는 .data>/images/<id>)에 저장한다.
 * 버킷은 비공개로 두고, 사진은 항상 /api/image/[id] 라우트를 거쳐 내보낸다.
 */

export const IMAGE_BUCKET = "mogiving-images";
/** 클라이언트가 800px JPEG로 줄여 보내므로 보통 200KB 안팎. 넉넉히 잡되 이미지 호스팅으로 악용되지 않게 제한한다 */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const ID_LENGTH = 16;
export const IMAGE_ID_RE = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`);
const newImageId = () => Array.from(randomBytes(ID_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join("");

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** 내용의 첫 바이트로 이미지 형식을 판별한다 (요청 헤더의 Content-Type은 믿지 않음). 그 밖의 형식·SVG는 null */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export interface ImageStore {
  put(id: string, bytes: Uint8Array, type: ImageType): Promise<void>;
  /** 없으면 null */
  get(id: string): Promise<Uint8Array | null>;
}

/* ------------------------------ Supabase Storage (배포용) ------------------------------ */

export function supabaseImageStore(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch): ImageStore {
  const base = `${url.replace(/\/$/, "")}/storage/v1`;
  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const upload = (id: string, bytes: Uint8Array, type: ImageType) =>
    fetchImpl(`${base}/object/${IMAGE_BUCKET}/${id}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": type, "x-upsert": "false", "Cache-Control": "31536000" },
      body: new Uint8Array(bytes),
      cache: "no-store",
    });

  /** 버킷이 아직 없으면(첫 업로드) 비공개 버킷을 만든다. 이미 있으면(동시 생성) 그대로 진행 */
  const createBucket = async () => {
    const res = await fetchImpl(`${base}/bucket`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ id: IMAGE_BUCKET, name: IMAGE_BUCKET, public: false, file_size_limit: MAX_IMAGE_BYTES, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }),
      cache: "no-store",
    });
    if (!res.ok && !/already exists|Duplicate/i.test(await res.text())) throw new Error(`supabase create bucket ${res.status}`);
  };

  return {
    async put(id, bytes, type) {
      let res = await upload(id, bytes, type);
      if (!res.ok) {
        const text = await res.text();
        if (!/bucket not found/i.test(text)) throw new Error(`supabase image upload ${res.status}`);
        await createBucket();
        res = await upload(id, bytes, type);
        if (!res.ok) throw new Error(`supabase image upload ${res.status}`);
      }
    },
    async get(id) {
      const res = await fetchImpl(`${base}/object/${IMAGE_BUCKET}/${id}`, { headers: auth, cache: "no-store" });
      if (res.status === 400 || res.status === 404) return null;
      if (!res.ok) throw new Error(`supabase image get ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/* ------------------------------ 로컬 파일 (개발용) ------------------------------ */

export function fileImageStore(dir: string): ImageStore {
  return {
    async put(id, bytes) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, id), bytes, { flag: "wx" });
    },
    async get(id) {
      try {
        return new Uint8Array(await readFile(path.join(dir, id)));
      } catch {
        return null;
      }
    },
  };
}

const store: ImageStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseImageStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileImageStore(path.join(process.env.SHARE_STORE_DIR ?? path.join(process.cwd(), ".data"), "images"));

export type SaveImageResult = { ok: true; id: string } | { ok: false; error: "too large" | "not image" };

/** 형식·크기를 확인하고 새 id로 저장한다. 저장소 오류는 throw */
export async function saveImage(bytes: Uint8Array): Promise<SaveImageResult> {
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "too large" };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "not image" };
  const id = newImageId();
  await store.put(id, bytes, type);
  return { ok: true, id };
}

/** 저장된 사진과 형식. 형식을 알 수 없는 내용은 내보내지 않는다 */
export async function loadImage(id: string): Promise<{ bytes: Uint8Array; type: ImageType } | null> {
  if (!IMAGE_ID_RE.test(id)) return null;
  const bytes = await store.get(id);
  const type = bytes && sniffImageType(bytes);
  return bytes && type ? { bytes, type } : null;
}
