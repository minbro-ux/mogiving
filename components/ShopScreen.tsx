"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, ChevronLeft, ExternalLink, Gift, Link2, Search, ShieldCheck, Sparkles, Star, Wallet } from "lucide-react";
import { CATEGORIES, PRODUCTS, createFunding } from "@/lib/mock";
import { EXAMPLE_LINKS, mockCrawl, parseLink } from "@/lib/crawl";
import { discountRate, won } from "@/lib/format";
import type { Funding, Product } from "@/lib/types";
import { Badge, BottomSheet, Button, ProductThumb } from "./ui";

export function ShopScreen({ onCreate, onBack }: { onCreate: (f: Funding) => void; onBack?: () => void }) {
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [importUrl, setImportUrl] = useState<{ url: string; mall: string | null } | null>(null);

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
      <LinkImportSection onImport={setImportUrl} />

      {/* 진행 방식 안내 */}
      <section className="px-5 pt-4">
        <ol className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <Link2 size={18} />, t: "선물 등록" },
            { icon: <Gift size={18} />, t: "친구들과 모으기" },
            { icon: <Wallet size={18} />, t: "달성 시 즉시 송금" },
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
      <LinkImportSheet
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

function LinkImportSection({ onImport }: { onImport: (l: { url: string; mall: string | null }) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (raw = value) => {
    const parsed = parseLink(raw);
    if (!parsed) {
      setError("올바른 상품 링크를 입력해주세요");
      return;
    }
    setError(null);
    onImport(parsed);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      setError(null);
    } catch {
      setError("클립보드에 접근할 수 없어요. 직접 붙여넣어 주세요");
    }
  };

  return (
    <section className="px-5 pt-2">
      <div className="rounded-[24px] bg-toss-blue-light p-5">
        <p className="text-[20px] font-bold leading-snug text-grey-900">
          상품 링크(URL)로
          <br />
          위시리스트 만들기
        </p>
        <p className="mt-1.5 text-[14px] text-grey-600">쿠팡, 무신사, 29CM 등 원하는 상품 링크를 붙여넣으세요</p>

        <div
          className={`mt-4 flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-3.5 pr-1.5 ring-2 transition ${
            error ? "ring-toss-red" : "ring-transparent focus-within:ring-toss-blue"
          }`}
        >
          <Link2 size={18} className="shrink-0 text-grey-400" />
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

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-grey-500">예시 링크</span>
          {EXAMPLE_LINKS.map((l) => (
            <button
              key={l.mall}
              onClick={() => {
                setValue(l.url);
                submit(l.url);
              }}
              className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-grey-700 active:bg-grey-100"
            >
              {l.mall}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- 링크 → 상품 정보 바텀시트 ------------------------- */

function LinkImportSheet({
  link,
  onClose,
  onCreate,
}: {
  link: { url: string; mall: string | null } | null;
  onClose: () => void;
  onCreate: (f: Funding) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [autoFilled, setAutoFilled] = useState(true);
  const [draft, setDraft] = useState<Product | null>(null);
  const [days, setDays] = useState(7);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!link) return;
    let alive = true;
    setLoading(true);
    setDraft(null);
    mockCrawl(link.url, link.mall).then((r) => {
      if (!alive) return;
      setDraft(r.product);
      setAutoFilled(r.ok);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [link]);

  if (!link) return null;

  if (loading || !draft)
    return (
      <BottomSheet open onClose={onClose} title="상품 정보를 불러오고 있어요" description={link.mall ?? "쇼핑몰"}>
        <div className="mt-4 animate-pulse pb-4">
          <div className="aspect-[4/3] w-full rounded-[24px] bg-grey-100" />
          <div className="mt-5 h-4 w-1/3 rounded bg-grey-100" />
          <div className="mt-3 h-5 w-4/5 rounded bg-grey-100" />
          <div className="mt-3 h-6 w-2/5 rounded bg-grey-100" />
        </div>
      </BottomSheet>
    );

  const valid = draft.name.trim().length > 1 && draft.price >= 1000;
  const set = (patch: Partial<Product>) => setDraft({ ...draft, ...patch });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) set({ imageUrl: URL.createObjectURL(file) });
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={autoFilled ? "이 상품이 맞나요?" : "상품 정보를 입력해주세요"}
      description={autoFilled ? "가져온 정보가 다르면 바로 고칠 수 있어요." : "이 쇼핑몰은 자동으로 정보를 가져오지 못했어요."}
      footer={
        <Button disabled={!valid} onClick={() => onCreate(createFunding({ ...draft, brand: draft.brand || draft.mall }, { days }))}>
          <Gift size={20} /> 이 상품으로 펀딩 열기
        </Button>
      }
    >
      {/* 이미지 */}
      <div className="relative mt-4">
        <ProductThumb product={draft} size="lg" className="!aspect-[4/3] !rounded-[24px] !text-[80px]" />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-grey-900/70 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur"
        >
          <Camera size={14} /> 사진 변경
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Badge tone={autoFilled ? "green" : "orange"}>{autoFilled ? "자동 입력됨" : "직접 입력"}</Badge>
        <a href={link.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-[13px] text-grey-500">
          <span className="shrink-0 font-semibold text-grey-700">{draft.mall}</span>
          <span className="truncate">{link.url.replace(/^https?:\/\//, "")}</span>
          <ExternalLink size={12} className="shrink-0" />
        </a>
      </div>

      <FormField label="상품명">
        <input
          value={draft.name}
          maxLength={60}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="예) 르라보 상탈 33 50ml"
          className="h-12 w-full rounded-xl bg-grey-100 px-4 text-[16px] text-grey-900 outline-none placeholder:text-grey-400 focus:ring-2 focus:ring-toss-blue"
        />
      </FormField>
      <FormField label="가격 (목표 금액)">
        <div className="flex h-12 items-center rounded-xl bg-grey-100 px-4 focus-within:ring-2 focus-within:ring-toss-blue">
          <input
            inputMode="numeric"
            value={draft.price ? draft.price.toLocaleString("ko-KR") : ""}
            onChange={(e) => set({ price: Math.min(10_000_000, Number(e.target.value.replace(/\D/g, "")) || 0) })}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-grey-900 outline-none placeholder:text-grey-400"
          />
          <span className="text-[15px] text-grey-500">원</span>
        </div>
      </FormField>
      <PeriodPicker value={days} onChange={setDays} />
      <SafetyNote />
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
  const [days, setDays] = useState(7);
  if (!p) return null;
  const rate = discountRate(p.price, p.originalPrice);
  return (
    <BottomSheet
      open
      onClose={onClose}
      footer={
        <Button onClick={() => onCreate(createFunding(p, { days }))}>
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
      <PeriodPicker value={days} onChange={setDays} />
      <SafetyNote />
    </BottomSheet>
  );
}

/* --------------------------------- 공통 폼 --------------------------------- */

function SafetyNote() {
  return (
    <div className="mb-2 mt-5 space-y-2.5 rounded-2xl bg-grey-50 p-4 text-[13px] text-grey-700">
      <p className="flex items-center gap-2">
        <Wallet size={16} className="shrink-0 text-grey-500" /> 목표 달성 시 모인 금액이 내 토스머니로 즉시 송금돼요
      </p>
      <p className="flex items-center gap-2">
        <ShieldCheck size={16} className="shrink-0 text-grey-500" /> 본인 인증된 수령자 계좌로만 정산돼요
      </p>
    </div>
  );
}

function PeriodPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <FormField label="모금 기간">
      <div className="grid grid-cols-3 gap-2">
        {[3, 7, 14].map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`h-11 rounded-xl text-[15px] font-semibold transition ${value === d ? "bg-toss-blue text-white" : "bg-grey-100 text-grey-600"}`}
          >
            {d}일
          </button>
        ))}
      </div>
    </FormField>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[14px] font-semibold text-grey-600">{label}</p>
      {children}
    </div>
  );
}
