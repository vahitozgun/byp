"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email?: string;
}

export default function StaffPage() {
  const { dealer, isAdmin } = useAuth();
  const supabase = createClient();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "sales_rep",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const loadStaff = useCallback(async () => {
    if (!dealer?.id) return;
    setLoadingStaff(true);
    const { data } = await supabase
      .from("users")
      .select("id, full_name, role, is_active, created_at")
      .eq("dealer_id", dealer.id)
      .order("created_at", { ascending: false });
    setStaff((data as StaffMember[]) ?? []);
    setLoadingStaff(false);
  }, [dealer?.id, supabase]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  if (!isAdmin) {
    return <div className="p-6 text-xl font-bold">Yetkin yok</div>;
  }

  const handleCreate = async () => {
    setFormLoading(true);
    setFormMsg("");
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dealer_id: dealer?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormMsg("Hata: " + (data.error || "Bir hata oluştu"));
      } else {
        setFormMsg("Personel eklendi");
        setForm({ full_name: "", email: "", password: "", role: "sales_rep" });
        loadStaff();
      }
    } catch {
      setFormMsg("Hata: Sunucuya ulaşılamadı");
    }
    setFormLoading(false);
  };

  const handleToggleActive = async (member: StaffMember) => {
    await supabase
      .from("users")
      .update({ is_active: !member.is_active })
      .eq("id", member.id);
    loadStaff();
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetTarget.id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetMsg("Hata: " + (data.error || "Bir hata oluştu"));
      } else {
        setResetMsg("Şifre güncellendi");
        setNewPassword("");
        setTimeout(() => { setResetTarget(null); setResetMsg(""); }, 1500);
      }
    } catch {
      setResetMsg("Hata: Sunucuya ulaşılamadı");
    }
    setResetLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Personel Yönetimi</h1>

      {/* Personel Ekle Formu */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Yeni Personel Ekle</h2>
        <input
          placeholder="Ad Soyad"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="w-full border p-3 rounded-lg"
        />
        <input
          placeholder="E-posta"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border p-3 rounded-lg"
        />
        <input
          placeholder="Şifre (min 6 karakter)"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border p-3 rounded-lg"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full border p-3 rounded-lg"
        >
          <option value="sales_rep">Satış Temsilcisi</option>
          <option value="manager">Yönetici</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={handleCreate}
          disabled={formLoading}
          className="w-full bg-orange-500 text-white p-3 rounded-lg font-medium"
        >
          {formLoading ? "Ekleniyor..." : "Personel Ekle"}
        </button>
        {formMsg && (
          <p className={`text-sm ${formMsg.startsWith("Hata") ? "text-red-500" : "text-green-600"}`}>
            {formMsg}
          </p>
        )}
      </div>

      {/* Personel Listesi */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Personel Listesi</h2>
        {loadingStaff ? (
          <p className="text-gray-400 text-sm">Yükleniyor...</p>
        ) : staff.length === 0 ? (
          <p className="text-gray-400 text-sm">Henüz personel yok</p>
        ) : (
          staff.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{m.full_name}</p>
                <p className="text-xs text-gray-500">
                  {m.role === "admin" ? "Admin" : m.role === "manager" ? "Yönetici" : "Satış Temsilcisi"} ·{" "}
                  <span className={m.is_active ? "text-green-600" : "text-red-500"}>
                    {m.is_active ? "Aktif" : "Pasif"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setResetTarget(m); setResetMsg(""); setNewPassword(""); }}
                  className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded"
                >
                  Şifre
                </button>
                <button
                  onClick={() => handleToggleActive(m)}
                  className={`text-xs px-2 py-1 rounded ${
                    m.is_active
                      ? "bg-red-50 text-red-600"
                      : "bg-green-50 text-green-600"
                  }`}
                >
                  {m.is_active ? "Pasif Yap" : "Aktif Yap"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Şifre Sıfırlama Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-lg">
              Şifre Güncelle — {resetTarget.full_name}
            </h3>
            <input
              placeholder="Yeni şifre (min 6 karakter)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            {resetMsg && (
              <p className={`text-sm ${resetMsg.startsWith("Hata") ? "text-red-500" : "text-green-600"}`}>
                {resetMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setResetTarget(null); setNewPassword(""); setResetMsg(""); }}
                className="flex-1 border p-3 rounded-lg text-gray-600"
              >
                İptal
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || newPassword.length < 6}
                className="flex-1 bg-orange-500 text-white p-3 rounded-lg font-medium disabled:opacity-50"
              >
                {resetLoading ? "Güncelleniyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
