-- ============================================================
-- 002_rls.sql  — Run second in Supabase SQL editor
-- ============================================================

-- Helper: returns the dealer_id of the calling user
CREATE OR REPLACE FUNCTION public.auth_dealer_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT dealer_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: true if calling user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- Enable RLS on all tables
ALTER TABLE dealers   ENABLE ROW LEVEL SECURITY; ALTER TABLE dealers   FORCE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY; ALTER TABLE users     FORCE ROW LEVEL SECURITY;
ALTER TABLE products  ENABLE ROW LEVEL SECURITY; ALTER TABLE products  FORCE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY; ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE sales     ENABLE ROW LEVEL SECURITY; ALTER TABLE sales     FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses  ENABLE ROW LEVEL SECURITY; ALTER TABLE expenses  FORCE ROW LEVEL SECURITY;

-- dealers: read-only, no app mutations
CREATE POLICY "dealers: read own"      ON dealers FOR SELECT    USING (id = auth_dealer_id());
CREATE POLICY "dealers: no insert"     ON dealers FOR INSERT    WITH CHECK (FALSE);
CREATE POLICY "dealers: no update"     ON dealers FOR UPDATE    USING (FALSE);
CREATE POLICY "dealers: no delete"     ON dealers FOR DELETE    USING (FALSE);

-- users: admin manages all in dealer; rep sees only own row
CREATE POLICY "users: admin all"       ON users FOR ALL         USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
CREATE POLICY "users: rep own row"     ON users FOR SELECT      USING (id = auth.uid());

-- products: everyone in dealer can read; only admin writes
CREATE POLICY "products: dealer read"  ON products FOR SELECT   USING (dealer_id = auth_dealer_id());
CREATE POLICY "products: admin insert" ON products FOR INSERT   WITH CHECK (dealer_id = auth_dealer_id() AND is_admin());
CREATE POLICY "products: admin update" ON products FOR UPDATE   USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
CREATE POLICY "products: admin delete" ON products FOR DELETE   USING (dealer_id = auth_dealer_id() AND is_admin());

-- customers: everyone in dealer can read; only admin writes
CREATE POLICY "customers: dealer read" ON customers FOR SELECT  USING (dealer_id = auth_dealer_id());
CREATE POLICY "customers: admin write" ON customers FOR INSERT  WITH CHECK (dealer_id = auth_dealer_id() AND is_admin());
CREATE POLICY "customers: admin upd"   ON customers FOR UPDATE  USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
CREATE POLICY "customers: admin del"   ON customers FOR DELETE  USING (dealer_id = auth_dealer_id() AND is_admin());

-- sales: admin sees all; rep sees/creates only own
CREATE POLICY "sales: admin all"       ON sales FOR ALL         USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());
CREATE POLICY "sales: rep select own"  ON sales FOR SELECT      USING (dealer_id = auth_dealer_id() AND sales_rep_id = auth.uid());
CREATE POLICY "sales: rep insert own"  ON sales FOR INSERT      WITH CHECK (dealer_id = auth_dealer_id() AND sales_rep_id = auth.uid());

-- expenses: admin only; reps have zero visibility
CREATE POLICY "expenses: admin all"    ON expenses FOR ALL      USING (dealer_id = auth_dealer_id() AND is_admin()) WITH CHECK (dealer_id = auth_dealer_id());

-- Grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON dealers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, products, customers, sales, expenses TO authenticated;
GRANT EXECUTE ON FUNCTION auth_dealer_id(), is_admin() TO authenticated;
