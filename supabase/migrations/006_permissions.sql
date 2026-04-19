-- Admin: tüm satışları güncelleyebilir ve silebilir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='sales: admin update') THEN
    CREATE POLICY "sales: admin update" ON sales FOR UPDATE
      USING (dealer_id = auth_dealer_id() AND is_admin())
      WITH CHECK (dealer_id = auth_dealer_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='sales: admin delete') THEN
    CREATE POLICY "sales: admin delete" ON sales FOR DELETE
      USING (dealer_id = auth_dealer_id() AND is_admin());
  END IF;

  -- Temsilci: sadece bugüne ait kendi satışlarını güncelleyebilir
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='sales: rep update today') THEN
    CREATE POLICY "sales: rep update today" ON sales FOR UPDATE
      USING (
        dealer_id = auth_dealer_id()
        AND sales_rep_id = auth.uid()
        AND sale_date = CURRENT_DATE
      )
      WITH CHECK (
        dealer_id = auth_dealer_id()
        AND sales_rep_id = auth.uid()
        AND sale_date = CURRENT_DATE
      );
  END IF;
END $$;

-- Temsilci: müşteri ekleyebilir ve görebilir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers: rep select') THEN
    CREATE POLICY "customers: rep select" ON customers FOR SELECT
      USING (dealer_id = auth_dealer_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers: rep insert') THEN
    CREATE POLICY "customers: rep insert" ON customers FOR INSERT
      WITH CHECK (dealer_id = auth_dealer_id());
  END IF;
END $$;
