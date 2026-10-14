import { Link } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/account";

export function AppHeader({ title, who }: { title: string; who: string }) {
  const signOut = useSignOut();
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/" search={{ view: "overview" }} className="flex items-center gap-2">
          <ShieldCheck className="text-orange" size={26} />
          <span className="font-display font-bold">FreightProof <span className="text-orange">AI</span></span>
          <span className="ml-2 hidden rounded bg-brand-active px-2 py-0.5 text-xs sm:inline">{title}</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-brand-muted sm:inline">{who}</span>
          <Button size="sm" variant="secondary" onClick={signOut}><LogOut size={14} /> Sign out</Button>
        </div>
      </div>
    </header>
  );
}
