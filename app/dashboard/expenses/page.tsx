"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmt } from "@/lib/format";

const CATEGORIES = ["Yemek", "Yakıt", "Tamir", "Diğer Giderler"];

const DOT_COLORS: Record<string, string> = {
  Yemek: "bg-orange-400",
  Yakıt: "bg-yellow-400",
  Tamir: "bg-blue-400",
  "Diğer Giderler": "bg-zinc-400",
};

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, dealer, isAdmin } = useAuth();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ category: "Yemek", customCategory: "", amount: "" });

  async function fetchExpenses() {
    setLoading(true);
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const { data } = await supabase
      .from("expenses")
      .select("id, expense_date, category, description, amount, creator:users!created_by(full_name)")
      .gte("expense_date", from)
      .order("expense_date", { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchExpenses(); }, []);

  function openModal() {
    setForm({ category: "Yemek", customCategory: "", amount: "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    const amount = Number(form.amount);
    const finalCategory = form.category === "Diğer Giderler"
      ? (form.customCategory.trim() || "Diğer Giderler")
      : form.category;

    if (!amount || amount <= 0) { setError("Geçerli bir tutar girin."); return; }
    if (!dealer?.id) { setError("Bayi bilgisi bulunamadı."); return; }

    setSaving(true);
    setError("");
    const today = new Date().toISOString().split("T")[0];
    const { error: dbError } = await supabase.from("expenses").insert({
      dealer_id: dealer.id,
      category: finalCategory,
      amount,
      expense_date: today,
      created_by: user?.id,
    });
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    setShowModal(false);
    fetchExpenses();
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">Giderler</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Bu ay: {fmt(total)}</p>
          </div>
          <button onClick={openModal} className="h-9 px-4 bg-amber-500 text-white text-sm font-bold rounded-xl">
            + Ekle
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-400">Yükleniyor...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 bg-white rounded-2xl border border-zinc-200 px-4 py-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_COLORS[e.category] ?? "bg-zinc-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{e.category}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(e.expense_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                    {isAdmin && e.creator ? ` · ${e.creator.full_name}` : ""}
                  </p>
                </div>
                <p className="text-sm font-black text-red-500 tabular-nums flex-shrink-0">-{fmt(Number(e.amount))}</p>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-zinc-200 h-32 flex items-center justify-center">
                <p className="text-sm text-zinc-400">Bu ay gider kaydı yok</p>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-zinc-900">Gider Ekle</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none">×</button>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Gider Türü</label>
              <select
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value, customCategory: "" }))}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500 bg-white"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {form.category === "Diğer Giderler" && (
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-1">Kalem Adı</label>
                <input
                  placeholder="Gider kalemini yazın..."
                  value={form.customCategory}
                  onChange={(e) => setForm((s) => ({ ...s, customCategory: e.target.value }))}
                  className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Tutar (₺)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
