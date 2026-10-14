import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMyAccount } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FreightProof AI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useMyAccount();
  if (isLoading || !data) return <div className="p-10 text-muted-foreground">Loading…</div>;
  return <Navigate to={data.role === "admin" ? "/admin" : "/transporter"} replace />;
}
