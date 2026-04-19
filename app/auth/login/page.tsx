"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    const cleanEmail = email.trim().toLowerCase();
    console.log("login start", cleanEmail);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    console.log("login result", { data, authError });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "E-posta veya şifre hatalı."
          : authError.message
      );
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  } catch (err) {
    console.error("LOGIN EXCEPTION:", err);
    setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu");
    setLoading(false);
  }
};

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image src="/logo.png" alt="Logo" width={72} height={72} />
        <div className="text-center">
          <h1 className="text-2xl font-black text-zinc-900">Bayi Yönetimi Platformu</h1>
          <p className="text-sm text-zinc-500 mt-1">Hesabınıza giriş yapın</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-zinc-700">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="siz@ornek.com"
            className="h-12 px-4 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-zinc-700">
            Şifre
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 px-4 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
            Şifremi unuttum
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-12 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 mt-6">
        Hesabınız yok mu?{" "}
        <Link href="/auth/register" className="font-bold text-amber-600 hover:text-amber-700">Bayi kaydı oluşturun</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm" />}>
      <LoginForm />
    </Suspense>
  );
}
