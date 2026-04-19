"use client";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

export function TopBar() {
  const { dealer, profile, signOut, loading } = useAuth();
  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-zinc-200 flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <Image src="/logo.png" alt="Logo" width={36} height={36} className="flex-shrink-0" />
        {loading ? <div className="h-4 w-28 rounded bg-zinc-200 animate-pulse" /> : (
          <span className="text-sm font-bold text-zinc-900 truncate">{dealer?.name ?? "Bayi Yönetimi Platformu"}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!loading && profile && (
          <>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${profile.role === "admin" ? "bg-amber-100 text-amber-800" : profile.role === "manager" ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"}`}>
              {profile.role === "admin" ? "Admin" : profile.role === "manager" ? "Yönetici" : "Temsilci"}
            </span>
            <button onClick={signOut} title={`Çıkış yap (${profile.full_name})`}
              className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 hover:bg-zinc-200 transition-colors">
              {profile.full_name.charAt(0).toUpperCase()}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
