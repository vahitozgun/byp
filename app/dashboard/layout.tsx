import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/contexts/AuthContext";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("users").select("id, is_active, role").eq("id", user.id).single();
  if (!profile || !profile.is_active) { await supabase.auth.signOut(); redirect("/auth/login"); }
  return (
    <AuthProvider>
      <div className="flex flex-col h-[100dvh]">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-zinc-50 pb-16">{children}</main>
        <BottomNav />
      </div>
    </AuthProvider>
  );
}
