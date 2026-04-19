"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { fmt } from "@/lib/format";

type Customer = {
  id: string;
  full_name: string;
  business_name: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
};

const EMPTY_FORM = {
  full_name: "",
  business_name: "",
  phone: "",
  city: "",
  district: "",
  neighborhood: "",
};

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const { dealer, isAdmin, user } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtMap, setDebtMap]     = useState<Record<string, number>>({});
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function fetchCustomers() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res: any = await supabase
      .from("customers")
      .select("id, full_name, business_name, phone, city, district, neighborhood")
      .order("full_name", { ascending: true });
    if (res.error?.message?.includes("column")) {
      res = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .order("full_name", { ascending: true });
    }
    setCustomers((res.data ?? []) as Customer[]);
  }

  async function fetchDebts() {
    const [salesResRaw, paymentsRes] = await Promise.all([
      supabase.from("sales").select("customer_id, total_amount, paid_amount"),
      supabase.from("payments").select("customer_id, amount"),
    ]);

    let salesRes = salesResRaw;
    if (salesRes.error?.message?.includes("column") || salesRes.error?.message?.includes("paid_amount")) {
      salesRes = await supabase.from("sales").select("customer_id, total_amount");
    }

    const map: Record<string, number> = {};
    (salesRes.data ?? []).forEach((s: any) => {
      const debt = (Number(s.total_amount) || 0) - (Number(s.paid_amount ?? s.total_amount) || 0);
      map[s.customer_id] = (map[s.customer_id] ?? 0) + debt;
    });
    (paymentsRes.data ?? []).forEach((p: any) => {
      map[p.customer_id] = (map[p.customer_id] ?? 0) - Number(p.amount);
    });
    setDebtMap(map);
  }

  async function handleSave() {
    if (!form.full_name.trim() || saving) return;
    if (!dealer?.id) { setError("Oturum bilgisi alınamadı, sayfayı yenileyin."); return; }
    setSaving(true);
    setError(null);

    // Tüm alanlarla dene; yeni kolonlar yoksa sadece temel alanlarla tekrar dene
    let res = await supabase.from("customers").insert({
      dealer_id:     dealer.id,
      full_name:     form.full_name.trim(),
      business_name: form.business_name.trim() || null,
      phone:         form.phone.trim() || null,
      city:          form.city.trim() || null,
      district:      form.district.trim() || null,
      neighborhood:  form.neighborhood.trim() || null,
      created_by:    user?.id ?? null,
    });

    if (res.error?.message?.includes("column")) {
      res = await supabase.from("customers").insert({
        dealer_id: dealer.id,
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
      });
    }

    const { error } = res;
    if (error) { setError(error.message); setSaving(false); return; }
    setForm(EMPTY_FORM);
    setShowModal(false);
    await fetchCustomers();
    await fetchDebts();
    setSaving(false);
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`"${customer.full_name}" müşterisini silmek istediğinize emin misiniz?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) { setError(error.message); return; }
    setCustomers(prev => prev.filter(c => c.id !== customer.id));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  }

  useEffect(() => {
    fetchCustomers();
    fetchDebts();
  }, []);

  const filtered = useMemo(() =>
    customers.filter(c =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.business_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
    ), [customers, search]);

  return (
    <div className="px-4 py-4 pb-24 space-y-3 max-w-xl mx-auto">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-zinc-900">Müşteriler</h1>
        <button
          onClick={openModal}
          className="h-9 px-4 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:bg-amber-700"
        >
          + Müşteri Ekle
        </button>
      </div>

      {/* Toplam Borç Kartı */}
      {(() => {
        const totalDebt = Object.values(debtMap).filter(d => d > 0.009).reduce((s, d) => s + d, 0);
        if (totalDebt <= 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-red-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-500">Toplam Açık Borç</p>
            <p className="text-lg font-black text-red-500 tabular-nums">{fmt(totalDebt)}</p>
          </div>
        );
      })()}

      {/* Arama */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="6" r="4"/><path d="M10 10l3 3"/>
        </svg>
        <input
          placeholder="Müşteri ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Müşteri listesi */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-12">
            {search ? "Sonuç bulunamadı" : "Henüz müşteri yok"}
          </p>
        )}
        {filtered.map(c => {
          const debt = debtMap[c.id] ?? 0;
          const location = [c.neighborhood, c.district, c.city].filter(Boolean).join(", ");
          return (
            <Link key={c.id} href={`/dashboard/customers/${c.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-zinc-200 px-4 py-3 hover:bg-zinc-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0">
                {c.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 truncate">{c.full_name}</p>
                <p className="text-xs text-zinc-400 truncate">
                  {[c.business_name, c.phone, location].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {debt > 0.009 ? (
                  <span className="text-sm font-bold text-red-500">{fmt(debt)}</span>
                ) : debt < -0.009 ? (
                  <span className="text-sm font-bold text-emerald-600">Alacak</span>
                ) : (
                  <span className="text-xs text-zinc-300">Borç yok</span>
                )}
                {isAdmin && (
                  <button
                    onClick={e => { e.preventDefault(); handleDelete(c); }}
                    className="text-xs font-semibold text-red-400 hover:text-red-600"
                  >
                    Sil
                  </button>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Müşteri Ekle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900">Yeni Müşteri</h2>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 flex items-center justify-center text-zinc-400 text-2xl hover:text-zinc-700">×</button>
            </div>

            {/* Ad Soyad */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Ad Soyad <span className="text-red-400">*</span></label>
              <input
                placeholder="Ad Soyad"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* İşletme Adı */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">İşletme Adı</label>
              <input
                placeholder="İşletme Adı (opsiyonel)"
                value={form.business_name}
                onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Telefon */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Telefon Numarası</label>
              <input
                placeholder="05XX XXX XX XX"
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* İl / İlçe */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1">İl</label>
                <input
                  placeholder="İl"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1">İlçe</label>
                <input
                  placeholder="İlçe"
                  value={form.district}
                  onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Mahalle */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Mahalle</label>
              <input
                placeholder="Mahalle"
                value={form.neighborhood}
                onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="h-12 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.full_name.trim()}
                className="h-12 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40"
              >
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
