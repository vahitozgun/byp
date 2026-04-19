"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router   = useRouter();
  const [password, setPassword]               = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) { setError("Şifreler eşleşmiyor."); return; }
    if (password.length < 6)          { setError("Şifre en az 6 karakter olmalı."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(error.message); return; }
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image src="/logo.png" alt="Logo" width={64} height={64} />
        <div className="text-center">
          <h1 className="text-2xl font-black text-zinc-900">Yeni Şifre</h1>
          <p className="text-sm text-zinc-500 mt-1">Yeni şifrenizi belirleyin</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-semibold text-zinc-700 block mb-1">Yeni Şifre</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="En az 6 karakter"
            className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-zinc-700 block mb-1">Şifre Tekrar</label>
          <input
            type="password" required value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="Şifrenizi tekrar girin"
            className="w-full h-12 px-4 rounded-xl border-2 border-zinc-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="h-12 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50">
          {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
        </button>
      </form>
    </div>
  );
}
