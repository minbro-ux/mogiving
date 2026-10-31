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

const imageKey = (fundingId: string) => `mogiving:image:${fundingId}`;

/**
 * 직접 올린 사진(data URL)은 공유 링크에 담기엔 너무 커서, 펀딩 id로 이 브라우저에 보관해 둔다.
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
