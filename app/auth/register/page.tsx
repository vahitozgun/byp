"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    dealerName: "", dealerPhone: "",
    fullName: "", email: "", password: "", passwordConfirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.passwordConfirm) {
      setError("Şifreler eşleşmiyor."); return;
    }
    if (form.password.length < 6) {
      setError("Şifre en az 6 karakter olmalı."); return;
    }

    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealerName: form.dealerName,
        dealerPhone: form.dealerPhone,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 16l6 6 14-12" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-xl font-black text-zinc-900">Kayıt Başarılı!</p>
          <p className="text-sm text-zinc-500 mt-1">Bayiniz oluşturuldu. Giriş yapabilirsiniz.</p>
        </div>
        <button onClick={() => router.push("/auth/login")}
          className="h-12 w-full bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600">
          Giriş Yap
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-6 gap-3">
        <Image src="/logo.png" alt="Logo" width={64} height={64} />
        <div className="text-center">
          <h1 className="text-2xl font-black text-zinc-900">Bayi Kaydı</h1>
          <p className="text-sm text-zinc-500 mt-1">Yeni bir bayi hesabı oluşturun</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Bayi bilgileri */}
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Bayi Bilgileri</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">
                Bayi Adı <span className="text-red-400">*</span>
              </label>
              <input required value={form.dealerName} onChange={set("dealerName")}
                placeholder="Örn: Ankara LPG Bayii"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">Telefon</label>
              <input value={form.dealerPhone} onChange={set("dealerPhone")} type="tel"
                placeholder="05XX XXX XX XX"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        </div>

        {/* Admin bilgileri */}
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Yönetici Bilgileri</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">
                Ad Soyad <span className="text-red-400">*</span>
              </label>
              <input required value={form.fullName} onChange={set("fullName")}
                placeholder="Ad Soyad"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">
                E-posta <span className="text-red-400">*</span>
              </label>
              <input required type="email" value={form.email} onChange={set("email")}
                placeholder="siz@ornek.com"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">
                Şifre <span className="text-red-400">*</span>
              </label>
              <input required type="password" value={form.password} onChange={set("password")}
                placeholder="En az 6 karakter"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 block mb-1">
                Şifre Tekrar <span className="text-red-400">*</span>
              </label>
              <input required type="password" value={form.passwordConfirm} onChange={set("passwordConfirm")}
                placeholder="Şifrenizi tekrar girin"
                className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="h-12 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50">
          {loading ? "Kayıt oluşturuluyor…" : "Bayi Kaydı Oluştur"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Hesabınız var mı?{" "}
          <Link href="/auth/login" className="font-bold text-amber-600 hover:text-amber-700">Giriş yapın</Link>
        </p>
      </form>
    </div>
  );
}
