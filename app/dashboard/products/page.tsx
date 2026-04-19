"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Product = {
  id: string;
  dealer_id: string;
  name: string;
  unit: string;
  purchase_price: number;
  is_active?: boolean;
};

type FormState = {
  name: string;
  unit: string;
  purchase_price: string;
};

const emptyForm: FormState = {
  name: "",
  unit: "adet",
  purchase_price: "",
};

export default function ProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { dealer, isAdmin, isManager } = useAuth();
  const isPrivileged = isAdmin || isManager;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function fetchProducts() {
    if (!dealer?.id) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select("id, dealer_id, name, unit, purchase_price, is_active")
      .eq("dealer_id", dealer.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, [dealer?.id]);

  function openCreate() {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name ?? "",
      unit: product.unit ?? "adet",
      purchase_price: String(product.purchase_price ?? ""),
    });
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSave() {
    if (!dealer?.id) {
      setError("Bayi bilgisi bulunamadı.");
      return;
    }

    if (!form.name.trim() || !form.unit.trim()) {
      setError("Ürün adı ve birim zorunlu.");
      return;
    }

    // Managers can't set purchase_price; admins must provide a valid one
    let parsedPrice = 0;
    if (isAdmin) {
      parsedPrice = Number(form.purchase_price);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        setError("Geçerli bir alış fiyatı girin.");
        return;
      }
    } else {
      // manager: keep existing price or default to 0
      parsedPrice = editingProduct ? Number(editingProduct.purchase_price ?? 0) : 0;
    }

    setSaving(true);
    setError(null);

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name.trim(),
          unit: form.unit.trim(),
          purchase_price: parsedPrice,
        })
        .eq("id", editingProduct.id);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("products").insert({
        dealer_id: dealer.id,
        name: form.name.trim(),
        unit: form.unit.trim(),
        purchase_price: parsedPrice,
        is_active: true,
      });

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    await fetchProducts();
    setSaving(false);
    closeForm();
  }

  async function handleDelete(product: Product) {
    if (!confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) { setError(error.message); return; }
    await fetchProducts();
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchProducts();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Ürünler</h1>
          <p className="text-sm text-zinc-500 mt-1">{products.length} ürün</p>
        </div>

        {isPrivileged && (
          <button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl px-5 py-3 shadow-sm"
          >
            + Ekle
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-500">
            Yükleniyor...
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-400">
            Henüz ürün yok
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="text-2xl font-bold text-zinc-900">{product.name}</div>
                <div className="text-sm text-zinc-500 mt-1">
                  {product.unit}
                  {isAdmin && (
                    <>
                      {" · "}Maliyet: ₺{Number(product.purchase_price || 0).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  )}
                  {product.is_active === false && (
                    <span className="ml-2 text-red-500">· Pasif</span>
                  )}
                </div>
              </div>

              {isPrivileged && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEdit(product)}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
                  >
                    Düzenle
                  </button>

                  <button
                    onClick={() => toggleActive(product)}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
                  >
                    {product.is_active === false ? "Aktif et" : "Pasif yap"}
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(product)}
                      className="text-sm font-medium text-red-400 hover:text-red-600"
                    >
                      Sil
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && isPrivileged && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-zinc-900">
                {editingProduct ? "Ürünü Düzenle" : "Yeni Ürün"}
              </h2>
              <button
                onClick={closeForm}
                className="text-zinc-400 hover:text-zinc-700 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-1">
                  Ürün adı
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Örn. LPG 12 kg Tüp"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-1">
                  Birim
                </label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
                  placeholder="adet"
                  className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="text-sm font-semibold text-zinc-700 block mb-1">
                    Alış fiyatı
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, purchase_price: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full h-12 px-4 rounded-2xl border-2 border-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : editingProduct ? "Değişiklikleri Kaydet" : "Ürün Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}