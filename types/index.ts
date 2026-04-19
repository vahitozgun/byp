export type UserRole = "admin" | "manager" | "sales_rep";

export interface Dealer {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  dealer_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  dealer_id: string;
  name: string;
  description: string | null;
  unit: string;
  purchase_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  dealer_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Sale {
  id: string;
  dealer_id: string;
  sales_rep_id: string;
  customer_id: string;
  product_id: string;
  sale_date: string;
  quantity: number;
  sale_price: number;
  purchase_price_at_sale: number;
  total_amount: number;
  total_cost: number;
  profit: number;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  dealer_id: string;
  created_by: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface AuthContextValue {
  user: import("@supabase/supabase-js").User | null;
  profile: UserProfile | null;
  dealer: Dealer | null;
  isAdmin: boolean;
  isManager: boolean;
  isSalesRep: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}
