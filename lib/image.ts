import { linkOrigin } from "./site";

/** 업로드 사진을 긴 변 기준으로 줄여 data URL(JPEG)로 바꾼다. blob: 주소와 달리 해제·새 탭에도 깨지지 않는다 */
export async function fileToDataUrl(file: File, maxSide = 800, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** 직접 올리는 사진 최대 크기 */
export const MAX_IMAGE_MB = 10;

/** 파일 선택·붙여넣기 공통: 이미지인지·크기를 확인하고 data URL로 읽는다 */
export async function readImage(file: File): Promise<{ imageUrl: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "이미지 파일만 올릴 수 있어요" };
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return { error: `${MAX_IMAGE_MB}MB 이하 사진만 올릴 수 있어요` };
  try {
    return { imageUrl: await fileToDataUrl(file) };
  } catch {
    return { error: "사진을 읽지 못했어요. 다른 사진을 골라주세요" };
  }
}

type ClipboardLike = Pick<DataTransfer, "items" | "files"> | null | undefined;

/**
 * 붙여넣기(Ctrl+V / ⌘V) 내용에서 이미지 파일을 꺼낸다. 없으면 null (글자만 붙여넣은 경우).
 * 스크린샷 캡처·브라우저 [이미지 복사]는 items에 image/* 파일로 들어오고, 일부 브라우저는 files에만 담는다
 */
export function clipboardImage(data: ClipboardLike): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return Array.from(data.files ?? []).find((f) => f.type.startsWith("image/")) ?? null;
}

/** 서버 업로드를 기다리는 최대 시간. 넘으면 이 기기에만 사진을 두고 진행한다 */
const UPLOAD_TIMEOUT_MS = 10_000;

/**
 * 직접 올린 사진(data URL)을 서버(/api/image)에 저장하고, 공유 링크에 담을 수 있는 절대 주소를 돌려준다.
 * 실패하면 null (호출하는 쪽은 data URL을 그대로 쓴다)
 */
export async function uploadImage(dataUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const res = await fetch("/api/image", { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob, signal: controller.signal });
    if (!res.ok) return null;
    const { path } = (await res.json()) as { path?: unknown };
    return typeof path === "string" && path.startsWith("/api/image/") ? new URL(path, linkOrigin()).toString() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const imageKey = (fundingId: string) => `mogiving:image:${fundingId}`;

/**
 * 직접 올린 사진(data URL)은 공유 링크에 담기엔 너무 커서, 공동 선물 id로 이 브라우저에 보관해 둔다.
 * 같은 브라우저에서 공유 링크(친구 시점)를 열 때 다시 꺼내 쓴다.
 */
export function rememberUploadedImage(fundingId: string, imageUrl: string | undefined) {
  if (!imageUrl?.startsWith("data:")) return;
  try {
    localStorage.setItem(imageKey(fundingId), imageUrl);
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 */
  }
}

export function recallUploadedImage(fundingId: string) {
  try {
    return localStorage.getItem(imageKey(fundingId)) ?? undefined;
  } catch {
    return undefined;
  }
}
