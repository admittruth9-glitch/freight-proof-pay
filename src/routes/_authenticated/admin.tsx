import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { StatusPill } from "./transporter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, useMyAccount } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Owner admin — FreightProof AI" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me, isLoading } = useMyAccount();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [who, setWho] = useState("All");
  const isAdmin = me?.role === "admin";

  const data = useQuery({
    queryKey: ["admin-data"],
    enabled: isAdmin,
    queryFn: async () => {
      const [ex, pr, ro] = await Promise.all([
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (ex.error) throw ex.error;
      return { expenses: ex.data, profiles: pr.data ?? [], roles: ro.data ?? [] };
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "Approved" | "Rejected"; note?: string | undefined }) => {
      const { error } = await supabase.from("expenses").update({ status, admin_note: note?.slice(0, 500) || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-data"] }),
  });

  const profiles = data.data?.profiles ?? [];
  const nameOf = (id: string) => { const p = profiles.find((x) => x.id === id); return p?.display_name || p?.email || "Unknown"; };
  const companyOf = (id: string) => profiles.find((x) => x.id === id)?.company_name || "";
  const transporters = profiles.filter((p) => data.data?.roles.some((r) => r.user_id === p.id && r.role === "transporter"));

  const all = data.data?.expenses ?? [];
  const rows = useMemo(() => all.filter((r) =>
    (status === "All" || r.status === status) && (who === "All" || r.user_id === who) &&
    `${r.trip_id} ${r.category} ${r.paid_to} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase().trim())), [all, status, who, q]);

  const sum = (list: typeof all) => list.reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = Object.entries(all.reduce<Record<string, number>>((m, r) => ({ ...m, [r.category]: (m[r.category] ?? 0) + Number(r.amount) }), {})).sort((a, b) => b[1] - a[1]);
  const byTransporter = transporters.map((t) => { const list = all.filter((r) => r.user_id === t.id); return { t, count: list.length, total: sum(list), pending: sum(list.filter((r) => r.status === "Pending")) }; });

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [["Date", "Transporter", "Company", "Trip ID", "Category", "Amount", "Paid to", "Method", "Status", "Description", "Admin note"],
      ...rows.map((r) => [r.expense_date, nameOf(r.user_id), companyOf(r.user_id), r.trip_id, r.category, r.amount, r.paid_to, r.payment_method, r.status, r.description, r.admin_note])];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "transport-expenses.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/transporter" replace />;

  const max = byCategory[0]?.[1] ?? 1;
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Owner admin" who={me?.profile?.display_name || me?.email || ""} />
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <div><h1 className="text-2xl font-bold">Transport bills report</h1><p className="text-sm text-muted-foreground">Every expense submitted by your transporters, in one place.</p></div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[["Total submitted", inr(sum(all))], ["Pending review", inr(sum(all.filter((r) => r.status === "Pending")))], ["Approved", inr(sum(all.filter((r) => r.status === "Approved")))], ["Transporters", String(transporters.length)]].map(([l, v]) => (
            <div key={l} className="panel p-5"><div className="text-xs text-muted-foreground">{l}</div><div className="metric-value mt-1">{v}</div></div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="mb-4 font-bold">Spend by category</h2>
            {byCategory.length ? byCategory.map(([c, v]) => (
              <div key={c} className="mb-3"><div className="flex justify-between text-sm"><span>{c}</span><b>{inr(v)}</b></div>
                <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-orange" style={{ width: `${(v / max) * 100}%` }} /></div></div>
            )) : <p className="text-sm text-muted-foreground">No expenses yet.</p>}
          </section>
          <section className="panel overflow-hidden">
            <h2 className="p-5 font-bold">Transporters</h2>
            <table className="invoice-table"><thead><tr><th>Name</th><th>Company</th><th>Phone</th><th>Bills</th><th>Total</th><th>Pending</th></tr></thead>
              <tbody>{byTransporter.map(({ t, count, total, pending }) => (
                <tr key={t.id}><td><div className="font-medium">{t.display_name || "—"}</div><div className="text-[11px] text-muted-foreground">{t.email}</div></td><td>{t.company_name || "—"}</td><td>{t.phone || "—"}</td><td>{count}</td><td>{inr(total)}</td><td>{inr(pending)}</td></tr>
              ))}{!byTransporter.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No transporters have signed up yet.</td></tr>}</tbody></table>
          </section>
        </div>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <h2 className="mr-auto font-bold">All expenses ({rows.length})</h2>
            <Input className="w-48" placeholder="Search trip, payee…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={who} onValueChange={setWho}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="All">All transporters</SelectItem>{transporters.map((t) => <SelectItem key={t.id} value={t.id}>{t.display_name || t.email}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{["All", "Pending", "Approved", "Rejected"].map((s) => <SelectItem key={s} value={s}>{s === "All" ? "All statuses" : s}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" onClick={exportCsv}><Download size={14} /> CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="invoice-table">
              <thead><tr><th>Date</th><th>Transporter</th><th>Trip</th><th>Category</th><th>Paid to</th><th>Method</th><th>Amount</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.expense_date}</td><td><div className="font-medium">{nameOf(r.user_id)}</div><div className="text-[11px] text-muted-foreground">{companyOf(r.user_id)}</div></td>
                    <td>{r.trip_id}</td><td>{r.category}</td><td>{r.paid_to}</td><td>{r.payment_method}</td><td className="font-semibold">{inr(Number(r.amount))}</td>
                    <td className="max-w-56 truncate" title={r.description ?? ""}>{r.description || "—"}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="space-x-1">
                      <Button size="sm" variant="outline" disabled={r.status === "Approved"} onClick={() => review.mutate({ id: r.id, status: "Approved" })}><Check size={13} /> Approve</Button>
                      <Button size="sm" variant="outline" disabled={r.status === "Rejected"} onClick={() => { const note = window.prompt("Reason for rejecting (optional)") ?? undefined; review.mutate({ id: r.id, status: "Rejected", note }); }}><X size={13} /> Reject</Button>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={10} className="py-10 text-center text-muted-foreground">{data.isLoading ? "Loading…" : "No expenses match."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
