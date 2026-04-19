"use client";
import { useAuth } from "@/hooks/useAuth";
export function useRole() {
  const { isAdmin, isManager, isSalesRep, profile } = useAuth();
  const isPrivileged = isAdmin || isManager;
  return { isAdmin, isManager, isPrivileged, isSalesRep, canCreateSale: isAdmin || isManager || isSalesRep, canManageProducts: isPrivileged, canManageCustomers: isPrivileged, canManageExpenses: isPrivileged, dealerId: profile?.dealer_id ?? null };
}
