"use client";

import { useState } from "react";
import { copyText } from "@/lib/share";

/** 주소 원클릭 복사 */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyText(text)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 1500);
      }}
      className="shrink-0 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
    >
      {state === "ok" ? "복사됨 ✓" : state === "fail" ? "실패" : "복사"}
    </button>
  );
}
