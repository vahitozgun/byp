-- Payments tablosuna ödeme tipi alanı
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_type') THEN
    ALTER TABLE payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'nakit';
  END IF;
END $$;
