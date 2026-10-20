import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FreightProof AI" },
      { name: "description", content: "Sign in to FreightProof AI as an owner/admin or transporter to submit and review trip expenses." },
      { property: "og:title", content: "Sign in — FreightProof AI" },
      { property: "og:description", content: "Owner and transporter sign-in for FreightProof AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  display_name: z.string().trim().min(1, "Enter your name").max(100),
  company_name: z.string().trim().max(120),
  phone: z.string().trim().max(20),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ email: "", password: "", display_name: "", company_name: "", phone: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
  }, [navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) return setMsg({ kind: "error", text: error.message });
        navigate({ to: "/dashboard" });
      } else {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) return setMsg({ kind: "error", text: parsed.error.issues[0]?.message ?? "Please check the form." });
        const { email, password, ...meta } = parsed.data;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard", data: meta } });
        if (error) return setMsg({ kind: "error", text: error.message });
        if (data.session) navigate({ to: "/dashboard" });
        else setMsg({ kind: "ok", text: "Check your email to confirm your account, then sign in." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) return setMsg({ kind: "error", text: "Google sign-in failed. Please try again." });
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4 py-10">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-xl">
        <Link to="/" search={{ view: "overview" }} className="mb-6 flex items-center gap-2">
          <ShieldCheck className="text-orange" size={30} />
          <span className="font-display text-lg font-bold text-brand">FreightProof <span className="text-orange">AI</span></span>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Owners review all transport bills. Transporters submit trip expenses.</p>

        <Button type="button" variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <>
              <div><Label htmlFor="dn">Full name</Label><Input id="dn" value={form.display_name} onChange={set("display_name")} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="co">Company</Label><Input id="co" value={form.company_name} onChange={set("company_name")} /></div>
                <div><Label htmlFor="ph">Phone</Label><Input id="ph" value={form.phone} onChange={set("phone")} /></div>
              </div>
            </>
          )}
          <div><Label htmlFor="em">Email</Label><Input id="em" type="email" value={form.email} onChange={set("email")} required /></div>
          <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" value={form.password} onChange={set("password")} required /></div>
          {msg && <p className={`text-sm ${msg.kind === "error" ? "text-destructive" : "text-success"}`}>{msg.text}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "in" ? "New here? " : "Already have an account? "}
          <button type="button" className="font-medium text-info underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
        {mode === "up" && <p className="mt-3 text-center text-xs text-muted-foreground">The very first account becomes the owner/admin. Everyone after joins as a transporter.</p>}
      </div>
    </div>
  );
}
