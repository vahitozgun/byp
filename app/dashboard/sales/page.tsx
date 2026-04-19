import type { Metadata } from "next";
import { SalesScreen } from "@/components/sales/SalesScreen";
import Link from "next/link";

export const metadata: Metadata = { title: "New Sale" };

export default function SalesPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-zinc-200 px-5 py-3 flex-shrink-0 flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-700">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18l-6-7 6-7"/>
          </svg>
        </Link>
        <h1 className="text-xl font-black text-zinc-900">Yeni Satış</h1>
      </div>
      <div className="flex-1 overflow-y-auto relative">
        <SalesScreen />
      </div>
    </div>
  );
}
