export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

  try {
        const body = await req.json();

      const { email, password, full_name, role, dealer_id } = body;

      // Kontrol
      if (!email || !password || !full_name || !role || !dealer_id) {
              return NextResponse.json(
                { error: "Eksik alan var" },
                { status: 400 }
                      );
      }

      // 1. AUTH KULLANICI OLUŞTUR
      const { data: userData, error: authError } =
              await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
              });

      if (authError) {
              const msg = authError.message.includes("already been registered")
                ? "Bu e-posta adresi zaten kayıtlı. Supabase Dashboard → Authentication → Users bölümünden silin ve tekrar deneyin."
                        : authError.message;
              return NextResponse.json({ error: msg }, { status: 400 });
      }

      // 2. USERS TABLOSUNA EKLE
      const { error: dbError } = await supabaseAdmin.from("users").insert({
              id: userData.user.id,
              full_name,
              role,
              dealer_id,
      });

      if (dbError) {
              return NextResponse.json(
                { error: dbError.message },
                { status: 400 }
                      );
      }

      return NextResponse.json({ success: true });
  } catch (err) {
        return NextResponse.json(
          { error: "Sunucu hatası" },
          { status: 500 }
              );
  }
}
