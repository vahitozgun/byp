-- Müşteri tablosuna ek alanlar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_name') THEN
    ALTER TABLE customers ADD COLUMN business_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='city') THEN
    ALTER TABLE customers ADD COLUMN city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='district') THEN
    ALTER TABLE customers ADD COLUMN district TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='neighborhood') THEN
    ALTER TABLE customers ADD COLUMN neighborhood TEXT;
  END IF;
END $$;
