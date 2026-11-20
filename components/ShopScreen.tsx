"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Gift, Link2, PackageCheck, Search, Sparkles, Star } from "lucide-react";
import { CATEGORIES, PRODUCTS, createFunding } from "@/lib/mock";
import { firstAvailableOption } from "@/lib/options";
import { type ParsedLink, linkKey, parseLinkInput } from "@/lib/crawl";
import { discountRate, won } from "@/lib/format";
import type { Funding, Product } from "@/lib/types";
import { EMPTY_SHIPPING, FeeSummary, OptionField, OwnerNameField, PeriodPicker, PurposeFields, optionReady, SafetyNote, ShippingFields, purposeDraft, purposeText, shippingStatus, toShipping } from "./FundingForm";
import { LinkImportSheet } from "./LinkImportSheet";
import { Badge, BottomSheet, Button, ProductThumb } from "./ui";
import { WishRequestSheet } from "./WishRequestSheet";

export function ShopScreen({ onCreate, onBack, onToast }: { onCreate: (f: Funding) => void; onBack?: () => void; onToast: (msg: string) => void }) {
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [importUrl, setImportUrl] = useState<ParsedLink | null>(null);
  const [wishOpen, setWishOpen] = useState(false);

  const list = useMemo(
    () =>
      PRODUCTS.filter((p) => category === "전체" || p.category === category).filter(
        (p) => !query || `${p.brand} ${p.name}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );

  return (
    <div className="min-h-dvh bg-white pb-10">
      {/* 상단 내비게이션 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-white/95 px-2 backdrop-blur">
        {onBack ? (
          <button onClick={onBack} className="rounded-full p-2 text-grey-800 active:bg-grey-100" aria-label="뒤로">
            <ChevronLeft size={26} />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <h1 className="text-[18px] font-bold text-grey-900">모기빙</h1>
        <Badge tone="blue">공동 선물</Badge>
      </header>

      {/* 1. 상품 링크로 위시리스트 만들기 */}
      <LinkImportSection
        onImport={setImportUrl}
      />

      {/* 역발상 진입: 축하받을 친구에게 위시리스트 요청 */}
      <section className="px-5 pt-3">
        <button
          onClick={() => setWishOpen(true)}
          className="flex w-full items-center gap-3.5 rounded-[24px] border border-grey-200 p-4 text-left transition active:scale-[0.99] active:bg-grey-50"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF0F3] text-[24px]">💌</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-grey-900">축하받을 친구에게 위시리스트 요청하기</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-grey-500">
              이사, 결혼, 생일 축하 선물 고민 끝! 친구에게 원하는 선물 링크를 요청해보세요
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-grey-400" />
        </button>
      </section>

      {/* 진행 방식 안내 */}
      <section className="px-5 pt-4">
        <ol className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <Link2 size={18} />, t: "선물 등록" },
            { icon: <Gift size={18} />, t: "친구들과 모으기" },
            { icon: <PackageCheck size={18} />, t: "100% 완성 시 실물 배송" },
          ].map((s, i) => (
            <li key={s.t} className="rounded-2xl bg-grey-50 px-2 py-3">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-toss-blue">{s.icon}</div>
              <p className="text-[12px] font-semibold text-grey-700">
                {i + 1}. {s.t}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-7 h-3 bg-grey-50" />

      {/* 2. 운영자 추천 큐레이션 */}
      <section className="pt-7">
        <div className="px-5">
          <p className="flex items-center gap-1 text-[13px] font-semibold text-toss-blue">
            <Sparkles size={14} /> 모기빙 MD 큐레이션
          </p>
          <h2 className="mt-1 text-[20px] font-bold text-grey-900">선물하기 좋은 상품</h2>
          <label className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-grey-100 px-3.5">
            <Search size={18} className="text-grey-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="추천 상품 검색"
              className="flex-1 bg-transparent text-[15px] text-grey-900 outline-none placeholder:text-grey-400"
            />
          </label>
        </div>
        <div className="no-scrollbar sticky top-14 z-10 flex gap-2 overflow-x-auto bg-white px-5 py-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition ${
                category === c ? "bg-grey-900 text-white" : "bg-grey-100 text-grey-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="px-5 pt-2">
          {list.length === 0 ? (
            <p className="py-16 text-center text-[15px] text-grey-500">검색 결과가 없어요</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => setPicked(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CuratedSheet
        // 상품을 바꿔 열면 이전 상품에서 고른 옵션 등이 남지 않게 새로 만든다
        key={picked?.id ?? "none"}
        product={picked}
        onClose={() => setPicked(null)}
        onCreate={(f) => {
          setPicked(null);
          onCreate(f);
        }}
      />
      <WishRequestSheet open={wishOpen} onClose={() => setWishOpen(false)} onCopied={onToast} />
      <LinkImportSheet
        // 새 링크마다 입력값을 새로 시작한다
        key={importUrl ? linkKey(importUrl) : "none"}
        link={importUrl}
        onClose={() => setImportUrl(null)}
        onCreate={(f) => {
          setImportUrl(null);
          onCreate(f);
        }}
      />
    </div>
  );
}

/* -------------------------- 링크 입력 섹션 (상단) -------------------------- */

type OnImport = (l: ParsedLink) => void;

function LinkImportSection({ onImport }: { onImport: OnImport }) {
  return (
    <section className="px-5 pt-2">
      <div className="rounded-[24px] bg-toss-blue-light p-5">
        <p className="text-[20px] font-bold leading-snug text-grey-900">
          상품 링크(URL)로
          <br />
          위시리스트 만들기
        </p>
        <p className="mt-1.5 text-[14px] text-grey-600">쿠팡, 스마트스토어, 29CM, 카카오 선물하기 등 상품 링크를 붙여넣으세요</p>
        <LinkInputForm onImport={onImport} />
      </div>
    </section>
  );
}

/** 타이핑 도중 "https://cou" 같은 미완성 주소로 넘어가지 않도록, 도메인(.com 등)과 경로까지 들어간 주소만 붙여넣기 즉시 연다 */
function looksComplete(url: string) {
  return /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}\/\S+$/i.test(url.trim());
}

/**
 * 상품 링크 입력 + 붙여넣기 (메인 섹션과 2탄 선물 위시 시트에서 공용)
 * 주소만 넣어도, 쇼핑몰 앱의 [공유하기 → 복사] 글을 통째로 붙여넣어도 된다 (lib/shareText.ts가 링크·쇼핑몰·상품명·가격을 나눔).
 * 링크를 붙여넣으면 기다리지 않고 바로 상품 입력 시트를 연다. 상품명은 시트에서 가볍게 불러와 채운다.
 */
function LinkInputForm({ onImport }: { onImport: OnImport }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (raw = value) => {
    const link = parseLinkInput(raw);
    if (!link) {
      setError("상품 링크를 찾지 못했어요. 링크가 들어 있는지 확인해 주세요");
      return;
    }
    setError(null);
    onImport(link);
  };

  /** 붙여넣은 내용에 완성된 상품 링크가 있으면 바로 연다 */
  const openIfLink = (text: string) => {
    const link = parseLinkInput(text);
    if (link && looksComplete(link.url)) onImport(link);
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      setValue(text);
      setError(null);
      openIfLink(text);
    } catch {
      setError("클립보드에 접근할 수 없어요. 직접 붙여넣어 주세요");
    }
  };

  // 공유 글처럼 여러 줄이거나 길면 펼쳐서 보여준다
  const multiline = value.includes("\n") || value.length > 60;

  return (
    <>
      <div
        className={`mt-4 flex items-start gap-2 rounded-2xl bg-white py-1.5 pl-3.5 pr-1.5 ring-2 transition ${
          error ? "ring-toss-red" : "ring-transparent focus-within:ring-toss-blue"
        }`}
      >
        <Link2 size={18} className="mt-[11px] shrink-0 text-grey-400" />
        <textarea
          value={value}
          rows={multiline ? 4 : 1}
          onPaste={(e) => openIfLink(e.clipboardData.getData("text"))}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            // Enter는 가져오기, Shift+Enter는 줄바꿈 (한글 조합 중 Enter는 무시)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="상품 링크 또는 쇼핑몰에서 복사한 내용을 붙여넣으세요"
          aria-label="상품 링크 또는 쇼핑몰 공유 내용"
          className="min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-grey-900 outline-none placeholder:text-grey-400"
        />
        {!value && (
          <button onClick={paste} className="h-10 shrink-0 px-2 text-[13px] font-semibold text-grey-500">
            붙여넣기
          </button>
        )}
        <Button size="sm" full={false} onClick={() => submit()} disabled={!value.trim()} className="h-10 px-4 text-[14px]">
          가져오기
        </Button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1 text-[13px] text-toss-red">
          <AlertCircle size={14} /> {error}
        </p>
      )}
    </>
  );
}

/* ------------------------ 다음 선물 위시(2탄) 만들기 바텀시트 ------------------------ */

/** 1차 선물 완성 후: 링크 입력 → 상품 확인(LinkImportSheet) 순서로 다음 회차 선물 위시 생성 */
export function NextWishSheet({
  open,
  round,
  ownerName,
  onClose,
  onCreate,
}: {
  open: boolean;
  round: number;
  ownerName: string;
  onClose: () => void;
  onCreate: (f: Funding) => void;
}) {
  const [link, setLink] = useState<ParsedLink | null>(null);

  useEffect(() => {
    if (open) setLink(null);
  }, [open]);

  if (!open) return null;
  if (link) return <LinkImportSheet key={linkKey(link)} link={link} round={round} initialOwnerName={ownerName} onClose={onClose} onCreate={onCreate} />;

  return (
    <BottomSheet open onClose={onClose} title={`다음 선물 위시 만들기 · ${round}탄`} description="갖고 싶은 다음 선물의 상품 링크를 붙여넣으세요.">
      <div className="mb-4 mt-1 rounded-[20px] bg-toss-blue-light p-4 pt-0.5">
        <LinkInputForm
          onImport={setLink}
        />
      </div>
    </BottomSheet>
  );
}

/* ------------------------- 추천 상품 카드 & 바텀시트 ------------------------- */

function ProductCard({ product: p, onClick }: { product: Product; onClick: () => void }) {
  const rate = discountRate(p.price, p.originalPrice);
  return (
    <button onClick={onClick} className="text-left transition active:scale-[0.98]">
      <div className="relative">
        <ProductThumb product={p} size="lg" />
        <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-grey-600">{p.mall}</span>
      </div>
      <p className="mt-2.5 text-[13px] font-medium text-grey-500">{p.brand}</p>
      <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-grey-800">{p.name}</p>
      <p className="mt-1 text-[16px] font-bold text-grey-900">
        {rate > 0 && <span className="mr-1 text-toss-red">{rate}%</span>}
        {won(p.price)}
      </p>
      {p.rating && (
        <p className="mt-1 flex items-center gap-0.5 text-[12px] text-grey-500">
          <Star size={12} className="fill-[#FFC342] text-[#FFC342]" />
          {p.rating} ({p.reviews?.toLocaleString()})
        </p>
      )}
    </button>
  );
}

function CuratedSheet({ product: p, onClose, onCreate }: { product: Product | null; onClose: () => void; onCreate: (f: Funding) => void }) {
  const [ownerName, setOwnerName] = useState("");
  const [days, setDays] = useState(7);
  // 품절이 아닌 첫 번째 옵션을 미리 골라 둔다 (상품이 바뀌면 key로 시트를 새로 만든다)
  const [option, setOption] = useState(() => firstAvailableOption(p?.options));
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [purpose, setPurpose] = useState(() => purposeDraft());
  if (!p) return null;
  const rate = discountRate(p.price, p.originalPrice);
  return (
    <BottomSheet
      open
      onClose={onClose}
      footer={
        <Button
          disabled={!ownerName.trim() || !optionReady(option, p.options) || shippingStatus(shipping) === "partial"}
          onClick={() => onCreate(createFunding(p, { ...purposeText(purpose), ownerName, days, option, shipping: toShipping(shipping) }))}
        >
          <Gift size={20} /> 이 추천 상품으로 공동 선물 만들기
        </Button>
      }
    >
      <ProductThumb product={p} size="lg" className="!aspect-[4/3] !rounded-[24px] !text-[80px]" />
      <div className="mt-4 flex items-center gap-1.5">
        <Badge tone="blue">
          <Sparkles size={12} /> MD 추천
        </Badge>
        <Badge tone="grey">{p.mall}</Badge>
      </div>
      <p className="mt-2.5 text-[14px] font-medium text-grey-500">{p.brand}</p>
      <p className="mt-0.5 text-[20px] font-bold leading-snug text-grey-900">{p.name}</p>
      <div className="mt-2 flex items-baseline gap-2">
        {rate > 0 && <span className="text-[22px] font-bold text-toss-red">{rate}%</span>}
        <span className="text-[22px] font-bold text-grey-900">{won(p.price)}</span>
        {p.originalPrice && <span className="text-[15px] text-grey-400 line-through">{won(p.originalPrice)}</span>}
      </div>
      <FeeSummary basePrice={p.price} />
      <PurposeFields value={purpose} onChange={setPurpose} />
      <OwnerNameField value={ownerName} onChange={setOwnerName} />
      {!!p.options?.length && <OptionField value={option} onChange={setOption} options={p.options} />}
      <PeriodPicker value={days} onChange={setDays} />
      <ShippingFields value={shipping} onChange={setShipping} />
      <SafetyNote />
    </BottomSheet>
  );
}
