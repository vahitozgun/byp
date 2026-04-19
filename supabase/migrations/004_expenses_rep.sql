-- Satış temsilcilerinin kendi giderlerini ekleyip görebilmesi için yeni politikalar
CREATE POLICY "expenses: rep insert own"
  ON expenses FOR INSERT
  WITH CHECK (dealer_id = auth_dealer_id() AND created_by = auth.uid());

CREATE POLICY "expenses: rep select own"
  ON expenses FOR SELECT
  USING (created_by = auth.uid());
