"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8l12 9 12-9M4 8h24v16H4z"/>
          </svg>
        </div>
        <div>
          <p className="text-xl font-black text-zinc-900">E-posta Gönderildi</p>
          <p className="text-sm text-zinc-500 mt-1">
            <span className="font-semibold">{email}</span> adresine şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.
          </p>
        </div>
        <Link href="/auth/login"
          className="h-12 w-full bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center hover:bg-amber-600">
          Giriş Sayfasına Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image src="/logo.png" alt="Logo" width={64} height={64} />
        <div className="text-center">
          <h1 className="text-2xl font-black text-zinc-900">Şifremi Unuttum</h1>
          <p className="text-sm text-zinc-500 mt-1">E-postanıza sıfırlama bağlantısı göndereceğiz</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-semibold text-zinc-700 block mb-1">E-posta</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="siz@ornek.com"
            className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="h-12 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50">
          {loading ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
        </button>

        <Link href="/auth/login"
          className="text-center text-sm text-zinc-500 hover:text-zinc-700">
          ← Giriş sayfasına dön
        </Link>
      </form>
    </div>
  );
}
