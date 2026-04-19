"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmt, fmtDate } from "@/lib/format";
import { PAY_LABEL, PAYMENT_TYPES as PAY_TYPES } from "@/lib/constants";

interface Customer { id: string; full_name: string; phone: string; assigned_rep_id: string | null; }
interface RepOption { id: string; full_name: string; }

interface SaleLine {
  kind: "sale";
  id: string;
  date: string;
  sortKey: string;
  product: string;
  qty: number;
  price: number;
  total: number;
  paid: number;
  profit: number;
  payType: string | null;
}
interface PaymentItem {
  kind: "payment";
  id: string;
  date: string;
  sortKey: string;
  label: string;
  amount: number;
  createdBy: string;
}
type DetailRow = (SaleLine | PaymentItem) & { runningBalance: number };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, dealer, isAdmin } = useAuth();

  const [customer, setCustomer]     = useState<Customer | null>(null);
  const [rows, setRows]             = useState<DetailRow[]>([]);
  const [summary, setSummary]       = useState({ debit: 0, credit: 0, balance: 0, profit: 0 });
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount]       = useState("");
  const [payDate, setPayDate]           = useState(() => new Date().toISOString().split("T")[0]);
  const [payType, setPayType]           = useState("nakit");
  const [payNote, setPayNote]           = useState("");
  const [paying, setPaying]             = useState(false);
  const [payError, setPayError]         = useState("");

  const [reps, setReps]                   = useState<RepOption[]>([]);
  const [assignedRepId, setAssignedRepId] = useState<string | null>(null);
  const [assignSaving, setAssignSaving]   = useState(false);

  const [editPayment, setEditPayment] = useState<PaymentItem | null>(null);
  const [epAmount, setEpAmount]       = useState("");
  const [epDate, setEpDate]           = useState("");
  const [epType, setEpType]           = useState("nakit");
  const [epNote, setEpNote]           = useState("");
  const [epSaving, setEpSaving]       = useState(false);
  const [epError, setEpError]         = useState("");

  async function loadData() {
    if (!id) return;
    setLoading(true); setFetchError(null);

    const [cRes, sResRaw, pRes] = await Promise.all([
      supabase.from("customers").select("id, full_name, phone, assigned_rep_id").eq("id", id).single(),
      supabase.from("sales")
        .select("id, sale_date, total_amount, paid_amount, payment_type, sale_price, quantity, profit, created_at, product:products(name)")
        .eq("customer_id", id)
        .order("sale_date", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("payments")
        .select("id, payment_date, amount, payment_type, notes, created_at, creator:users!created_by(full_name)")
        .eq("customer_id", id)
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const c = cRes.data as Customer;
    setCustomer(c);
    setAssignedRepId(c?.assigned_rep_id ?? null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sRes: any = sResRaw;
    if (sRes.error?.message?.includes("paid_amount") || sRes.error?.message?.includes("column")) {
      sRes = await supabase.from("sales")
        .select("id, sale_date, total_amount, sale_price, quantity, created_at, product:products(name)")
        .eq("customer_id", id)
        .order("sale_date", { ascending: true })
        .order("created_at", { ascending: true });
    }
    if (sRes.error) { setFetchError(sRes.error.message); setLoading(false); return; }

    type RawRow = SaleLine | PaymentItem;
    const raw: RawRow[] = [];

    for (const s of (sRes.data ?? []) as any[]) {
      const total = Number(s.total_amount) || 0;
      const paid  = Number(s.paid_amount ?? s.total_amount) || 0;
      raw.push({
        kind: "sale",
        id: s.id,
        date: s.sale_date,
        sortKey: s.sale_date + "_" + s.created_at,
        product: s.product?.name ?? "—",
        qty: Number(s.quantity),
        price: Number(s.sale_price),
        total,
        paid,
        profit: Number(s.profit ?? 0),
        payType: s.payment_type ?? null,
      });
    }

    for (const p of (pRes.data ?? []) as any[]) {
      const ptLabel = PAY_LABEL[p.payment_type] ?? "Tahsilat";
      raw.push({
        kind: "payment",
        id: p.id,
        date: p.payment_date,
        sortKey: p.payment_date + "_" + p.created_at,
        label: p.notes ? `${ptLabel} — ${p.notes}` : ptLabel,
        amount: Number(p.amount) || 0,
        createdBy: (p.creator as any)?.full_name ?? "",
      });
    }

    raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let balance = 0;
    const withBalance: DetailRow[] = raw.map(r => {
      if (r.kind === "sale")    balance += r.total - r.paid;
      else                      balance -= r.amount;
      return { ...r, runningBalance: balance } as DetailRow;
    });

    const totalDebit  = raw.reduce((s, r) => s + (r.kind === "sale" ? r.total : 0), 0);
    const totalPaid   = raw.reduce((s, r) => s + (r.kind === "sale" ? r.paid : r.amount), 0);
    const totalProfit = raw.reduce((s, r) => s + (r.kind === "sale" ? r.profit : 0), 0);
    setSummary({ debit: totalDebit, credit: totalPaid, balance: totalDebit - totalPaid, profit: totalProfit });

    setRows([...withBalance].reverse());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    if (isAdmin && dealer?.id) {
      supabase.from("users").select("id, full_name").eq("dealer_id", dealer.id).eq("role", "sales_rep").eq("is_active", true)
        .then(({ data }) => setReps((data ?? []) as RepOption[]));
    }
  }, [id, isAdmin, dealer?.id]);

  async function handleAddPayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPayError("Geçerli bir tutar girin."); return; }
    if (!dealer?.id) { setPayError("Bayi bilgisi alınamadı — sayfayı yenileyin."); return; }
    if (!user?.id)   { setPayError("Oturum bilgisi alınamadı — yeniden giriş yapın."); return; }
    setPaying(true); setPayError("");
    let res = await supabase.from("payments").insert({
      dealer_id: dealer.id, customer_id: id, created_by: user.id,
      amount, payment_type: payType, payment_date: payDate, notes: payNote.trim() || null,
    });
    if (res.error?.message?.includes("payment_type") || res.error?.message?.includes("column")) {
      res = await supabase.from("payments").insert({
        dealer_id: dealer.id, customer_id: id, created_by: user.id,
        amount, payment_date: payDate, notes: payNote.trim() || null,
      });
    }
    setPaying(false);
    if (res.error) { setPayError(res.error.message); return; }
    setShowPayModal(false);
    setPayAmount(""); setPayNote(""); setPayType("nakit");
    setPayDate(new Date().toISOString().split("T")[0]);
    await loadData();
  }

  async function handleAssignRep(repId: string | null) {
    setAssignSaving(true);
    await supabase.from("customers").update({ assigned_rep_id: repId }).eq("id", id as string);
    setAssignedRepId(repId);
    setAssignSaving(false);
  }

  function openEditPayment(row: PaymentItem) {
    const rawLabel = row.label.split(" — ")[0];
    const typeEntry = Object.entries(PAY_LABEL).find(([, v]) => v === rawLabel);
    setEditPayment(row);
    setEpAmount(String(row.amount));
    setEpDate(row.date);
    setEpType(typeEntry ? typeEntry[0] : "nakit");
    setEpNote(row.label.includes(" — ") ? row.label.split(" — ").slice(1).join(" — ") : "");
    setEpError("");
  }

  async function handleSaveEditPayment() {
    if (!editPayment) return;
    const amount = parseFloat(epAmount);
    if (!amount || amount <= 0) { setEpError("Geçerli bir tutar girin."); return; }
    setEpSaving(true); setEpError("");
    const { error } = await supabase.from("payments").update({
      amount, payment_date: epDate, payment_type: epType, notes: epNote.trim() || null,
    }).eq("id", editPayment.id);
    setEpSaving(false);
    if (error) { setEpError(error.message); return; }
    setEditPayment(null);
    await loadData();
  }

  async function handleDeletePayment(row: PaymentItem) {
    if (!confirm(`${fmt(row.amount)} tutarındaki tahsilat silinsin mi?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", row.id);
    if (error) { alert(error.message); return; }
    await loadData();
  }

  const isInDebt = summary.balance > 0.009;

  return (
    <div className="flex flex-col min-h-full bg-zinc-50">

      {/* Üst bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-700">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18l-6-7 6-7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Müşteri Cari Hesabı</p>
          <h1 className="text-base font-black text-zinc-900 truncate">{customer?.full_name ?? "…"}</h1>
          {customer?.phone && <p className="text-[11px] text-zinc-400">{customer.phone}</p>}
        </div>
        <button onClick={() => { setShowPayModal(true); setPayError(""); }}
          className="h-9 px-4 bg-amber-500 text-white text-sm font-bold rounded-xl flex-shrink-0">
          + Tahsilat
        </button>
      </div>

      {/* Özet kart */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
        <div className={`px-5 py-4 ${isInDebt ? "bg-red-600" : "bg-emerald-600"}`}>
          <p className="text-[10px] font-semibold text-white/70 uppercase tracking-widest mb-1">Net Bakiye</p>
          <p className="text-3xl font-black text-white tabular-nums">
            {loading ? "…" : isInDebt ? fmt(summary.balance) : "Borç Yok"}
          </p>
          {!loading && isInDebt && <p className="text-xs text-white/70 mt-0.5">Müşteri borçlu</p>}
        </div>
        <div className={`grid divide-x divide-zinc-100 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="px-4 py-3">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Toplam Borç</p>
            <p className="text-sm font-black text-zinc-900 tabular-nums">{loading ? "…" : fmt(summary.debit)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Toplam Tahsilat</p>
            <p className="text-sm font-black text-emerald-600 tabular-nums">{loading ? "…" : fmt(summary.credit)}</p>
          </div>
          {isAdmin && (
            <div className="px-4 py-3">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Toplam Kar</p>
              <p className="text-sm font-black text-amber-600 tabular-nums">{loading ? "…" : fmt(summary.profit)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin: temsilci atama */}
      {isAdmin && reps.length > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-zinc-200 px-4 py-3 flex items-center gap-3">
          <p className="text-xs font-semibold text-zinc-500 flex-shrink-0">Atanan Temsilci</p>
          <select value={assignedRepId ?? ""} onChange={e => handleAssignRep(e.target.value || null)}
            disabled={assignSaving}
            className="flex-1 text-sm font-semibold text-zinc-800 border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 bg-white disabled:opacity-50">
            <option value="">— Atanmamış —</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>
      )}

      {/* Detay tablosu */}
      <div className="mx-4 mt-4 mb-6">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Detaylar</p>

        {/* Tablo başlığı */}
        <div className="bg-zinc-800 rounded-t-xl grid grid-cols-[1fr_auto] gap-x-2 px-3 py-2">
          <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">Tarih / Açıklama</p>
          <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider text-right w-20">Tutar</p>
        </div>

        <div className="rounded-b-xl overflow-hidden border border-zinc-200 divide-y divide-zinc-100 bg-white">
          {fetchError && <div className="px-4 py-3 text-sm text-red-600 bg-red-50">{fetchError}</div>}

          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-400">Yükleniyor…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">Henüz işlem yok</div>
          ) : rows.map((row, i) => {
            const bal = row.runningBalance;

            if (row.kind === "payment") {
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-2.5 items-start bg-emerald-50">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">TAHSİLAT</span>
                      <p className="text-[10px] text-zinc-400">{fmtDate(row.date)}</p>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800">{row.label}</p>
                    {row.createdBy && <p className="text-[10px] text-zinc-400">{row.createdBy}</p>}
                    {isAdmin && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => openEditPayment(row)} className="text-[10px] font-bold text-sky-600 hover:text-sky-800">Düzenle</button>
                        <button onClick={() => handleDeletePayment(row)} className="text-[10px] font-bold text-red-400 hover:text-red-600">Sil</button>
                      </div>
                    )}
                  </div>
                  <div className="w-20 text-right pt-3">
                    <p className="text-xs font-bold text-emerald-600 tabular-nums">{fmt(row.amount)}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={row.id + i} className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-2.5 items-start">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full">SATIŞ</span>
                    <p className="text-[10px] text-zinc-400">{fmtDate(row.date)}</p>
                  </div>
                  <p className="text-xs font-semibold text-zinc-800">
                    {row.product}
                    <span className="font-normal text-zinc-400"> {row.qty} × {fmt(row.price)}</span>
                  </p>
                </div>
                <div className="w-20 text-right pt-4">
                  <p className="text-xs font-bold text-zinc-900 tabular-nums">{fmt(row.total)}</p>
                </div>
              </div>
            );
          })}

          {/* Genel toplam */}
          {!loading && rows.length > 0 && (
            <div className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-3 bg-zinc-800 items-center">
              <p className="text-[10px] font-black text-white uppercase tracking-wider">GENEL TOPLAM</p>
              <p className="text-xs font-black text-white tabular-nums text-right w-20">{fmt(summary.debit)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tahsilat modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-900">Tahsilat Al</h2>
                <p className="text-sm text-zinc-400">{customer?.full_name}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-700 text-2xl">×</button>
            </div>
            {isInDebt && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-red-600 font-semibold">Mevcut borç</p>
                <p className="text-sm font-black text-red-600">{fmt(summary.balance)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-2">Ödeme Yöntemi</label>
              <div className="grid grid-cols-3 gap-2">
                {PAY_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setPayType(pt.value)}
                    className={`h-11 rounded-xl text-sm font-bold transition-colors ${payType === pt.value ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Tahsilat Tutarı (₺)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-400">₺</span>
                <input type="number" min="0" step="1" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-zinc-200 text-2xl font-black focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Tahsilat Tarihi</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-400 text-sm font-semibold" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Açıklama (isteğe bağlı)</label>
              <input placeholder="Örn: Haziran ödemesi" value={payNote} onChange={e => setPayNote(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-400 text-sm" />
            </div>
            {payError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{payError}</p>}
            <button onClick={handleAddPayment} disabled={paying || !payAmount}
              className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-40">
              {paying ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* Tahsilat düzenleme modal */}
      {editPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-900">Tahsilat Düzenle</h2>
                <p className="text-sm text-zinc-400">{customer?.full_name}</p>
              </div>
              <button onClick={() => setEditPayment(null)} className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-700 text-2xl">×</button>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-2">Ödeme Yöntemi</label>
              <div className="grid grid-cols-3 gap-2">
                {PAY_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setEpType(pt.value)}
                    className={`h-11 rounded-xl text-sm font-bold transition-colors ${epType === pt.value ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Tutar (₺)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-400">₺</span>
                <input type="number" min="0" step="1" value={epAmount} onChange={e => setEpAmount(e.target.value)}
                  className="w-full h-14 pl-9 pr-4 rounded-2xl border-2 border-zinc-200 text-2xl font-black focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Tarih</label>
              <input type="date" value={epDate} onChange={e => setEpDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-400 text-sm font-semibold" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Açıklama</label>
              <input placeholder="Örn: Haziran ödemesi" value={epNote} onChange={e => setEpNote(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-400 text-sm" />
            </div>
            {epError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{epError}</p>}
            <button onClick={handleSaveEditPayment} disabled={epSaving || !epAmount}
              className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-40">
              {epSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
