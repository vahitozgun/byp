"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmt } from "@/lib/format";

interface Customer { id: string; full_name: string; phone: string | null; }
interface Product  { id: string; name: string; unit: string; purchase_price: number; }
interface CartEntry { qty: number; price: string; }
type PaymentType = "nakit" | "kredi_karti";

function SelectSheet({ isOpen, title, items, selectedId, onSelect, onClose }: {
  isOpen: boolean; title: string;
  items: { id: string; label: string; sub?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) { setQ(""); setTimeout(() => inputRef.current?.focus(), 150); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal aria-label={title}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[85dvh] flex flex-col shadow-2xl">
        <div className="flex justify-center py-3 flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-zinc-200" />
        </div>
        <div className="px-5 pb-3 flex-shrink-0">
          <p className="text-lg font-black text-zinc-900 mb-3">{title}</p>
          <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="w-full h-11 px-4 rounded-xl bg-zinc-100 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <ul className="flex-1 overflow-y-auto px-3 pb-8">
          {filtered.length === 0 ? (
            <li className="py-10 text-center text-sm text-zinc-400">Sonuç bulunamadı</li>
          ) : filtered.map((item) => (
            <li key={item.id}>
              <button onClick={() => onSelect(item.id)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-left mb-1 transition-colors ${item.id === selectedId ? "bg-amber-50" : "hover:bg-zinc-50 active:bg-zinc-100"}`}>
                <div>
                  <p className={`text-base font-semibold ${item.id === selectedId ? "text-amber-800" : "text-zinc-900"}`}>{item.label}</p>
                  {item.sub && <p className="text-sm text-zinc-400 mt-0.5">{item.sub}</p>}
                </div>
                {item.id === selectedId && (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-amber-500 flex-shrink-0">
                    <path d="M4.5 11l4.5 4.5 8.5-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function SalesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [customer, setCustomer]         = useState<Customer | null>(null);
  const [cart, setCart]                 = useState<Record<string, CartEntry>>({});
  const [lastPriceMap, setLastPriceMap] = useState<Record<string, number>>({});
  const [customerDebt, setCustomerDebt] = useState<number | null>(null);
  const [paymentType, setPaymentType]   = useState<PaymentType>("nakit");
  const [paidAmount, setPaidAmount]     = useState("");
  const [notes, setNotes]               = useState("");

  const [screen, setScreen]             = useState<"form" | "success">("form");
  const [showCustomerSheet, setShowCustomerSheet] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("id, full_name, phone").eq("is_active", true).order("full_name"),
      supabase.from("products").select("id, name, unit, purchase_price").eq("is_active", true).order("name"),
    ]).then(([c, p]) => {
      if (c.error || p.error) { setLoadError(c.error?.message ?? p.error?.message ?? "Yükleme hatası"); return; }
      setCustomers(c.data as Customer[]);
      setProducts(p.data as Product[]);
    });
  }, [supabase]);

  useEffect(() => {
    if (!customer) { setLastPriceMap({}); setCustomerDebt(null); return; }
    let active = true;

    Promise.all([
      supabase.from("sales").select("product_id, sale_price").eq("customer_id", customer.id)
        .order("sale_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.from("sales").select("total_amount, paid_amount").eq("customer_id", customer.id),
      supabase.from("payments").select("amount").eq("customer_id", customer.id),
    ]).then(([priceRes, salesRes, payRes]) => {
      if (!active) return;

      // Önceki fiyatlar (sadece ipucu)
      const priceMap: Record<string, number> = {};
      (priceRes.data ?? []).forEach((s: any) => {
        if (!priceMap[s.product_id]) priceMap[s.product_id] = Number(s.sale_price);
      });
      setLastPriceMap(priceMap);

      // Güncel borç
      const salesDebt = (salesRes.data ?? []).reduce((sum: number, s: any) =>
        sum + (Number(s.total_amount) - Number(s.paid_amount ?? s.total_amount)), 0);
      const paymentSum = (payRes.data ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      setCustomerDebt(Math.max(0, salesDebt - paymentSum));
    });

    return () => { active = false; };
  }, [customer?.id]);

  function setQty(pid: string, qty: number) {
    setCart(prev => ({ ...prev, [pid]: { price: prev[pid]?.price ?? "", qty: Math.max(0, qty) } }));
  }

  function setPrice(pid: string, price: string) {
    setCart(prev => ({ ...prev, [pid]: { qty: prev[pid]?.qty ?? 0, price } }));
  }

  const cartItems = products.filter(p => (cart[p.id]?.qty ?? 0) > 0);
  const total = cartItems.reduce((sum, p) => sum + (cart[p.id].qty) * (parseFloat(cart[p.id].price) || 0), 0);
  const parsedPaid = parseFloat(paidAmount);
  // Tutar girilmemişse 0 (tamamı borç), girilmişse girilen değer
  const effectivePaid = isNaN(parsedPaid) ? 0 : parsedPaid;
  const debt = total - effectivePaid;

  const canSave = !!customer && !!profile && cartItems.length > 0
    && cartItems.every(p => parseFloat(cart[p.id].price) > 0)
    && !saving;

  async function handleSave() {
    if (!canSave || !profile) { setError("Oturum hatası. Sayfayı yenileyip tekrar deneyin."); return; }
    setSaving(true); setError(null);
    const today = new Date().toISOString().split("T")[0];

    const results = await Promise.all(
      cartItems.map(async p => {
        const qty = cart[p.id].qty;
        const salePrice = parseFloat(cart[p.id].price);
        const itemTotal = qty * salePrice;
        const itemPaid = total > 0 ? Math.round((itemTotal / total) * effectivePaid * 100) / 100 : 0;

        const base = {
          dealer_id: profile.dealer_id,
          sales_rep_id: profile.id,
          customer_id: customer!.id,
          product_id: p.id,
          sale_date: today,
          quantity: qty,
          sale_price: salePrice,
          purchase_price_at_sale: p.purchase_price,
          notes: notes.trim() || null,
        };

        // Try with payment columns first; fall back if columns don't exist yet
        const res = await supabase.from("sales").insert({ ...base, payment_type: paymentType, paid_amount: itemPaid });
        if (res.error?.message?.includes("column")) {
          return supabase.from("sales").insert(base);
        }
        return res;
      })
    );

    setSaving(false);
    const err = results.find(r => r.error);
    if (err?.error) { setError(err.error.message); return; }
    setScreen("success");
  }

  function reset() {
    setCustomer(null); setCart({}); setLastPriceMap({}); setCustomerDebt(null);
    setPaidAmount(""); setNotes(""); setError(null); setScreen("form"); setPaymentType("nakit");
  }

  if (screen === "success") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4 py-20">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M8 20l8 8 16-16" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-black text-zinc-900">Satış kaydedildi</p>
          <p className="text-sm text-zinc-500 mt-1">{customer?.full_name} · {fmt(total)}</p>
          {debt > 0 && <p className="text-sm text-red-500 mt-1 font-semibold">Kalan borç: {fmt(debt)}</p>}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button onClick={reset} className="h-14 bg-amber-500 text-white font-black text-base rounded-2xl active:scale-[0.98] transition-transform shadow-[0_4px_16px_rgba(245,158,11,0.35)]">Yeni Satış</button>
          <button onClick={() => router.push("/dashboard/sales-history")} className="h-12 bg-zinc-100 text-zinc-700 font-semibold text-sm rounded-2xl active:scale-[0.98] transition-transform">Geçmişi Gör</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-52">
        {loadError && <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600">{loadError}</div>}

        {/* Müşteri seçici */}
        <button onClick={() => setShowCustomerSheet(true)}
          className={`w-full h-14 px-5 rounded-2xl border-2 flex items-center justify-between transition-colors ${customer ? "border-amber-400 bg-amber-50" : "border-dashed border-zinc-300 bg-white"}`}>
          <div className="text-left">
            {customer ? (
              <>
                <p className="text-base font-bold text-zinc-900">{customer.full_name}</p>
                {customer.phone && <p className="text-xs text-zinc-500">{customer.phone}</p>}
              </>
            ) : <span className="text-base text-zinc-400">Müşteri seçin…</span>}
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-zinc-400 flex-shrink-0">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Müşteri güncel borcu */}
        {customer && customerDebt !== null && customerDebt > 0 && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
            <p className="text-sm font-semibold text-red-600">Mevcut Borç</p>
            <p className="text-sm font-black text-red-600">{fmt(customerDebt)}</p>
          </div>
        )}
        {customer && customerDebt === 0 && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
            <p className="text-sm font-semibold text-emerald-600">Mevcut Borç</p>
            <p className="text-sm font-black text-emerald-600">Borç Yok</p>
          </div>
        )}

        {/* Ürün listesi */}
        <div className="space-y-2">
          {products.map(product => {
            const qty   = cart[product.id]?.qty ?? 0;
            const price = cart[product.id]?.price ?? "";
            const rowTotal = qty * (parseFloat(price) || 0);
            return (
              <div key={product.id} className={`bg-white rounded-2xl border-2 px-4 py-3 transition-colors ${qty > 0 ? "border-amber-300" : "border-zinc-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-zinc-900 flex-1 truncate">{product.name}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setQty(product.id, qty - 1)}
                      className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-xl text-zinc-600 active:bg-zinc-200 transition-colors">−</button>
                    <input
                      type="number" inputMode="numeric" min="0"
                      value={qty === 0 ? "" : qty}
                      placeholder="0"
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        setQty(product.id, isNaN(v) ? 0 : Math.max(0, v));
                      }}
                      className="w-12 text-center text-lg font-black text-zinc-900 bg-transparent focus:outline-none focus:bg-zinc-100 rounded-lg py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => setQty(product.id, qty + 1)}
                      className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-xl text-white active:bg-amber-600 transition-colors">+</button>
                  </div>
                </div>
                {qty > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400 pointer-events-none">₺</span>
                        <input type="number" inputMode="decimal" step="0.01" min="0"
                          value={price} onChange={e => setPrice(product.id, e.target.value)}
                          placeholder="Birim fiyat"
                          className="w-full h-10 pl-7 pr-3 rounded-xl border-2 border-zinc-200 text-sm font-bold text-zinc-900 focus:outline-none focus:border-amber-400" />
                      </div>
                      {rowTotal > 0 && (
                        <span className="text-sm font-black text-amber-700 flex-shrink-0">{fmt(rowTotal)}</span>
                      )}
                    </div>
                    {lastPriceMap[product.id] && (
                      <p className="text-[11px] text-zinc-400 px-1">
                        Önceki satışta <span className="font-semibold">{fmt(lastPriceMap[product.id])}</span> fiyatından satıldı
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Toplam tutar */}
        {total > 0 && (
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-zinc-900 text-white">
            <span className="text-sm font-medium text-zinc-400">Toplam Tutar</span>
            <span className="text-2xl font-black tabular-nums">{fmt(total)}</span>
          </div>
        )}

        {/* Ödeme tipi */}
        {cartItems.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Ödeme Tipi</p>
            <div className="grid grid-cols-2 gap-2">
              {([["nakit", "Nakit"], ["kredi_karti", "Kredi Kartı"]] as const).map(([type, label]) => (
                <button key={type}
                  onClick={() => { setPaymentType(type); setPaidAmount(""); }}
                  className={`h-12 rounded-2xl text-sm font-bold transition-colors ${paymentType === type ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Alınan Ödeme</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-400 pointer-events-none">₺</span>
                <input type="number" inputMode="decimal" step="0.01" min="0"
                  value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                  placeholder={total > 0 ? String(total.toFixed(2)) : "0.00"}
                  className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-zinc-200 bg-white text-xl font-black text-zinc-900 placeholder:text-zinc-300 placeholder:font-normal focus:outline-none focus:border-amber-400" />
              </div>
              {total > 0 && (
                <p className={`text-sm font-semibold px-1 ${debt > 0 || (customerDebt ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {debt > 0 || (customerDebt ?? 0) > 0
                    ? `Toplam kalan borç: ${fmt(debt + (customerDebt ?? 0))}`
                    : "Tam ödendi"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notlar */}
        {cartItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Notlar <span className="normal-case font-normal text-zinc-300">(isteğe bağlı)</span>
            </p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Not ekleyin…"
              className="w-full px-4 py-3 rounded-2xl border-2 border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:border-amber-400 resize-none" />
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
      </div>

      {/* Kaydet butonu */}
      <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-zinc-200 px-4 py-4">
        <button onClick={handleSave} disabled={!canSave}
          className={`w-full h-14 rounded-2xl text-base font-black tracking-wide transition-all duration-150 ${canSave ? "bg-amber-500 text-white active:scale-[0.98] shadow-[0_4px_16px_rgba(245,158,11,0.4)]" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
                <path d="M9 2a7 7 0 017 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Kaydediliyor…
            </span>
          ) : canSave ? `Kaydet · ${fmt(total)}` : "Tüm alanları doldurun"}
        </button>
      </div>

      <SelectSheet isOpen={showCustomerSheet} title="Müşteri Seçin"
        items={customers.map(c => ({ id: c.id, label: c.full_name, sub: c.phone ?? "" }))}
        selectedId={customer?.id ?? null}
        onSelect={id => { setCustomer(customers.find(c => c.id === id)!); setShowCustomerSheet(false); }}
        onClose={() => setShowCustomerSheet(false)} />
    </>
  );
}
