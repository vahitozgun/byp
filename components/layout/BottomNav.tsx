"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/hooks/useRole";

const ADMIN_NAV = [
  { label: "Ana Sayfa", href: "/dashboard", icon: "grid" },
  { label: "Ürünler", href: "/dashboard/products", icon: "box" },
  { label: "Müşteriler", href: "/dashboard/customers", icon: "users" },
  { label: "Satış", href: "/dashboard/sales", icon: "receipt" },
  { label: "Giderler", href: "/dashboard/expenses", icon: "wallet" },
  { label: "Personel", href: "/dashboard/staff", icon: "person" },
];
const REP_NAV = [
  { label: "Ana Sayfa",   href: "/dashboard",               icon: "grid"    },
  { label: "Müşteriler",  href: "/dashboard/customers",     icon: "users"   },
  { label: "Satış",       href: "/dashboard/sales",         icon: "receipt" },
  { label: "Giderler",    href: "/dashboard/expenses",      icon: "wallet"  },
];

function Icon({ name }: { name: string }) {
  if (name === "grid") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="8" height="8" rx="1.5"/><rect x="12" y="2" width="8" height="8" rx="1.5"/><rect x="2" y="12" width="8" height="8" rx="1.5"/><rect x="12" y="12" width="8" height="8" rx="1.5"/></svg>;
  if (name === "box") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8l8-5 8 5v9l-8 5-8-5V8z"/><path d="M3 8l8 5 8-5M11 13v9"/></svg>;
  if (name === "users") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="7" r="3"/><path d="M2 19c0-3.31 2.69-6 6-6s6 2.69 6 6"/><circle cx="16" cy="7" r="2.5"/><path d="M20 19c0-2.76-1.79-5.11-4.27-5.82"/></svg>;
  if (name === "receipt") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 2h14v18l-3-2-4 2-4-2-3 2V2z"/><line x1="7" y1="8" x2="15" y2="8"/><line x1="7" y1="12" x2="15" y2="12"/></svg>;
  if (name === "wallet") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="5" width="18" height="14" rx="2"/><path d="M2 9h18"/><circle cx="16" cy="14" r="1.5"/></svg>;
  if (name === "clock") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="8"/><polyline points="11 7 11 11 14 14"/></svg>;
  if (name === "person") return <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="7" r="4"/><path d="M3 20c0-4.42 3.58-8 8-8s8 3.58 8 8"/></svg>;
  return null;
}

export function BottomNav() {
  const pathname = usePathname();
  const { isPrivileged } = useRole();
  const navItems = isPrivileged ? ADMIN_NAV : REP_NAV;
  return (
    <nav className="flex-shrink-0 bg-white border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-14">
        {navItems.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors select-none ${isActive ? "text-amber-500" : "text-zinc-400 hover:text-zinc-600"}`}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
