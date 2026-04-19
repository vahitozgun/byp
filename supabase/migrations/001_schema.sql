-- ============================================================
-- 001_schema.sql  — Run first in Supabase SQL editor
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'sales_rep');

CREATE TABLE dealers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dealer_id  UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role       user_role NOT NULL DEFAULT 'sales_rep',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id      UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  unit           TEXT NOT NULL DEFAULT 'cylinder',
  purchase_price NUMERIC(10,2) NOT NULL CHECK (purchase_price >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dealer_id, name)
);

CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id  UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row = one product sale (no line items)
CREATE TABLE sales (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id              UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  sales_rep_id           UUID NOT NULL REFERENCES users(id),
  customer_id            UUID NOT NULL REFERENCES customers(id),
  product_id             UUID NOT NULL REFERENCES products(id),
  sale_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity               NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  sale_price             NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0),
  purchase_price_at_sale NUMERIC(10,2) NOT NULL CHECK (purchase_price_at_sale >= 0),
  total_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost             NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id    UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id),
  category     TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-compute totals on every insert/update
CREATE OR REPLACE FUNCTION compute_sale_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_amount := NEW.quantity * NEW.sale_price;
  NEW.total_cost   := NEW.quantity * NEW.purchase_price_at_sale;
  NEW.profit       := NEW.total_amount - NEW.total_cost;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_sale_totals
  BEFORE INSERT OR UPDATE OF quantity, sale_price, purchase_price_at_sale
  ON sales FOR EACH ROW EXECUTE FUNCTION compute_sale_totals();

-- Indexes
CREATE INDEX idx_users_dealer      ON users(dealer_id);
CREATE INDEX idx_products_dealer   ON products(dealer_id) WHERE is_active = TRUE;
CREATE INDEX idx_customers_dealer  ON customers(dealer_id) WHERE is_active = TRUE;
CREATE INDEX idx_sales_dealer      ON sales(dealer_id);
CREATE INDEX idx_sales_rep         ON sales(sales_rep_id);
CREATE INDEX idx_sales_customer    ON sales(customer_id);
CREATE INDEX idx_sales_product     ON sales(product_id);
CREATE INDEX idx_sales_date        ON sales(dealer_id, sale_date DESC);
CREATE INDEX idx_expenses_dealer   ON expenses(dealer_id, expense_date DESC);

-- Most critical index: powers the "last sale price" lookup
CREATE INDEX idx_last_sale
  ON sales(customer_id, product_id, sale_date DESC, created_at DESC);
