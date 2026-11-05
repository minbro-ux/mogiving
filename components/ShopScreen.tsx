"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Gift, Link2, Loader2, PackageCheck, Pencil, Search, Sparkles, Star } from "lucide-react";
import { CATEGORIES, PRODUCTS, createFunding } from "@/lib/mock";
import { type CrawlResult, type ParsedLink, crawlProduct, parseLink } from "@/lib/crawl";
import { discountRate, won } from "@/lib/format";
import type { Funding, Product } from "@/lib/types";
import { EMPTY_SHIPPING, FeeSummary, OptionField, OwnerNameField, PeriodPicker, SafetyNote, ShippingFields, shippingStatus, toShipping } from "./FundingForm";
import { LinkImportSheet } from "./LinkImportSheet";
import { Badge, BottomSheet, Button, ProductThumb } from "./ui";
import { WishRequestSheet } from "./WishRequestSheet";

export function ShopScreen({ onCreate, onBack, onToast }: { onCreate: (f: Funding) => void; onBack?: () => void; onToast: (msg: string) => void }) {
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [importUrl, setImportUrl] = useState<ParsedLink | null>(null);
  const [prefetched, setPrefetched] = useState<CrawlResult | null>(null);
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
        <Badge tone="blue">선물 펀딩</Badge>
      </header>

      {/* 1. 상품 링크로 위시리스트 만들기 */}
      <LinkImportSection
        onImport={(l, r) => {
          setPrefetched(r ?? null);
          setImportUrl(l);
        }}
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
            { icon: <PackageCheck size={18} />, t: "달성 시 실물 배송" },
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
        product={picked}
        onClose={() => setPicked(null)}
        onCreate={(f) => {
          setPicked(null);
          onCreate(f);
        }}
      />
      <WishRequestSheet open={wishOpen} onClose={() => setWishOpen(false)} onCopied={onToast} />
      <LinkImportSheet
        link={importUrl}
        prefetched={prefetched}
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

type OnImport = (l: ParsedLink, prefetched?: CrawlResult) => void;

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

/** 붙여넣기·입력이 끝난 뒤 자동으로 미리보기를 불러오기까지 기다리는 시간 */
const AUTO_FETCH_DELAY_MS = 450;

/** 타이핑 도중 "https://cou" 같은 미완성 주소로 요청하지 않도록, 도메인(.com 등)과 경로까지 들어간 주소만 자동으로 불러온다 */
function looksComplete(v: string) {
  const t = v.trim();
  return /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}\/\S+$/i.test(t);
}

type Preview = { link: ParsedLink; result: CrawlResult | null };

/**
 * 상품 링크 입력 + 붙여넣기 (메인 섹션과 2탄 모금함 시트에서 공용)
 * 링크를 붙여넣거나 입력하면 서버(/api/crawl)에서 og:image·og:title을 받아 바로 아래 미리보기 카드에 보여준다.
 * 불러오기에 실패해도 '직접 입력하기'로 상품명·사진을 손으로 채우는 시트로 이어진다.
 */
function LinkInputForm({ onImport }: { onImport: OnImport }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // 입력이 멈추면 자동으로 메타데이터를 불러온다. 링크가 바뀌면 이전 요청은 취소
  useEffect(() => {
    const parsed = looksComplete(value) ? parseLink(value) : null;
    if (!parsed) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPreview({ link: parsed, result: null });
      crawlProduct(parsed, controller.signal).then((result) => {
        if (!controller.signal.aborted) setPreview({ link: parsed, result });
      });
    }, AUTO_FETCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const submit = (raw = value) => {
    const parsed = parseLink(raw);
    if (!parsed) {
      setError("올바른 상품 링크를 입력해주세요");
      return;
    }
    setError(null);
    // 이미 불러온 미리보기가 있으면 다시 크롤링하지 않고 그대로 넘긴다
    onImport(parsed, preview?.link.url === parsed.url ? preview.result ?? undefined : undefined);
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      setValue(text);
      setError(null);
    } catch {
      setError("클립보드에 접근할 수 없어요. 직접 붙여넣어 주세요");
    }
  };

  const loading = !!preview && !preview.result;

  return (
    <>
      <div
        className={`mt-4 flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-3.5 pr-1.5 ring-2 transition ${
          error ? "ring-toss-red" : "ring-transparent focus-within:ring-toss-blue"
        }`}
      >
        {loading ? <Loader2 size={18} className="shrink-0 animate-spin text-toss-blue" /> : <Link2 size={18} className="shrink-0 text-grey-400" />}
        <input
          value={value}
          inputMode="url"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="https://"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-grey-900 outline-none placeholder:text-grey-400"
        />
        {!value && (
          <button onClick={paste} className="shrink-0 px-2 text-[13px] font-semibold text-grey-500">
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
      {preview && <LinkPreviewCard preview={preview} onConfirm={() => submit()} />}
    </>
  );
}

/** 링크 미리보기 카드: 로딩 스피너 → 대표 이미지·상품명 (실패 시 직접 입력 안내) */
function LinkPreviewCard({ preview: { link, result }, onConfirm }: { preview: Preview; onConfirm: () => void }) {
  if (!result)
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3" aria-live="polite">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-grey-100">
          <Loader2 size={22} className="animate-spin text-toss-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-grey-500">{link.mall ?? "쇼핑몰"}</p>
          <p className="mt-0.5 text-[15px] font-semibold text-grey-700">상품 정보를 불러오고 있어요…</p>
        </div>
      </div>
    );

  const p = result.product;
  // 가격만 못 가져온 경우에도 이미지·상품명이 있으면 미리보기는 보여준다
  const hasPreview = !!(p.name || p.imageUrl);
  return (
    <div className="mt-3 rounded-2xl bg-white p-3" aria-live="polite">
      {hasPreview ? (
        <div className="flex items-start gap-3">
          <ProductThumb product={p} size="md" className="!rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-grey-500">{p.brand || p.mall}</p>
            <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-grey-900">{p.name || "상품명을 입력해 주세요"}</p>
            {p.price > 0 ? (
              <p className="mt-1 text-[15px] font-bold text-grey-900">{won(p.price)}</p>
            ) : (
              result.description && <p className="mt-1 line-clamp-1 text-[12px] text-grey-500">{result.description}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-[14px] font-semibold leading-snug text-grey-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-toss-orange" />
          {link.mall ?? "이 쇼핑몰"}에서 상품 정보를 자동으로 불러오지 못했어요. 상품명과 사진을 직접 입력할 수 있어요.
        </p>
      )}
      <Button size="sm" variant={result.ok ? "primary" : "weak"} onClick={onConfirm} className="mt-3 h-10 text-[14px]">
        {result.ok ? (
          <>
            <Gift size={16} /> 이 상품으로 펀딩 만들기
          </>
        ) : (
          <>
            <Pencil size={14} /> {hasPreview ? "나머지 정보 직접 입력하기" : "직접 입력하기"}
          </>
        )}
      </Button>
    </div>
  );
}

/* ------------------------ 다음 모금함(2탄) 열기 바텀시트 ------------------------ */

/** 1차 펀딩 완판 후: 링크 입력 → 상품 확인(LinkImportSheet) 순서로 다음 회차 펀딩 생성 */
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
  const [prefetched, setPrefetched] = useState<CrawlResult | null>(null);

  useEffect(() => {
    if (open) setLink(null);
  }, [open]);

  if (!open) return null;
  if (link) return <LinkImportSheet link={link} prefetched={prefetched} round={round} initialOwnerName={ownerName} onClose={onClose} onCreate={onCreate} />;

  return (
    <BottomSheet open onClose={onClose} title={`다음 위시리스트 모금함 열기 · ${round}탄`} description="갖고 싶은 다음 선물의 상품 링크를 붙여넣으세요.">
      <div className="mb-4 mt-1 rounded-[20px] bg-toss-blue-light p-4 pt-0.5">
        <LinkInputForm
          onImport={(l, r) => {
            setPrefetched(r ?? null);
            setLink(l);
          }}
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
  const [option, setOption] = useState("");
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  if (!p) return null;
  const rate = discountRate(p.price, p.originalPrice);
  return (
    <BottomSheet
      open
      onClose={onClose}
      footer={
        <Button
          disabled={!ownerName.trim() || shippingStatus(shipping) === "partial"}
          onClick={() => onCreate(createFunding(p, { ownerName, days, option, shipping: toShipping(shipping) }))}
        >
          <Gift size={20} /> 이 추천 상품으로 펀딩 열기
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
      <OwnerNameField value={ownerName} onChange={setOwnerName} />
      <OptionField value={option} onChange={setOption} />
      <PeriodPicker value={days} onChange={setDays} />
      <ShippingFields value={shipping} onChange={setShipping} />
      <SafetyNote />
    </BottomSheet>
  );
}
