import { ImageResponse } from "next/og";

export const runtime = "edge";

/** 모기빙 기본 공유 썸네일 (상품 이미지가 없을 때 사용) */
export const alt = "모기빙 MOGIVING";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FILLED = 7;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 96px", background: "#FFFFFF" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, color: "#191F28" }}>MOGIVING</div>
          <div style={{ marginTop: 16, fontSize: 40, color: "#4E5968" }}>Gift together, piece by piece.</div>
          <div style={{ marginTop: 48, display: "flex", alignSelf: "flex-start", padding: "14px 28px", borderRadius: 999, background: "#E8F1FF", color: "#0064FF", fontSize: 30, fontWeight: 700 }}>
            mogiving
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 372, gap: 12 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{ width: 116, height: 116, borderRadius: 28, background: i < FILLED ? "#0064FF" : "#E5E8EB" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
