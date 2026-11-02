"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Check, ExternalLink, Gift, ImageIcon, Link2, Pencil, RotateCw } from "lucide-react";
import { CRAWL_ERROR_TEXT, type CrawlResult, type ParsedLink, crawlProduct, parseLink } from "@/lib/crawl";
import { won } from "@/lib/format";
import { fileToDataUrl } from "@/lib/image";
import { createFunding } from "@/lib/mock";
import type { Funding, Product } from "@/lib/types";
import { EMPTY_SHIPPING, FormField, OptionField, PeriodPicker, PriceInput, SafetyNote, ShippingFields, inputClass, shippingStatus, toShipping } from "./FundingForm";
import { Badge, BottomSheet, Button, ProductThumb } from "./ui";

/** 사진을 못 가져왔을 때 고를 수 있는 기본 대표 이미지 */
const DEFAULT_IMAGES: Pick<Product, "emoji" | "bg">[] = [
  { emoji: "🎁", bg: "#EEF3FF" },
  { emoji: "👜", bg: "#F6EFEA" },
  { emoji: "👟", bg: "#F1F1F1" },
  { emoji: "💍", bg: "#EFF4FA" },
  { emoji: "⌚", bg: "#EEF0F4" },
  { emoji: "🧴", bg: "#F4EFE8" },
  { emoji: "🎧", bg: "#EEF1F5" },
  { emoji: "🕶️", bg: "#F2F0EC" },
];
const MAX_IMAGE_MB = 10;

/**
 * 링크 → 상품 정보 바텀시트
 * - 자동 모드: 크롤링 성공. 요약 카드로 보여주고 '수정'으로 상품명·금액 미세 조정
 * - 수동 모드: 403·타임아웃·파싱 실패 시 자동 전환. 링크·상품명·금액·대표 사진을 직접 입력
 */
export function LinkImportSheet({
  link,
  prefetched,
  round,
  onClose,
  onCreate,
}: {
  link: ParsedLink | null;
  /** 입력창 미리보기에서 이미 불러온 결과. 같은 링크면 다시 크롤링하지 않는다 */
  prefetched?: CrawlResult | null;
  round?: number;
  onClose: () => void;
  onCreate: (f: Funding) => void;
}) {
  const [target, setTarget] = useState<ParsedLink | null>(link);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [draft, setDraft] = useState<Product | null>(null);
  const [url, setUrl] = useState(link?.url ?? "");
  const [days, setDays] = useState(7);
  const [option, setOption] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const prefetchedRef = useRef(prefetched);
  prefetchedRef.current = prefetched;

  // 새 링크가 들어오면 이전 상품 입력값을 비우고, 사용자가 넣은 원래 URL을 링크 칸에 바로 채운다
  useEffect(() => {
    setTarget(link);
    setResult(null);
    setDraft(null);
    setUrl(link?.url ?? "");
    setOption("");
    setShipping(EMPTY_SHIPPING);
  }, [link]);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setResult(null);
    // 미리보기 결과는 처음 한 번만 재사용하고, '다시 시도'는 항상 새로 불러온다
    const cached = prefetchedRef.current?.product.url === target.url ? prefetchedRef.current : null;
    prefetchedRef.current = null;
    (cached ? Promise.resolve(cached) : crawlProduct(target, controller.signal)).then((r) => {
      if (controller.signal.aborted) return;
      setResult(r);
      // 다시 시도가 또 실패해도 사용자가 이미 입력한 상품명·가격·사진은 지우지 않는다
      setDraft((prev) =>
        r.ok || !prev
          ? r.product
          : {
              ...r.product,
              name: r.product.name || prev.name,
              price: r.product.price || prev.price,
              ...(r.product.imageUrl ? {} : { imageUrl: prev.imageUrl, emoji: prev.emoji, bg: prev.bg }),
            },
      );
      setUrl(target.url);
    });
    // 시트를 닫거나 다시 시도하면 진행 중인 크롤링 요청을 끊는다
    return () => controller.abort();
  }, [target]);

  if (!link) return null;

  if (!result || !draft)
    return (
      <BottomSheet open onClose={onClose} title="상품 정보를 불러오고 있어요" description={target?.mall ?? "쇼핑몰"}>
        <div className="mt-4 animate-pulse pb-4">
          <div className="aspect-[4/3] w-full rounded-[24px] bg-grey-100" />
          <div className="mt-5 h-4 w-1/3 rounded bg-grey-100" />
          <div className="mt-3 h-5 w-4/5 rounded bg-grey-100" />
          <div className="mt-3 h-6 w-2/5 rounded bg-grey-100" />
        </div>
      </BottomSheet>
    );

  const manual = !result.ok;
  const parsedUrl = parseLink(url);
  const valid = draft.name.trim().length > 1 && draft.price >= 1000 && !!parsedUrl && shippingStatus(shipping) !== "partial";
  const set = (patch: Partial<Product>) => setDraft({ ...draft, ...patch });

  const create = () => {
    if (!parsedUrl) return;
    const mall = parsedUrl.mall ?? draft.mall;
    onCreate(createFunding({ ...draft, url: parsedUrl.url, mall, brand: draft.brand || mall }, { days, round, option, shipping: toShipping(shipping) }));
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={manual ? "상품 정보를 직접 입력해 주세요" : "이 상품이 맞나요?"}
      description={manual ? undefined : "가져온 정보가 다르면 바로 수정할 수 있어요."}
      footer={
        <Button disabled={!valid} onClick={create}>
          <Gift size={20} /> {round && round > 1 ? `이 상품으로 ${round}탄 펀딩 열기` : "이 상품으로 펀딩 열기"}
        </Button>
      }
    >
      {result.ok ? (
        <>
          <ImagePicker product={draft} onChange={set} />
          <div className="mt-4 flex items-center gap-2">
            <Badge tone="green">자동 입력됨</Badge>
            <a href={result.product.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-[13px] text-grey-500">
              <span className="shrink-0 font-semibold text-grey-700">{draft.mall}</span>
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
              <ExternalLink size={12} className="shrink-0" />
            </a>
          </div>
          <AutoFilledFields draft={draft} original={result.product} onChange={set} />
        </>
      ) : (
        <>
          <CrawlFailNotice
            code={result.error.code}
            status={result.error.status}
            onRetry={() => setTarget(parsedUrl ?? { ...link })}
          />

          <FormField label="상품 링크" hint={parsedUrl && <span className="text-[12px] text-grey-500">{parsedUrl.mall ?? "기타 쇼핑몰"}</span>}>
            <input value={url} inputMode="url" onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={`${inputClass} !text-[15px]`} />
            {!parsedUrl && <p className="mt-1.5 text-[13px] text-toss-red">올바른 상품 링크를 입력해주세요</p>}
          </FormField>
          <FormField label="상품명">
            <input
              value={draft.name}
              maxLength={60}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="예) 아이패드 에어 11 M2 Wi-Fi 128GB"
              className={inputClass}
            />
          </FormField>
          <FormField label="목표 금액">
            <PriceInput value={draft.price} onChange={(price) => set({ price })} />
            <p className="mt-1.5 text-[12px] text-grey-500">쇼핑몰 판매가 또는 희망 가격을 입력해 주세요</p>
          </FormField>
          <FormField label="대표 사진">
            <ImagePicker product={draft} onChange={set} className="!mt-0" />
          </FormField>
        </>
      )}

      <OptionField value={option} onChange={setOption} />
      <PeriodPicker value={days} onChange={setDays} />
      <ShippingFields value={shipping} onChange={setShipping} />
      <SafetyNote />
    </BottomSheet>
  );
}

/* ------------------------------ 크롤링 실패 안내 ------------------------------ */

function CrawlFailNotice({ code, status, onRetry }: { code: keyof typeof CRAWL_ERROR_TEXT; status?: number; onRetry: () => void }) {
  // 차단·무응답은 대부분 쇼핑몰 보안 정책(봇 차단) 때문
  const security = code === "blocked" || code === "timeout";
  return (
    <div className="mt-4 rounded-2xl bg-toss-orange-light p-4">
      <p className="flex items-start gap-2 text-[15px] font-bold leading-snug text-grey-900">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-toss-orange" />
        {security ? "보안 정책으로 정보를 자동으로 불러오지 못했어요." : "정보를 자동으로 불러오지 못했어요."} 상품명과 금액을 입력해 주세요.
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2 pl-[26px] text-[13px] text-grey-600">
        <span>
          {CRAWL_ERROR_TEXT[code]}
          {status ? ` (${status})` : ""}
        </span>
        <button onClick={onRetry} className="flex shrink-0 items-center gap-1 font-semibold text-grey-700">
          <RotateCw size={13} /> 다시 시도
        </button>
      </div>
    </div>
  );
}

/* --------------------------- 자동 입력값 확인 & 수정 --------------------------- */

function AutoFilledFields({ draft, original, onChange }: { draft: Product; original: Product; onChange: (p: Partial<Product>) => void }) {
  const [editing, setEditing] = useState(false);
  const priceChanged = draft.price !== original.price;
  const canFinish = draft.name.trim().length > 1 && draft.price >= 1000;

  if (!editing)
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-grey-200 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-grey-500">{draft.brand || draft.mall}</p>
          <p className="mt-0.5 text-[16px] font-semibold leading-snug text-grey-900">{draft.name}</p>
          <p className="mt-1.5 text-[18px] font-bold text-grey-900">{won(draft.price)}</p>
          {priceChanged && <p className="mt-0.5 text-[12px] text-toss-orange">쇼핑몰 가격 {won(original.price)}에서 수정했어요</p>}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-grey-100 px-2.5 py-1.5 text-[13px] font-semibold text-grey-700 active:bg-grey-200"
        >
          <Pencil size={13} /> 수정
        </button>
      </div>
    );

  return (
    <>
      <FormField
        label="상품명"
        hint={
          <button
            disabled={!canFinish}
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-[13px] font-semibold text-toss-blue disabled:text-grey-300"
          >
            <Check size={14} /> 수정 완료
          </button>
        }
      >
        <input value={draft.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </FormField>
      <FormField
        label="목표 금액"
        hint={
          priceChanged && (
            <button onClick={() => onChange({ price: original.price })} className="text-[13px] font-semibold text-grey-500">
              쇼핑몰 가격으로 되돌리기
            </button>
          )
        }
      >
        <PriceInput value={draft.price} onChange={(price) => onChange({ price })} />
      </FormField>
    </>
  );
}

/* ------------------------------- 대표 사진 선택 ------------------------------- */

function ImagePicker({
  product,
  onChange,
  defaultOpen = false,
  className = "",
}: {
  product: Product;
  onChange: (p: Partial<Product>) => void;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 크롤링이 이미지를 못 가져왔거나 잘못 가져와도 바로 고칠 수 있도록 주소 입력칸은 항상 열어 둔다
  const [imageUrlInput, setImageUrlInput] = useState(product.imageUrl?.startsWith("http") ? product.imageUrl : "");

  const applyImageUrl = (raw: string) => {
    setImageUrlInput(raw);
    const v = raw.trim();
    if (!v) return setError(null);
    try {
      const u = new URL(v.startsWith("//") ? `https:${v}` : v);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      setError(null);
      replaceImage({ imageUrl: u.toString() });
    } catch {
      setError("http(s)로 시작하는 이미지 주소를 입력해주세요");
    }
  };

  const replaceImage = (patch: Partial<Product>) => onChange(patch);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("이미지 파일만 올릴 수 있어요");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`${MAX_IMAGE_MB}MB 이하 사진만 올릴 수 있어요`);
    setError(null);
    try {
      // blob: 주소는 탭·화면이 바뀌면 깨질 수 있어 data URL로 저장
      replaceImage({ imageUrl: await fileToDataUrl(file) });
      setImageUrlInput("");
    } catch {
      setError("사진을 읽지 못했어요. 다른 사진을 골라주세요");
    }
  };

  return (
    <div className={`mt-4 ${className}`}>
      <div className="relative">
        <ProductThumb product={product} size="lg" className="!aspect-[4/3] !rounded-[24px] !text-[80px]" />
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full bg-grey-900/70 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur"
          >
            <ImageIcon size={14} /> 기본 이미지
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {DEFAULT_IMAGES.map((d) => {
            const on = !product.imageUrl && product.emoji === d.emoji;
            return (
              <button
                key={d.emoji}
                aria-label={`기본 이미지 ${d.emoji}`}
                onClick={() => replaceImage({ ...d, imageUrl: undefined })}
                className={`flex aspect-square items-center justify-center rounded-xl text-[20px] transition ${on ? "ring-2 ring-toss-blue" : ""}`}
                style={{ backgroundColor: d.bg }}
              >
                {d.emoji}
              </button>
            );
          })}
        </div>
      )}
      {/* 자동 수집이 차단돼도 직접 고칠 수 있게 '사진 업로드'와 '이미지 주소 입력'은 항상 열려 있다 */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-grey-100 px-3 py-2.5">
          <Link2 size={16} className="shrink-0 text-grey-400" />
          <input
            value={imageUrlInput}
            inputMode="url"
            onChange={(e) => applyImageUrl(e.target.value)}
            placeholder="이미지 주소 직접 입력 (https://…)"
            aria-label="이미지 주소 직접 입력"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-grey-900 outline-none placeholder:text-grey-400"
          />
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-grey-100 px-3 py-2.5 text-[13px] font-semibold text-grey-700 active:bg-grey-200"
        >
          <Camera size={15} /> 사진 업로드
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-toss-red">{error}</p>}
    </div>
  );
}
