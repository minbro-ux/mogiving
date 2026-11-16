"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Gift, Loader2, X } from "lucide-react";
import { type ParsedLink, fetchProductName, fetchProductOptions, linkProduct, parseLink } from "@/lib/crawl";
import { FEE_PERCENT } from "@/lib/fee";
import { clipboardImage, readImage } from "@/lib/image";
import { createFunding } from "@/lib/mock";
import type { Funding, Product } from "@/lib/types";
import { EMPTY_SHIPPING, FeeSummary, FormField, OptionSuggestField, OwnerNameField, PeriodPicker, PriceAccuracyNotice, PriceInput, PurposeFields, optionReady, SafetyNote, ShippingFields, inputClass, purposeDraft, purposeText, shippingStatus, toShipping } from "./FundingForm";
import { BottomSheet, Button, ProductThumb } from "./ui";

/** 링크 칸을 고친 뒤 상품명·옵션을 다시 불러오기까지 기다리는 시간 */
const NAME_FETCH_DELAY_MS = 400;

type Notice = { ok: boolean; text: string } | null;

/** 안내 문구에 쓰는 붙여넣기 단축키 (맥·iOS는 ⌘V) */
function usePasteKey() {
  const [key, setKey] = useState("Ctrl+V");
  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)) setKey("⌘V");
  }, []);
  return key;
}

/**
 * 시트가 열려 있는 동안 Ctrl+V / ⌘V로 붙여넣은 이미지(스크린샷 캡처·[이미지 복사])를 대표 사진으로 받는다.
 * 글자만 붙여넣으면 아무것도 하지 않아 링크·상품명 입력칸의 붙여넣기는 그대로 동작한다
 */
function usePasteImage(onImage: (imageUrl: string) => void, onNotice: (n: Notice) => void) {
  const handlers = useRef({ onImage, onNotice });
  handlers.current = { onImage, onNotice };
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const file = clipboardImage(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      const r = await readImage(file);
      if ("error" in r) return handlers.current.onNotice({ ok: false, text: r.error });
      handlers.current.onImage(r.imageUrl);
      handlers.current.onNotice({ ok: true, text: "붙여넣은 사진을 대표 사진으로 등록했어요" });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}

/**
 * 링크 → 상품 정보 입력 바텀시트. 기다림 없이 바로 열리고, 입력 순서는
 * ① 상품 링크 ② 상품명(링크에서 자동으로 채움) ③ 선물 금액 ④ 대표 사진(캡처 업로드·붙여넣기).
 * 상품명을 못 가져와도 경고 없이 빈 칸으로 두어 바로 입력할 수 있다.
 * 옵션 목록은 백그라운드에서 따로 받아, 찾으면 옵션 입력칸 아래에 누르면 채워지는 칩으로 보여준다.
 * 새 링크마다 입력값을 새로 시작하도록 부모가 key를 링크별로 바꿔 렌더한다.
 */
export function LinkImportSheet({
  link,
  round,
  initialOwnerName = "",
  onClose,
  onCreate,
}: {
  link: ParsedLink | null;
  round?: number;
  /** 다음 회차 펀딩을 열 때 이전 펀딩의 이름을 미리 채운다 */
  initialOwnerName?: string;
  onClose: () => void;
  onCreate: (f: Funding) => void;
}) {
  const [draft, setDraft] = useState<Product | null>(() => (link ? linkProduct(link) : null));
  const [url, setUrl] = useState(link?.url ?? "");
  const [nameLoading, setNameLoading] = useState(false);
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [days, setDays] = useState(7);
  const [option, setOption] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [purpose, setPurpose] = useState(() => purposeDraft(undefined, round));
  const [notice, setNotice] = useState<Notice>(null);
  /** 마지막으로 자동으로 채운 상품명. 상품명 칸이 비었거나 이 값 그대로일 때만 새 링크의 상품명으로 바꾼다 */
  const autoName = useRef("");
  const firstFetch = useRef(true);

  usePasteImage((imageUrl) => setDraft((d) => (d ? { ...d, imageUrl } : d)), setNotice);

  // 링크가 바뀌면 상품명을 가볍게 불러와 빈 칸을 채우고, 옵션 목록도 따로 받아 칩으로 보여준다
  // (처음 열 때는 바로, 링크 칸을 고치면 입력이 멈춘 뒤). 둘 다 실패하면 조용히 직접 입력으로 남는다
  const parsedUrl = parseLink(url);
  const targetUrl = parsedUrl?.url ?? "";
  useEffect(() => {
    if (!targetUrl) return;
    const controller = new AbortController();
    const delay = firstFetch.current ? 0 : NAME_FETCH_DELAY_MS;
    firstFetch.current = false;
    const timer = setTimeout(() => {
      // 이전 링크에서 찾은 옵션 칩은 새 링크와 맞지 않으므로 먼저 지운다 (입력해 둔 옵션 글자는 그대로)
      setDraft((d) => (d?.options ? { ...d, options: undefined } : d));
      fetchProductOptions(targetUrl, controller.signal).then((options) => {
        if (controller.signal.aborted || !options.length) return;
        setDraft((d) => (d ? { ...d, options } : d));
      });
      setNameLoading(true);
      fetchProductName(targetUrl, controller.signal).then((name) => {
        if (controller.signal.aborted) return;
        setNameLoading(false);
        if (!name) return;
        setDraft((d) => {
          if (!d || (d.name && d.name !== autoName.current)) return d;
          autoName.current = name;
          return { ...d, name };
        });
      });
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setNameLoading(false);
    };
  }, [targetUrl]);

  if (!link || !draft) return null;

  const valid = !!ownerName.trim() && draft.name.trim().length > 1 && draft.price >= 1000 && !!parsedUrl && (!option.trim() || optionReady(option, draft.options, true)) && shippingStatus(shipping) !== "partial";
  const set = (patch: Partial<Product>) => setDraft({ ...draft, ...patch });
  const mall = parsedUrl?.mall ?? draft.mall;

  const create = () => {
    if (!parsedUrl) return;
    onCreate(createFunding({ ...draft, url: parsedUrl.url, mall, brand: draft.brand || mall }, { ...purposeText(purpose, round), ownerName, days, round, option, shipping: toShipping(shipping) }));
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="상품 정보를 확인해 주세요"
      footer={
        <Button disabled={!valid} onClick={create}>
          <Gift size={20} /> {round && round > 1 ? `이 상품으로 ${round}탄 펀딩 열기` : "이 상품으로 펀딩 열기"}
        </Button>
      }
    >
      <FormField label="상품 링크" hint={parsedUrl && <span className="text-[12px] text-grey-500">{parsedUrl.mall ?? "기타 쇼핑몰"}</span>}>
        <input value={url} inputMode="url" onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={`${inputClass} !text-[15px]`} />
        {!parsedUrl && <p className="mt-1.5 text-[13px] text-toss-red">올바른 상품 링크를 입력해주세요</p>}
      </FormField>

      <FormField label="상품명" hint={nameLoading && <Loader2 size={14} className="animate-spin text-grey-400" aria-label="상품명 불러오는 중" />}>
        <input
          value={draft.name}
          maxLength={60}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={nameLoading ? "상품명을 불러오고 있어요…" : "예) 아이패드 에어 11 M2 Wi-Fi 128GB"}
          className={inputClass}
        />
      </FormField>

      <FormField label="선물 금액" hint={<span className="text-[12px] text-grey-500">목표 금액 = 선물 금액 + 수수료 {FEE_PERCENT}%</span>}>
        <PriceInput value={draft.price} onChange={(price) => set({ price })} />
        <PriceAccuracyNotice />
        <FeeSummary basePrice={draft.price} />
      </FormField>

      <FormField label="대표 사진" hint={<span className="text-[12px] text-grey-400">선택</span>}>
        <PhotoUpload product={{ ...draft, mall }} onChange={(imageUrl) => set({ imageUrl })} notice={notice} onNotice={setNotice} />
      </FormField>

      <PurposeFields value={purpose} round={round} onChange={setPurpose} />
      <OwnerNameField value={ownerName} onChange={setOwnerName} />
      <OptionSuggestField value={option} onChange={setOption} options={draft.options} />
      <PeriodPicker value={days} onChange={setDays} />
      <ShippingFields value={shipping} onChange={setShipping} />
      <SafetyNote />
    </BottomSheet>
  );
}

/* ------------------------------- 대표 사진 업로드 ------------------------------- */

/** 단일 업로드 박스: 클릭해서 캡처 사진을 고르거나 Ctrl+V로 붙여넣는다. 올리지 않으면 쇼핑몰 기본 이미지 */
function PhotoUpload({ product, onChange, notice, onNotice }: { product: Product; onChange: (imageUrl: string | undefined) => void; notice: Notice; onNotice: (n: Notice) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteKey = usePasteKey();
  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 오도록 비운다
    e.target.value = "";
    if (!file) return;
    const r = await readImage(file);
    if ("error" in r) return onNotice({ ok: false, text: r.error });
    onNotice(null);
    onChange(r.imageUrl);
  };

  return (
    <div>
      {product.imageUrl ? (
        <div className="relative">
          <ProductThumb product={product} size="lg" className="!aspect-[4/3] !rounded-[20px]" />
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button onClick={pick} className="flex items-center gap-1 rounded-full bg-grey-900/70 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
              <Camera size={14} /> 바꾸기
            </button>
            <button
              onClick={() => {
                onNotice(null);
                onChange(undefined);
              }}
              aria-label="사진 지우기"
              className="flex items-center rounded-full bg-grey-900/70 px-2 py-1.5 text-white backdrop-blur"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-dashed border-grey-200 bg-grey-50 px-4 py-7 text-center transition active:bg-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toss-blue"
        >
          <Camera size={24} className="text-grey-400" />
          <span className="text-[15px] font-semibold text-grey-800">상품 화면 캡처 업로드</span>
          <span className="text-[13px] text-grey-500">또는 {pasteKey}로 붙여넣기</span>
          <span className="mt-1 text-[12px] text-grey-400">올리지 않으면 쇼핑몰 기본 이미지로 보여요</span>
        </button>
      )}
      {/* capture 속성을 넣지 않아야 모바일에서 카메라가 아닌 사진 보관함/갤러리가 바로 열린다 */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {notice && (
        <p role="status" className={`mt-2 text-[13px] ${notice.ok ? "text-toss-green" : "text-toss-red"}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
