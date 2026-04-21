import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { fmt, fmtDate } from "@/lib/format";
import { ExportButton } from "@/components/ExportButton";

export const metadata: Metadata = { title: "Ana Sayfa" };
export const revalidate = 0;

type SaleGroup = {
  key: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  salesRep: string;
  items: { name: string; qty: number; price: number; total: number; notes: string | null }[];
  totalAmount: number;
  totalPaid: number;
  totalProfit: number;
};

type RepGroup = {
  repId: string;
  repName: string;
  products: { name: string; qty: number; total: number }[];
  totalAmount: number;
  nakit: number;
  krediKarti: number;
  havale: number;
  borc: number;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("users").select("role, full_name").eq("id", user.id).single();
  const today = new Date().toISOString().split("T")[0];
  const isAdmin   = profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const isPrivileged = isAdmin || isManager;

  const [summaryRes, fullRes, expensesRes, paymentsRes] = await Promise.all([
    supabase.from("sales").select("total_amount, paid_amount, payment_type, profit, sales_rep_id").eq("sale_date", today),
    supabase.from("sales")
      .select("id, sale_date, quantity, sale_price, total_amount, paid_amount, payment_type, profit, notes, sales_rep_id, customer_id, customer:customers(full_name), product:products(name), sales_rep:users!sales_rep_id(full_name)")
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("expenses").select("amount, category, description").eq("expense_date", today),
    supabase.from("payments")
      .select("id, customer_id, amount, payment_type, created_by, customer:customers(full_name), creator:users!created_by(full_name)")
      .eq("payment_date", today),
  ]);

  const allSales = summaryRes.data ?? [];
  const scopedSales = isPrivileged ? allSales : allSales.filter(s => s.sales_rep_id === user.id);
  const revenue = scopedSales.reduce((s, r) => s + Number(r.total_amount), 0);
  const grossProfit = scopedSales.reduce((s, r) => s + Number(r.profit), 0);
  const expenses = (expensesRes.data ?? []) as { amount: number; category: string; description: string | null }[];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = grossProfit - totalExpenses;

  const nakit      = scopedSales.filter(r => r.payment_type === "nakit").reduce((s, r) => s + Number(r.paid_amount ?? r.total_amount), 0);
  const krediKarti = scopedSales.filter(r => r.payment_type === "kredi_karti").reduce((s, r) => s + Number(r.paid_amount ?? r.total_amount), 0);
  const havale     = scopedSales.filter(r => r.payment_type === "havale").reduce((s, r) => s + Number(r.paid_amount ?? r.total_amount), 0);
  const borc       = scopedSales.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount ?? r.total_amount)), 0);

  const rawSales: any[] = fullRes.data ?? [];

  // Temsilci bazlı gruplama (admin/yönetici için — bugünün satışları)
  const repMap = new Map<string, RepGroup>();
  const todaySales = rawSales.filter(s => s.sale_date === today);

  for (const s of todaySales) {
    const repId = s.sales_rep_id ?? "unknown";
    const repName = s.sales_rep?.full_name ?? "Bilinmiyor";
    if (!repMap.has(repId)) repMap.set(repId, { repId, repName, products: [], totalAmount: 0, nakit: 0, krediKarti: 0, havale: 0, borc: 0 });
    const g = repMap.get(repId)!;
    const productName = s.product?.name ?? "—";
    const qty = Number(s.quantity);
    const total = Number(s.total_amount);
    const paid = Number(s.paid_amount ?? s.total_amount) || 0;
    const existing = g.products.find(p => p.name === productName);
    if (existing) { existing.qty += qty; existing.total += total; }
    else g.products.push({ name: productName, qty, total });
    g.totalAmount += total;
    if (s.payment_type === "nakit")            g.nakit      += paid;
    else if (s.payment_type === "kredi_karti") g.krediKarti += paid;
    else if (s.payment_type === "havale")      g.havale     += paid;
    g.borc += Math.max(0, total - paid);
  }

  const repGroups = Array.from(repMap.values());

  // Bugünkü tahsilatlar — temsilci için, müşteri + tahsilatçı bazında
  type CollectionEntry = { customerId: string; customerName: string; collectorName: string; paid: number; nakit: number; krediKarti: number; havale: number; borc: number };
  const collectionList: CollectionEntry[] = [];

  // Kaynak 1: satışlardaki paid_amount (tahsilatçı = sales_rep)
  const todayRepSales = rawSales.filter(s => s.sale_date === today && (!isPrivileged ? s.sales_rep_id === user.id : false));
  const salesCollMap = new Map<string, CollectionEntry>(); // key: customerId_repId
  for (const s of todayRepSales) {
    const paid = Number(s.paid_amount ?? 0);
    if (paid <= 0 && Number(s.total_amount) <= 0) continue;
    const key = `${s.customer_id}_${s.sales_rep_id ?? ""}`;
    if (!salesCollMap.has(key)) salesCollMap.set(key, {
      customerId: s.customer_id, customerName: s.customer?.full_name ?? "—",
      collectorName: s.sales_rep?.full_name ?? "", paid: 0, nakit: 0, krediKarti: 0, havale: 0, borc: 0,
    });
    const row = salesCollMap.get(key)!;
    row.paid += paid;
    row.borc += Math.max(0, Number(s.total_amount) - paid);
    if (s.payment_type === "nakit")            row.nakit       += paid;
    else if (s.payment_type === "kredi_karti") row.krediKarti  += paid;
    else if (s.payment_type === "havale")      row.havale      += paid;
  }
  collectionList.push(...Array.from(salesCollMap.values()).filter(c => c.paid > 0 || c.borc > 0));

  // Kaynak 2: payments tablosu (tahsilatçı = created_by)
  const rawPayments: any[] = paymentsRes.data ?? [];
  const payCollMap = new Map<string, CollectionEntry>(); // key: customerId_creatorId
  for (const p of rawPayments) {
    const creatorName = (p.creator as any)?.full_name ?? "Bilinmiyor";
    const key = `pay_${p.customer_id}_${creatorName}`;
    if (!payCollMap.has(key)) payCollMap.set(key, {
      customerId: p.customer_id, customerName: (p.customer as any)?.full_name ?? "—",
      collectorName: creatorName, paid: 0, nakit: 0, krediKarti: 0, havale: 0, borc: 0,
    });
    const row = payCollMap.get(key)!;
    const amount = Number(p.amount) || 0;
    row.paid += amount;
    if (p.payment_type === "nakit")            row.nakit      += amount;
    else if (p.payment_type === "kredi_karti") row.krediKarti += amount;
    else if (p.payment_type === "havale")      row.havale     += amount;
  }
  collectionList.push(...Array.from(payCollMap.values()).filter(c => c.paid > 0));

  const todayCollections = collectionList;

  // Müşteri + gün bazlı gruplama (temsilci için — son satışlar)
  const groupMap = new Map<string, SaleGroup>();
  const repSales = isPrivileged ? rawSales : rawSales.filter(s => s.sales_rep_id === user.id);
  for (const s of repSales.slice(0, 50)) {
    const key = `${s.customer_id}_${s.sale_date}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key, customerId: s.customer_id,
        customerName: s.customer?.full_name ?? "—",
        saleDate: s.sale_date,
        salesRep: s.sales_rep?.full_name ?? "",
        items: [], totalAmount: 0, totalPaid: 0, totalProfit: 0,
      });
    }
    const g = groupMap.get(key)!;
    const paid = Number(s.paid_amount ?? s.total_amount) || 0;
    g.items.push({ name: s.product?.name ?? "—", qty: Number(s.quantity), price: Number(s.sale_price), total: Number(s.total_amount), notes: s.notes ?? null });
    g.totalAmount  += Number(s.total_amount);
    g.totalPaid    += paid;
    g.totalProfit  += Number(s.profit ?? 0);
  }
  const groups = Array.from(groupMap.values()).slice(0, 10);

  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <div className="px-4 py-4 space-y-4 pb-24">

      {/* Selamlama */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
            {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="text-xl font-black text-zinc-900 mt-0.5">{greeting}, {firstName}</p>
        </div>
        {isPrivileged && <ExportButton />}
      </div>

      {/* Bugünün istatistikleri */}
      <div className={`grid gap-2.5 ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
        {[
          { label: "Satış", value: String(scopedSales.length), accent: false },
          ...(isAdmin ? [{ label: "Ciro", value: fmt(revenue), accent: false }] : []),
          ...(isAdmin ? [{ label: "Kar",  value: fmt(profit),  accent: true  }] : []),
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 bg-white ${c.accent ? "border-amber-200" : "border-zinc-200"}`}>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className={`text-2xl font-black tabular-nums ${c.accent ? "text-amber-600" : "text-zinc-900"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Ciro dağılımı — sadece admin */}
      {isAdmin && revenue > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Ciro Dağılımı</p>
          <div className="space-y-1.5">
            {nakit > 0 && <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Nakit</p><p className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(nakit)}</p></div>}
            {krediKarti > 0 && <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Kredi Kartı</p><p className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(krediKarti)}</p></div>}
            {havale > 0 && <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Havale / EFT</p><p className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(havale)}</p></div>}
            {borc > 0 && <div className="flex items-center justify-between border-t border-zinc-100 pt-1.5"><p className="text-xs font-semibold text-red-500">Borç</p><p className="text-sm font-bold text-red-500 tabular-nums">{fmt(borc)}</p></div>}
            {expenses.length > 0 && (
              <div className="border-t border-zinc-100 pt-1.5 space-y-1">
                {expenses.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">{e.category}{e.description ? ` — ${e.description}` : ""}</p>
                    <p className="text-sm font-bold text-red-400 tabular-nums">−{fmt(Number(e.amount))}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-1">
                  <p className="text-xs font-semibold text-zinc-600">Net Kar</p>
                  <p className={`text-sm font-black tabular-nums ${profit >= 0 ? "text-amber-600" : "text-red-500"}`}>{fmt(profit)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Temsilci kartları — admin / yönetici */}
      {isPrivileged && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Bugünkü Temsilci Özeti</p>
            <Link href="/dashboard/sales-history" className="text-xs font-bold text-amber-600">Tümünü gör →</Link>
          </div>

          {repGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 flex flex-col items-center py-10 gap-2">
              <p className="text-sm text-zinc-400">Bugün henüz satış yok</p>
              <Link href="/dashboard/sales" className="text-sm font-bold text-amber-600">Satış ekle →</Link>
            </div>
          ) : repGroups.map(r => (
            <div key={r.repId} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">

              {/* Temsilci başlığı */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0">
                  {r.repName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{r.repName}</p>
                  <p className="text-xs text-zinc-400">{r.products.reduce((s, p) => s + p.qty, 0)} kalem · {r.products.length} ürün</p>
                </div>
                <p className="text-sm font-black text-zinc-900 tabular-nums flex-shrink-0">{fmt(r.totalAmount)}</p>
              </div>

              {/* Ürün özeti */}
              <div className="px-4 py-2.5 space-y-1 border-b border-zinc-100">
                {r.products.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-sm text-zinc-700 flex-1 truncate">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-zinc-400"> × {p.qty}</span>
                    </p>
                    <p className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(p.total)}</p>
                  </div>
                ))}
              </div>

              {/* Ödeme dağılımı */}
              <div className="px-4 py-3 space-y-1">
                {r.nakit > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Nakit</p>
                    <p className="text-xs font-bold text-zinc-700 tabular-nums">{fmt(r.nakit)}</p>
                  </div>
                )}
                {r.krediKarti > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Kredi Kartı</p>
                    <p className="text-xs font-bold text-zinc-700 tabular-nums">{fmt(r.krediKarti)}</p>
                  </div>
                )}
                {r.havale > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Havale / EFT</p>
                    <p className="text-xs font-bold text-zinc-700 tabular-nums">{fmt(r.havale)}</p>
                  </div>
                )}
                {r.borc > 0 && (
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-1 mt-1">
                    <p className="text-xs font-semibold text-red-500">Borç</p>
                    <p className="text-xs font-bold text-red-500 tabular-nums">{fmt(r.borc)}</p>
                  </div>
                )}
              </div>


            </div>
          ))}
        </div>
      )}

      {/* Bugünkü tahsilatlar — temsilci */}
      {!isPrivileged && todayCollections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Bugünkü Tahsilatlar</p>
          <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
            {todayCollections.map(c => (
              <Link key={c.customerId} href={`/dashboard/customers/${c.customerId}`}
                className="block px-4 py-3 hover:bg-zinc-50 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700 flex-shrink-0">
                      {c.customerName.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-bold text-zinc-900 truncate">{c.customerName}</p>
                  </div>
                  <p className="text-sm font-black text-emerald-600 tabular-nums flex-shrink-0">{fmt(c.paid)}</p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-10">
                  {c.collectorName && <span className="text-[11px] text-zinc-400 w-full mb-0.5">{c.collectorName}</span>}
                  {c.nakit > 0 && <span className="text-[11px] text-zinc-400">Nakit <span className="font-semibold text-zinc-600">{fmt(c.nakit)}</span></span>}
                  {c.krediKarti > 0 && <span className="text-[11px] text-zinc-400">Kredi Kartı <span className="font-semibold text-zinc-600">{fmt(c.krediKarti)}</span></span>}
                  {c.havale > 0 && <span className="text-[11px] text-zinc-400">Havale <span className="font-semibold text-zinc-600">{fmt(c.havale)}</span></span>}
                  {c.borc > 0 && <span className="text-[11px] text-red-400">Borç <span className="font-semibold">{fmt(c.borc)}</span></span>}
                </div>
              </Link>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50">
              <p className="text-xs font-semibold text-zinc-500">Toplam Tahsilat</p>
              <p className="text-sm font-black text-emerald-700 tabular-nums">{fmt(todayCollections.reduce((s, c) => s + c.paid, 0))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Son satışlar — temsilci için müşteri+gün gruplu */}
      {!isPrivileged && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Son Satışlar</p>
            <Link href="/dashboard/sales-history" className="text-xs font-bold text-amber-600">Tümünü gör →</Link>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 flex flex-col items-center py-10 gap-2">
              <p className="text-sm text-zinc-400">Henüz satış yok</p>
              <Link href="/dashboard/sales" className="text-sm font-bold text-amber-600">Satış ekle →</Link>
            </div>
          ) : groups.map(g => {
            const remaining = g.totalAmount - g.totalPaid;
            return (
              <div key={g.key} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0">
                    {g.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{g.customerName}</p>
                    <p className="text-xs text-zinc-400">{fmtDate(g.saleDate)}</p>
                  </div>
                  {remaining > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">Borçlu</span>
                  )}
                </div>
                <div className="px-4 py-2.5 space-y-1.5 border-b border-zinc-100">
                  {g.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-zinc-700 flex-1 truncate">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-zinc-400"> × {item.qty}</span>
                      </p>
                      <p className="text-sm font-bold text-zinc-900 tabular-nums flex-shrink-0">{fmt(item.total)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 px-4 py-3 gap-2">
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
                    <p className={`text-sm font-black tabular-nums ${remaining > 0 ? "text-red-500" : "text-zinc-300"}`}>
                      {remaining > 0 ? fmt(remaining) : "—"}
                    </p>
                  </div>
                </div>
                {g.items.some(i => i.notes) && (
                  <div className="px-4 pb-3">
                    <p className="text-[11px] text-zinc-400 italic">
                      {Array.from(new Set(g.items.filter(i => i.notes).map(i => i.notes))).join(" · ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Yeni satış butonu */}
      <Link href="/dashboard/sales" className="flex items-center justify-center w-full h-14 bg-amber-500 text-white font-black text-base rounded-2xl shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-[0.98] transition-transform">
        + Yeni Satış
      </Link>
    </div>
  );
}
