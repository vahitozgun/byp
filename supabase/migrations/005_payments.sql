-- Satış tablosuna ödeme alanları ekle (IF NOT EXISTS ile güvenli)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='payment_type') THEN
    ALTER TABLE sales ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'nakit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='paid_amount') THEN
    ALTER TABLE sales ADD COLUMN paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    UPDATE sales SET paid_amount = total_amount WHERE paid_amount = 0;
  END IF;
END $$;

-- Müşteri borç ödemelerini tutan tablo
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id    UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments: dealer read') THEN
    CREATE POLICY "payments: dealer read"   ON payments FOR SELECT  USING (dealer_id = auth_dealer_id());
    CREATE POLICY "payments: dealer insert" ON payments FOR INSERT  WITH CHECK (dealer_id = auth_dealer_id() AND created_by = auth.uid());
    CREATE POLICY "payments: admin update"  ON payments FOR UPDATE  USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
    CREATE POLICY "payments: admin delete"  ON payments FOR DELETE  USING (dealer_id = auth_dealer_id() AND is_admin());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
