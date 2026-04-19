"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { fmt, fmtDateLong as fmtDate } from "@/lib/format";
import { PAY_LABEL, PAYMENT_TYPES } from "@/lib/constants";

const payLabel = (v: string | null) => PAY_LABEL[v ?? ""] ?? v ?? "—";
const PAY_TYPES = PAYMENT_TYPES;

type SaleRow = {
  id: string;
  sale_date: string;
  quantity: number;
  sale_price: number;
  total_amount: number;
  paid_amount: number | null;
  payment_type: string | null;
  profit: number;
  purchase_price_at_sale: number;
  notes: string | null;
  customer_id: string;
  customer: { full_name: string } | null;
  product: { name: string; unit: string } | null;
  sales_rep: { full_name: string } | null;
};

type Group = {
  key: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  salesRep: string;
  lines: SaleRow[];
  totalAmount: number;
  totalPaid: number;
  totalProfit: number;
  payTypes: Set<string>;
  canEdit: boolean;
};

export default function SalesHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin, isManager, profile } = useAuth();
  const isPrivileged = isAdmin || isManager;
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [groups, setGroups]         = useState<Group[]>([]);
  const [grandTotal, setGrandTotal] = useState({ amount: 0, paid: 0, profit: 0 });
  const [dayExpenses, setDayExpenses] = useState<{ amount: number; category: string; description: string | null }[]>([]);
  const [dayPayments, setDayPayments] = useState<{ amount: number; payment_type: string | null; customer: string; creator: string }[]>([]);
  const [loading, setLoading]       = useState(true);

  // Kalem düzenleme (sadece miktar + fiyat + not)
  const [editLine, setEditLine]   = useState<SaleRow | null>(null);
  const [eQty, setEQty]           = useState("");
  const [ePrice, setEPrice]       = useState("");
  const [eNotes, setENotes]       = useState("");
  const [eSaving, setESaving]     = useState(false);
  const [eError, setEError]       = useState("");

  // Ödeme düzenleme (grup seviyesinde)
  const [editPayGroup, setEditPayGroup] = useState<Group | null>(null);
  const [pPayType, setPPayType]         = useState("nakit");
  const [pPaid, setPPaid]               = useState("");
  const [pSaving, setPSaving]           = useState(false);
  const [pError, setPError]             = useState("");

  async function fetchSales() {
    setLoading(true);
    let q = supabase
      .from("sales")
      .select("id, sale_date, quantity, sale_price, total_amount, paid_amount, payment_type, profit, purchase_price_at_sale, notes, customer_id, customer:customers(full_name), product:products(name, unit), sales_rep:users!sales_rep_id(full_name)")
      .eq("sale_date", selectedDate)
      .order("created_at", { ascending: false });
    if (!isPrivileged && profile?.id) q = q.eq("sales_rep_id", profile.id);

    const [{ data }, expRes, payRes] = await Promise.all([
      q,
      isAdmin ? supabase.from("expenses").select("amount, category, description").eq("expense_date", selectedDate) : Promise.resolve({ data: [] }),
      isPrivileged ? supabase.from("payments").select("amount, payment_type, customer:customers(full_name), creator:users!created_by(full_name)").eq("payment_date", selectedDate) : Promise.resolve({ data: [] }),
    ]);

    const rows = (data ?? []) as unknown as SaleRow[];

    const map = new Map<string, Group>();
    for (const r of rows) {
      const key = `${r.customer_id}_${r.sale_date}`;
      if (!map.has(key)) {
        map.set(key, {
          key, customerId: r.customer_id,
          customerName: r.customer?.full_name ?? "—",
          saleDate: r.sale_date,
          salesRep: r.sales_rep?.full_name ?? "",
          lines: [], totalAmount: 0, totalPaid: 0, totalProfit: 0,
          payTypes: new Set(),
          canEdit: isPrivileged || r.sale_date === today,
        });
      }
      const g = map.get(key)!;
      g.lines.push(r);
      g.totalAmount += Number(r.total_amount) || 0;
      g.totalPaid   += Number(r.paid_amount ?? r.total_amount) || 0;
      g.totalProfit += Number(r.profit) || 0;
      if (r.payment_type) g.payTypes.add(r.payment_type);
    }

    const gs = Array.from(map.values());
    setGroups(gs);
    setGrandTotal({
      amount: gs.reduce((s, g) => s + g.totalAmount, 0),
      paid:   gs.reduce((s, g) => s + g.totalPaid, 0),
      profit: gs.reduce((s, g) => s + g.totalProfit, 0),
    });
    setDayExpenses((expRes.data ?? []) as { amount: number; category: string; description: string | null }[]);
    setDayPayments(((payRes.data ?? []) as any[]).map(p => ({
      amount: Number(p.amount) || 0,
      payment_type: p.payment_type ?? null,
      customer: (p.customer as any)?.full_name ?? "—",
      creator: (p.creator as any)?.full_name ?? "—",
    })));
    setLoading(false);
  }

  useEffect(() => { fetchSales(); }, [isAdmin, isManager, profile?.id, selectedDate]);

  // Kalem düzenleme: sadece miktar, fiyat, not
  function openEditLine(sale: SaleRow) {
    setEditLine(sale);
    setEQty(String(sale.quantity));
    setEPrice(String(sale.sale_price));
    setENotes(sale.notes ?? "");
    setEError("");
  }

  async function handleSaveLine() {
    if (!editLine) return;
    const qty   = parseFloat(eQty);
    const price = parseFloat(ePrice);
    if (!qty || qty <= 0 || !price || price <= 0) { setEError("Miktar ve fiyat gerekli."); return; }
    const totalAmount = qty * price;
    const newProfit   = (price - (editLine.purchase_price_at_sale ?? 0)) * qty;
    // paid_amount'u mevcut oranla güncelle
    const oldTotal = Number(editLine.total_amount) || 1;
    const oldPaid  = Number(editLine.paid_amount ?? editLine.total_amount) || 0;
    const newPaid  = Math.round((oldPaid / oldTotal) * totalAmount * 100) / 100;

    setESaving(true); setEError("");
    const { error } = await supabase.from("sales").update({
      quantity: qty, sale_price: price,
      total_amount: totalAmount, paid_amount: newPaid,
      profit: newProfit, notes: eNotes.trim() || null,
    }).eq("id", editLine.id);
    setESaving(false);
    if (error) { setEError(error.message); return; }
    setEditLine(null);
    fetchSales();
  }

  // Ödeme düzenleme: grup toplamına göre
  function openEditPay(group: Group) {
    setEditPayGroup(group);
    const firstPayType = Array.from(group.payTypes)[0] ?? "nakit";
    setPPayType(firstPayType);
    setPPaid(String(group.totalPaid));
    setPError("");
  }

  async function handleSavePay() {
    if (!editPayGroup) return;
    const total     = editPayGroup.totalAmount;
    const parsedPaid = parseFloat(pPaid);
    const newTotalPaid = isNaN(parsedPaid) ? (pPayType === "borc" ? 0 : total) : parsedPaid;

    setPSaving(true); setPError("");
    // Her kaleme orantılı dağıt
    const results = await Promise.all(
      editPayGroup.lines.map(line => {
        const ratio    = total > 0 ? Number(line.total_amount) / total : 1 / editPayGroup.lines.length;
        const linePaid = Math.round(ratio * newTotalPaid * 100) / 100;
        return supabase.from("sales").update({
          payment_type: pPayType,
          paid_amount: linePaid,
        }).eq("id", line.id);
      })
    );
    setPSaving(false);
    const err = results.find(r => r.error);
    if (err?.error) { setPError(err.error.message); return; }
    setEditPayGroup(null);
    fetchSales();
  }

  async function handleDeleteGroup(group: Group) {
    if (!isPrivileged) return;
    if (!confirm(`"${group.customerName}" — ${fmtDate(group.saleDate)} tarihli ${group.lines.length} satış silinsin mi?`)) return;
    await Promise.all(group.lines.map(l => supabase.from("sales").delete().eq("id", l.id)));
    fetchSales();
  }

  const pTotal   = editPayGroup?.totalAmount ?? 0;
  const pParsed  = parseFloat(pPaid);
  const pEffPaid = isNaN(pParsed) ? (pPayType === "borc" ? 0 : pTotal) : pParsed;
  const pDebt    = pTotal - pEffPaid;

  return (
    <div className="px-4 py-4 pb-24 space-y-3">

      {/* Başlık + Tarih seçici */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-black text-zinc-900 flex-shrink-0">Satış Geçmişi</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split("T")[0]); }}
            className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
          </button>
          <input type="date" value={selectedDate} max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-8 px-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-amber-400 bg-white" />
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); if (d.toISOString().split("T")[0] <= today) setSelectedDate(d.toISOString().split("T")[0]); }}
            disabled={selectedDate >= today}
            className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 disabled:opacity-30">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
          </button>
          {isPrivileged && groups.length > 0 && (
            <button onClick={() => window.print()}
              className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 active:bg-zinc-900 flex-shrink-0"
              title="Yazdır">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5V2h9v3M3 10H1V5h13v5h-2M3 10v3h9v-3M3 10h9"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      {selectedDate === today
        ? <p className="text-xs text-amber-600 font-semibold -mt-2">Bugün</p>
        : <p className="text-xs text-zinc-400 -mt-2">{fmtDate(selectedDate)}</p>}

      {/* Genel özet */}
      {groups.length > 0 && (() => {
        const totalExp = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
        const netProfit = grandTotal.profit - totalExp;
        return (
          <div className="space-y-2">
            <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="bg-white rounded-2xl border border-zinc-200 px-3 py-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Ciro</p>
                <p className="text-base font-black text-zinc-900 tabular-nums">{fmt(grandTotal.amount)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200 px-3 py-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Tahsilat</p>
                <p className="text-base font-black text-emerald-600 tabular-nums">{fmt(grandTotal.paid)}</p>
              </div>
              {isAdmin && (
                <div className="bg-white rounded-2xl border border-amber-200 px-3 py-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Net Kar</p>
                  <p className={`text-base font-black tabular-nums ${netProfit >= 0 ? "text-amber-600" : "text-red-500"}`}>{fmt(netProfit)}</p>
                </div>
              )}
            </div>
            {isAdmin && dayExpenses.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-200 px-3 py-3 space-y-1.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Giderler</p>
                {dayExpenses.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">{e.category}{e.description ? ` — ${e.description}` : ""}</p>
                    <p className="text-xs font-bold text-red-500 tabular-nums">−{fmt(Number(e.amount))}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-1">
                  <p className="text-xs font-semibold text-zinc-600">Brüt Kar</p>
                  <p className="text-xs font-bold text-zinc-500 tabular-nums">{fmt(grandTotal.profit)}</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Yükleniyor…</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <p className="text-sm text-zinc-400">{fmtDate(selectedDate)} tarihinde satış yok</p>
          {selectedDate === today && (
            <Link href="/dashboard/sales" className="h-10 px-5 bg-amber-500 text-white text-sm font-bold rounded-xl flex items-center">Satış ekle</Link>
          )}
        </div>
      ) : groups.map(g => {
        const remaining = g.totalAmount - g.totalPaid;
        const ptLabels  = Array.from(g.payTypes).map(payLabel).join(" / ");
        return (
          <div key={g.key} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">

            {/* Müşteri başlığı */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0">
                {g.customerName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{g.customerName}</p>
                <p className="text-xs text-zinc-400">
                  {fmtDate(g.saleDate)}
                  {isPrivileged && g.salesRep ? ` · ${g.salesRep}` : ""}
                  {ptLabels ? ` · ${ptLabels}` : ""}
                </p>
              </div>
              {remaining > 0.009 && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">Borçlu</span>
              )}
            </div>

            {/* Tablo başlığı */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-4 py-1.5 bg-zinc-50 border-b border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Kalem</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right w-10">Adet</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right w-16">Birim ₺</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right w-16">Tutar</p>
            </div>

            {/* Ürün kalemleri */}
            <div className="divide-y divide-zinc-50">
              {g.lines.map(line => (
                <div key={line.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-4 py-2.5 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{line.product?.name ?? "—"}</p>
                  </div>
                  <p className="text-sm text-zinc-600 text-right w-10 tabular-nums">{line.quantity}</p>
                  <p className="text-sm text-zinc-600 text-right w-16 tabular-nums">{fmt(line.sale_price)}</p>
                  <div className="text-right w-16">
                    <p className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(Number(line.total_amount))}</p>
                    {g.canEdit && (
                      <button onClick={() => openEditLine(line)}
                        className="text-[10px] font-semibold text-amber-600 hover:text-amber-800">
                        Düzenle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dip toplam + ödeme düzenle */}
            <div className="border-t border-zinc-200 px-4 py-3">
              <div className={`grid gap-x-2 mb-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Toplam</p>
                  <p className="text-sm font-black text-zinc-900 tabular-nums">{fmt(g.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Alınan</p>
                  <p className="text-sm font-black text-emerald-600 tabular-nums">{fmt(g.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Kalan</p>
                  <p className={`text-sm font-black tabular-nums ${remaining > 0.009 ? "text-red-500" : "text-zinc-300"}`}>
                    {remaining > 0.009 ? fmt(remaining) : "—"}
                  </p>
                </div>
                {isAdmin && (
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Kar</p>
                    <p className="text-sm font-black text-amber-600 tabular-nums">{fmt(g.totalProfit)}</p>
                  </div>
                )}
              </div>
              {/* Notlar */}
              {g.lines.some(l => l.notes) && (
                <div className="px-4 pb-2">
                  <p className="text-[11px] text-zinc-400 italic">
                    {Array.from(new Set(g.lines.filter(l => l.notes).map(l => l.notes))).join(" · ")}
                  </p>
                </div>
              )}

              {/* Ödeme + Sil butonları */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                {g.canEdit ? (
                  <button onClick={() => openEditPay(g)}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                    Ödemeyi Düzenle
                  </button>
                ) : <span />}
                {isAdmin && (
                  <button onClick={() => handleDeleteGroup(g)}
                    className="text-xs font-semibold text-red-400 hover:text-red-600">
                    Grubu Sil
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── YAZDIR ÇIKTISI ── */}
      {typeof document !== "undefined" && createPortal(
      <div id="print-report" style={{ display: "none", fontFamily: "monospace", fontSize: "12px", color: "#000" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>BAYİ YÖNETİM PLATFORMU</div>
          <div style={{ fontSize: "13px", marginTop: "2px" }}>GÜNLÜK SATIŞ RAPORU</div>
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            {new Date(selectedDate).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        {groups.map((g, gi) => {
          const remaining = g.totalAmount - g.totalPaid;
          return (
            <div key={g.key} style={{ marginBottom: "14px", pageBreakInside: "avoid" }}>
              <div style={{ fontWeight: "bold", fontSize: "13px", borderBottom: "1px solid #999", paddingBottom: "3px", marginBottom: "6px" }}>
                {gi + 1}. {g.customerName}
                {g.salesRep ? `  —  ${g.salesRep}` : ""}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px dashed #ccc" }}>
                    <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Ürün</th>
                    <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Adet</th>
                    <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Birim</th>
                    <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map(line => (
                    <tr key={line.id}>
                      <td style={{ padding: "2px 4px" }}>{line.product?.name ?? "—"}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px" }}>{line.quantity}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px" }}>{fmt(line.sale_price)}</td>
                      <td style={{ textAlign: "right", padding: "2px 4px", fontWeight: "bold" }}>{fmt(Number(line.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: "1px solid #000", marginTop: "4px", paddingTop: "4px", display: "flex", gap: "16px", justifyContent: "flex-end" }}>
                <span>Toplam: <b>{fmt(g.totalAmount)}</b></span>
                <span>Alınan: <b>{fmt(g.totalPaid)}</b></span>
                <span>Kalan Borç: <b style={{ color: remaining > 0 ? "#c00" : "#000" }}>{remaining > 0 ? fmt(remaining) : "—"}</b></span>
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: "2px solid #000", marginTop: "16px", paddingTop: "8px" }}>
          <table style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold", fontSize: "13px" }}>GENEL TOPLAM</td>
                <td style={{ textAlign: "right" }}>Ciro: <b>{fmt(grandTotal.amount)}</b></td>
                <td style={{ textAlign: "right" }}>Tahsilat: <b>{fmt(grandTotal.paid)}</b></td>
                <td style={{ textAlign: "right" }}>Kalan Borç: <b style={{ color: grandTotal.amount - grandTotal.paid > 0 ? "#c00" : "#000" }}>{fmt(grandTotal.amount - grandTotal.paid)}</b></td>
                {isAdmin && <td style={{ textAlign: "right" }}>Brüt Kar: <b>{fmt(grandTotal.profit)}</b></td>}
              </tr>
            </tbody>
          </table>

          {isPrivileged && dayPayments.length > 0 && (() => {
            const totalPay = dayPayments.reduce((s, p) => s + p.amount, 0);
            return (
              <div style={{ marginTop: "10px", borderTop: "1px dashed #999", paddingTop: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>TAHSİLATLAR</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px dashed #ccc" }}>
                      <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Müşteri</th>
                      <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Yapan</th>
                      <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Tür</th>
                      <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "normal", color: "#555" }}>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPayments.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: "2px 4px" }}>{p.customer}</td>
                        <td style={{ padding: "2px 4px" }}>{p.creator}</td>
                        <td style={{ padding: "2px 4px" }}>{PAY_LABEL[p.payment_type ?? ""] ?? p.payment_type ?? "—"}</td>
                        <td style={{ textAlign: "right", padding: "2px 4px", fontWeight: "bold" }}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid #000", fontWeight: "bold" }}>
                      <td colSpan={3} style={{ padding: "4px 4px" }}>TOPLAM TAHSİLAT</td>
                      <td style={{ textAlign: "right", padding: "4px 4px" }}>{fmt(totalPay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

          {isAdmin && dayExpenses.length > 0 && (() => {
            const totalExp = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
            const netProfit = grandTotal.profit - totalExp;
            return (
              <div style={{ marginTop: "10px", borderTop: "1px dashed #999", paddingTop: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>GİDERLER</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {dayExpenses.map((e, i) => (
                      <tr key={i}>
                        <td style={{ padding: "2px 4px" }}>{e.category}{e.description ? ` — ${e.description}` : ""}</td>
                        <td style={{ textAlign: "right", padding: "2px 4px", color: "#c00" }}>−{fmt(Number(e.amount))}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "1px solid #000", fontWeight: "bold" }}>
                      <td style={{ padding: "4px 4px" }}>NET KAR</td>
                      <td style={{ textAlign: "right", padding: "4px 4px", color: netProfit >= 0 ? "#000" : "#c00" }}>{fmt(netProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        <div style={{ marginTop: "24px", fontSize: "10px", color: "#888", textAlign: "center" }}>
          Yazdırılma tarihi: {new Date().toLocaleString("tr-TR")}
        </div>
      </div>
      , document.body)}

      {/* Kalem düzenleme modal (miktar + fiyat + not) */}
      {editLine && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-zinc-900">Kalemi Düzenle</h2>
                <p className="text-xs text-zinc-400">{editLine.product?.name}</p>
              </div>
              <button onClick={() => setEditLine(null)} className="w-9 h-9 flex items-center justify-center text-zinc-400 text-2xl">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1">Miktar</label>
                <input type="number" min="1" step="1" value={eQty} onChange={e => setEQty(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl border-2 border-zinc-200 text-base font-bold focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-1">Birim Fiyat (₺)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">₺</span>
                  <input type="number" min="0" step="0.01" value={ePrice} onChange={e => setEPrice(e.target.value)}
                    className="w-full h-12 pl-7 pr-3 rounded-xl border-2 border-zinc-200 text-base font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>
            </div>

            {(parseFloat(eQty)||0)*(parseFloat(ePrice)||0) > 0 && (
              <div className="bg-zinc-900 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Toplam</span>
                <span className="text-base font-black text-white tabular-nums">{fmt((parseFloat(eQty)||0)*(parseFloat(ePrice)||0))}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Not</label>
              <input placeholder="Not ekleyin…" value={eNotes} onChange={e => setENotes(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-400" />
            </div>

            {eError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{eError}</p>}
            <button onClick={handleSaveLine} disabled={eSaving}
              className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-40">
              {eSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* Ödeme düzenleme modal (grup toplamı) */}
      {editPayGroup && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-zinc-900">Ödemeyi Düzenle</h2>
                <p className="text-xs text-zinc-400">{editPayGroup.customerName} · Toplam {fmt(pTotal)}</p>
              </div>
              <button onClick={() => setEditPayGroup(null)} className="w-9 h-9 flex items-center justify-center text-zinc-400 text-2xl">×</button>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-2">Ödeme Tipi</label>
              <div className="grid grid-cols-3 gap-2">
                {PAY_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => { setPPayType(pt.value); setPPaid(String(pTotal.toFixed(0))); }}
                    className={`h-10 rounded-xl text-sm font-bold transition-colors ${pPayType === pt.value ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Alınan Ödeme (₺)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">₺</span>
                <input type="number" min="0" step="1"
                  placeholder={pPayType === "borc" ? "0" : String(pTotal.toFixed(0))}
                  value={pPaid} onChange={e => setPPaid(e.target.value)}
                  className="w-full h-14 pl-7 pr-3 rounded-xl border-2 border-zinc-200 text-xl font-black focus:outline-none focus:border-amber-400" />
              </div>
              {pTotal > 0 && (
                <p className={`text-xs font-semibold mt-1 px-1 ${pDebt > 0.009 ? "text-red-500" : "text-emerald-600"}`}>
                  {pDebt > 0.009 ? `Kalan borç: ${fmt(pDebt)}` : "Tam ödendi"}
                </p>
              )}
            </div>

            {pError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{pError}</p>}
            <button onClick={handleSavePay} disabled={pSaving}
              className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-40">
              {pSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
