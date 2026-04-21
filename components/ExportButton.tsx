"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import * as XLSX from "xlsx";

export function ExportButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleExport() {
    setLoading(true);
    try {
      const [customersRes, salesRes, paymentsRes, expensesRes, productsRes] = await Promise.all([
        supabase.from("customers").select("full_name, business_name, phone, city, district, neighborhood, is_active, created_at").order("full_name"),
        supabase.from("sales").select("sale_date, quantity, sale_price, total_amount, paid_amount, payment_type, profit, notes, customer:customers(full_name), product:products(name), sales_rep:users!sales_rep_id(full_name)").order("sale_date", { ascending: false }),
        supabase.from("payments").select("payment_date, amount, payment_type, notes, customer:customers(full_name), creator:users!created_by(full_name)").order("payment_date", { ascending: false }),
        supabase.from("expenses").select("expense_date, category, description, amount, creator:users!created_by(full_name)").order("expense_date", { ascending: false }),
        supabase.from("products").select("name, unit, purchase_price, is_active").order("name"),
      ]);

      const fmt = (v: any) => v == null ? "" : v;
      const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("tr-TR") : "";
      const fmtMoney = (v: any) => v == null ? 0 : Number(v);
      const payLabel: Record<string, string> = { nakit: "Nakit", kredi_karti: "Kredi Kartı", havale: "Havale / EFT", borc: "Borç" };

      // Müşteriler
      const customers = (customersRes.data ?? []).map((c: any) => ({
        "Ad Soyad": fmt(c.full_name),
        "İşletme Adı": fmt(c.business_name),
        "Telefon": fmt(c.phone),
        "İl": fmt(c.city),
        "İlçe": fmt(c.district),
        "Mahalle": fmt(c.neighborhood),
        "Durum": c.is_active ? "Aktif" : "Pasif",
        "Kayıt Tarihi": fmtDate(c.created_at),
      }));

      // Satışlar
      const sales = (salesRes.data ?? []).map((s: any) => ({
        "Tarih": fmtDate(s.sale_date),
        "Müşteri": fmt((s.customer as any)?.full_name),
        "Ürün": fmt((s.product as any)?.name),
        "Temsilci": fmt((s.sales_rep as any)?.full_name),
        "Adet": fmtMoney(s.quantity),
        "Birim Fiyat (₺)": fmtMoney(s.sale_price),
        "Toplam (₺)": fmtMoney(s.total_amount),
        "Alınan (₺)": fmtMoney(s.paid_amount),
        "Kalan Borç (₺)": Math.max(0, fmtMoney(s.total_amount) - fmtMoney(s.paid_amount)),
        "Ödeme Türü": payLabel[s.payment_type] ?? fmt(s.payment_type),
        "Kar (₺)": fmtMoney(s.profit),
        "Not": fmt(s.notes),
      }));

      // Tahsilatlar
      const payments = (paymentsRes.data ?? []).map((p: any) => ({
        "Tarih": fmtDate(p.payment_date),
        "Müşteri": fmt((p.customer as any)?.full_name),
        "Tahsil Eden": fmt((p.creator as any)?.full_name),
        "Tutar (₺)": fmtMoney(p.amount),
        "Ödeme Türü": payLabel[p.payment_type] ?? fmt(p.payment_type),
        "Açıklama": fmt(p.notes),
      }));

      // Giderler
      const expenses = (expensesRes.data ?? []).map((e: any) => ({
        "Tarih": fmtDate(e.expense_date),
        "Kategori": fmt(e.category),
        "Açıklama": fmt(e.description),
        "Tutar (₺)": fmtMoney(e.amount),
        "Kaydeden": fmt((e.creator as any)?.full_name),
      }));

      // Ürünler
      const products = (productsRes.data ?? []).map((p: any) => ({
        "Ürün Adı": fmt(p.name),
        "Birim": fmt(p.unit),
        "Alış Fiyatı (₺)": fmtMoney(p.purchase_price),
        "Durum": p.is_active ? "Aktif" : "Pasif",
      }));

      // Excel oluştur
      const wb = XLSX.utils.book_new();

      const addSheet = (name: string, data: any[]) => {
        if (data.length === 0) data = [{}];
        const ws = XLSX.utils.json_to_sheet(data);
        // Kolon genişlikleri
        const cols = Object.keys(data[0] ?? {}).map(k => ({ wch: Math.max(k.length, 14) }));
        ws["!cols"] = cols;
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      addSheet("Müşteriler", customers);
      addSheet("Satışlar", sales);
      addSheet("Tahsilatlar", payments);
      addSheet("Giderler", expenses);
      addSheet("Ürünler", products);

      const tarih = new Date().toLocaleDateString("tr-TR").replace(/\./g, "-");
      XLSX.writeFile(wb, `BYP-Yedek-${tarih}.xlsx`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleExport} disabled={loading}
      className="flex items-center gap-2 h-10 px-4 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 transition-colors">
      {loading ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
          <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M5 7l3 3 3-3M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1"/>
        </svg>
      )}
      {loading ? "Hazırlanıyor…" : "Yedekle"}
    </button>
  );
}
