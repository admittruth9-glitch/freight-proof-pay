import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { expenseCategories, inr, paymentMethods, useMyAccount } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/transporter")({
  head: () => ({ meta: [{ title: "My expenses — FreightProof AI" }, { name: "robots", content: "noindex" }] }),
  component: TransporterPage,
});

const schema = z.object({
  trip_id: z.string().trim().min(1, "Enter a trip ID").max(60),
  category: z.string().min(1, "Choose a category"),
  amount: z.coerce.number().positive("Amount must be more than 0").max(100000000),
  expense_date: z.string().min(1, "Choose a date"),
  paid_to: z.string().trim().min(1, "Enter who was paid").max(120),
  payment_method: z.string().min(1, "Choose a payment method"),
  description: z.string().trim().max(1000),
});

const empty = { trip_id: "", category: "", amount: "", expense_date: new Date().toISOString().slice(0, 10), paid_to: "", payment_method: "", description: "" };

export function StatusPill({ status }: { status: string }) {
  const cls = status === "Approved" ? "bg-success-soft text-success" : status === "Rejected" ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function TransporterPage() {
  const { data: me } = useMyAccount();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  const expenses = useQuery({
    queryKey: ["my-expenses", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("user_id", me!.userId).order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const p = schema.parse(form);
      const { error } = await supabase.from("expenses").insert({ ...p, description: p.description || null, user_id: me!.userId });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ ...empty }); setErr(""); qc.invalidateQueries({ queryKey: ["my-expenses"] }); },
    onError: (e) => setErr(e instanceof z.ZodError ? e.issues[0].message : "Could not save the expense."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-expenses"] }),
  });

  const rows = expenses.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Transporter" who={me?.profile?.display_name || me?.email || ""} />
      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[380px_1fr]">
        <section className="panel p-6">
          <h1 className="text-xl font-bold">Submit an expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">Report what you spent on a trip. The owner will review it.</p>
          <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div><Label htmlFor="trip">Trip ID</Label><Input id="trip" value={form.trip_id} onChange={(e) => set("trip_id")(e.target.value)} placeholder="e.g. TRP-1042" /></div>
            <div><Label>Expense category</Label>
              <Select value={form.category} onValueChange={set("category")}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>{expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="amt">Amount (₹)</Label><Input id="amt" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount")(e.target.value)} /></div>
              <div><Label htmlFor="dt">Expense date</Label><Input id="dt" type="date" value={form.expense_date} onChange={(e) => set("expense_date")(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="pt">Paid to</Label><Input id="pt" value={form.paid_to} onChange={(e) => set("paid_to")(e.target.value)} placeholder="e.g. HP Petrol Pump, NH48" /></div>
            <div><Label>Payment method</Label>
              <Select value={form.payment_method} onValueChange={set("payment_method")}><SelectTrigger><SelectValue placeholder="Choose method" /></SelectTrigger>
                <SelectContent>{paymentMethods.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="ds">Description</Label><Textarea id="ds" rows={3} value={form.description} onChange={(e) => set("description")(e.target.value)} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={add.isPending || !me}>{add.isPending ? "Saving…" : "Submit expense"}</Button>
          </form>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-lg font-bold">My expenses</h2>
            <span className="text-sm text-muted-foreground">Total: <b className="text-foreground">{inr(total)}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="invoice-table">
              <thead><tr><th>Date</th><th>Trip</th><th>Category</th><th>Paid to</th><th>Method</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.expense_date}</td><td>{r.trip_id}</td><td>{r.category}</td><td>{r.paid_to}</td><td>{r.payment_method}</td>
                    <td className="font-semibold">{inr(Number(r.amount))}</td>
                    <td><StatusPill status={r.status} />{r.admin_note && <div className="mt-1 max-w-48 truncate text-[11px] text-muted-foreground" title={r.admin_note}>{r.admin_note}</div>}</td>
                    <td>{r.status === "Pending" && <Button size="icon" variant="ghost" aria-label="Delete expense" onClick={() => remove.mutate(r.id)}><Trash2 size={14} /></Button>}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">{expenses.isLoading ? "Loading…" : "No expenses yet. Submit your first one."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
