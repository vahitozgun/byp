-- ============================================================
-- 003_seed.sql  — Optional sample data
--
-- Steps:
-- 1. Go to Supabase → Authentication → Users → Add user
-- 2. Copy the new user's UUID
-- 3. Replace YOUR-AUTH-USER-UUID below with that UUID
-- 4. Run this file in the SQL editor
-- ============================================================

INSERT INTO dealers (id, name, phone, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Demo LPG Bayii', '0322 000 0000', 'demo@lpg.com');

-- Replace YOUR-AUTH-USER-UUID with the UUID from Supabase Auth
INSERT INTO users (id, dealer_id, full_name, role) VALUES
  ('80e4d0ab-875e-4caf-85d5-a5f47c587215', 'aaaaaaaa-0000-0000-0000-000000000001', 'Admin Kullanici', 'admin');

INSERT INTO products (dealer_id, name, unit, purchase_price) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'LPG 12 kg Tup',  'adet', 220.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'LPG 45 kg Tup',  'adet', 820.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Dogalgaz 5 kg',  'adet',  95.00);

INSERT INTO customers (dealer_id, full_name, phone) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Yilmaz Petrol',  '0532 111 2233'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Kaya Gaz Ltd.',   '0533 222 3344'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Demirci Enerji', '0534 333 4455');
