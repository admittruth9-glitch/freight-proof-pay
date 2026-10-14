import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "transporter";

export function useMyAccount() {
  return useQuery({
    queryKey: ["my-account"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      ]);
      const role: Role = roles?.some((r) => r.role === "admin") ? "admin" : "transporter";
      return { userId: uid, email: auth.user?.email ?? "", role, profile };
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const expenseCategories = ["Fuel", "Tolls", "Driver wages", "Loading / unloading", "Maintenance", "Parking", "Permits & taxes", "Food & stay", "Other"];
export const paymentMethods = ["Cash", "UPI", "Bank transfer", "Card", "Fuel card", "Cheque"];
