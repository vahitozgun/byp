export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

  try {
        const { user_id, password } = await req.json();

      if (!user_id || !password || password.length < 6) {
              return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
              password,
      });

      if (error) {
              return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
  } catch {
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
