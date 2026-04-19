import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL eksik. .env.local'a ekleyin.");
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const migrations = `
-- 1. payments tablosuna customer_id ekle
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;

-- 2. payments payment_type kolonu (method yerine)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'nakit';

-- 3. customers yeni alanlar
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- 4. sales kolonları
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'nakit';

-- 5. payments RLS düzelt
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments: dealer read') THEN
    CREATE POLICY "payments: dealer read"   ON payments FOR SELECT  USING (dealer_id = auth_dealer_id());
    CREATE POLICY "payments: dealer insert" ON payments FOR INSERT  WITH CHECK (dealer_id = auth_dealer_id() AND created_by = auth.uid());
    CREATE POLICY "payments: admin update"  ON payments FOR UPDATE  USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
    CREATE POLICY "payments: admin delete"  ON payments FOR DELETE  USING (dealer_id = auth_dealer_id() AND is_admin());
  END IF;
END $$;

-- 6. customers rep erişim
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers: rep select') THEN
    CREATE POLICY "customers: rep select" ON customers FOR SELECT USING (dealer_id = auth_dealer_id());
    CREATE POLICY "customers: rep insert" ON customers FOR INSERT WITH CHECK (dealer_id = auth_dealer_id());
  END IF;
END $$;

-- 7. sales permissions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='sales: admin update') THEN
    CREATE POLICY "sales: admin update"    ON sales FOR UPDATE USING (dealer_id = auth_dealer_id() AND is_admin());
    CREATE POLICY "sales: admin delete"    ON sales FOR DELETE USING (dealer_id = auth_dealer_id() AND is_admin());
    CREATE POLICY "sales: rep update today" ON sales FOR UPDATE USING (dealer_id = auth_dealer_id() AND sales_rep_id = auth.uid() AND sale_date = CURRENT_DATE);
  END IF;
END $$;

-- Schema cache yenile
NOTIFY pgrst, 'reload schema';
`;

async function run() {
  console.log("Veritabanına bağlanıyor...");
  await client.connect();
  console.log("Bağlantı başarılı. Migration çalıştırılıyor...");

  const statements = migrations
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt + ";");
      ok++;
    } catch (e) {
      console.warn("ATILDI:", stmt.slice(0, 60), "→", e.message);
      fail++;
    }
  }

  await client.end();
  console.log(`\nTamamlandı: ${ok} başarılı, ${fail} atlandı.`);
}

run().catch(console.error);
