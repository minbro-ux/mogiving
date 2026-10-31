"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Product } from "@/lib/types";

/* ---------------------------------- Button --------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "weak" | "danger";
  size?: "lg" | "md" | "sm";
  full?: boolean;
  loading?: boolean;
};

const VARIANT = {
  primary: "bg-toss-blue text-white active:bg-toss-blue-dark disabled:bg-toss-blue/30",
  secondary: "bg-grey-100 text-grey-700 active:bg-grey-200 disabled:text-grey-400",
  weak: "bg-toss-blue-light text-toss-blue active:bg-[#D6E6FF] disabled:opacity-40",
  danger: "bg-toss-red text-white active:brightness-95 disabled:opacity-40",
};
const SIZE = {
  lg: "h-14 rounded-2xl text-[17px]",
  md: "h-12 rounded-xl text-[15px]",
  sm: "h-9 rounded-[10px] px-3 text-[13px]",
};

export function Button({ variant = "primary", size = "lg", full = true, loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${VARIANT[variant]} ${SIZE[size]} ${full ? "w-full" : ""} inline-flex items-center justify-center gap-1.5 font-semibold transition active:scale-[0.98] disabled:active:scale-100 ${className}`}
    >
      {loading ? <Spinner className={variant === "primary" ? "border-white/40 border-t-white" : ""} /> : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-grey-200 border-t-toss-blue ${className}`} />;
}

/* ------------------------------ Fixed bottom CTA ----------------------------- */

export function BottomCTA({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2">
      <div className="h-6 bg-gradient-to-t from-white to-transparent" />
      <div className="pointer-events-auto bg-white px-5 pb-safe">{children}</div>
    </div>
  );
}

/* -------------------------------- Bottom sheet ------------------------------- */

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  hideClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={onClose} />
      <div className="absolute bottom-0 left-1/2 flex max-h-[90dvh] w-full max-w-[430px] -translate-x-1/2 flex-col">
        <div className="flex animate-sheet-up flex-col overflow-hidden rounded-t-[28px] bg-white">
          <div className="flex justify-center pb-1 pt-3">
            <span className="h-1 w-10 rounded-full bg-grey-200" />
          </div>
          {(title || !hideClose) && (
            <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-3">
              <div>
                {title && <h2 className="text-[20px] font-bold leading-snug text-grey-900">{title}</h2>}
                {description && <p className="mt-1.5 text-[15px] leading-relaxed text-grey-600">{description}</p>}
              </div>
              {!hideClose && (
                <button onClick={onClose} className="-mr-1 rounded-full p-1 text-grey-400 active:bg-grey-100" aria-label="닫기">
                  <X size={22} />
                </button>
              )}
            </div>
          )}
          <div className="overflow-y-auto px-6 pb-4">{children}</div>
          {footer && <div className="px-5 pb-safe pt-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Progress bar ------------------------------- */

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "orange" }) {
  const color = { blue: "bg-toss-blue", green: "bg-toss-green", orange: "bg-toss-orange" }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-grey-100">
      <div className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

/* --------------------------------- Piece grid -------------------------------- */

/** 목표 금액을 N조각으로 나눈 격자: 모인 조각 / 지금 고른 조각 / 남은 조각 */
export function PieceGrid({ total, filled, selected = 0 }: { total: number; filled: number; selected?: number }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-[4px] transition-colors duration-300 ${
            i < filled ? "bg-toss-blue" : i < filled + selected ? "bg-toss-blue/35 ring-1 ring-inset ring-toss-blue" : "bg-grey-200/70"
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------- Product image ------------------------------- */

export function ProductThumb({ product, size = "md", className = "" }: { product: Product; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const S = {
    sm: "h-12 w-12 rounded-xl text-2xl",
    md: "h-16 w-16 rounded-2xl text-3xl",
    lg: "aspect-square w-full rounded-2xl text-6xl",
    xl: "aspect-square w-full rounded-[28px] text-[96px]",
  }[size];
  return (
    <div className={`flex shrink-0 select-none items-center justify-center overflow-hidden ${S} ${className}`} style={{ backgroundColor: product.bg }}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <span className="drop-shadow-sm">{product.emoji}</span>
      )}
    </div>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

export function Badge({ tone = "blue", children }: { tone?: "blue" | "grey" | "red" | "green" | "orange"; children: React.ReactNode }) {
  const T = {
    blue: "bg-toss-blue-light text-toss-blue",
    grey: "bg-grey-100 text-grey-600",
    red: "bg-toss-red-light text-toss-red",
    green: "bg-toss-green-light text-toss-green",
    orange: "bg-toss-orange-light text-toss-orange",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[12px] font-semibold ${T}`}>{children}</span>;
}

/* -------------------------------- Segmented -------------------------------- */

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="flex rounded-xl bg-grey-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-[10px] py-2 text-[14px] font-semibold transition ${
            value === o.value ? "bg-white text-grey-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-grey-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- Switch ---------------------------------- */

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${checked ? "bg-toss-blue" : "bg-grey-300"}`}
    >
      <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[23px]" : "left-[3px]"}`} />
    </button>
  );
}

/* ---------------------------------- Option row ---------------------------------- */

export function OptionRow({
  icon,
  title,
  description,
  right,
  onClick,
  selected,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-toss-blue bg-toss-blue-light/50" : "border-grey-200 bg-white active:bg-grey-50"
      }`}
    >
      {icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grey-100">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold text-grey-900">{title}</div>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-grey-500">{description}</div>}
      </div>
      {right}
    </button>
  );
}

/* ---------------------------------- Toast ---------------------------------- */

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-40 left-1/2 z-[60] w-[calc(100%-40px)] -translate-x-1/2 max-w-[390px] animate-toast-in rounded-2xl bg-grey-800/95 px-5 py-3.5 text-center text-[15px] font-medium text-white shadow-lg">
      {message}
    </div>
  );
}
