import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const { dealerName, dealerPhone, fullName, email, password } = await req.json();

  if (!dealerName?.trim() || !fullName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Tüm zorunlu alanları doldurun." }, { status: 400 });
  }

  // 1. Auth kullanıcısı oluştur
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "Bu e-posta adresi zaten kayıtlı."
      : authError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  // 2. Bayi kaydı oluştur
  const { data: dealer, error: dealerError } = await supabaseAdmin
    .from("dealers")
    .insert({ name: dealerName.trim(), phone: dealerPhone?.trim() || null })
    .select("id")
    .single();

  if (dealerError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Bayi kaydı oluşturulamadı: " + dealerError.message }, { status: 500 });
  }

  // 3. Kullanıcı profili oluştur (admin)
  const { error: userError } = await supabaseAdmin
    .from("users")
    .insert({ id: userId, dealer_id: dealer.id, full_name: fullName.trim(), role: "admin" });

  if (userError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await supabaseAdmin.from("dealers").delete().eq("id", dealer.id);
    return NextResponse.json({ error: "Kullanıcı profili oluşturulamadı: " + userError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
