import { ReactNode } from "react";
import { formatRupiah } from "@/lib/format";

export function StatCard({ label, value, hint, tone = "default", icon }: {
  label: string; value: ReactNode; hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BudgetBar({ pemakaian, budget }: { pemakaian: number; budget: number }) {
  const ratio = budget > 0 ? Math.min(pemakaian / budget, 1) : 0;
  const over = budget > 0 && pemakaian > budget;
  const color = over ? "bg-destructive" : ratio >= 0.8 ? "bg-warning" : "bg-success";
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(ratio * 100, budget > 0 && pemakaian > 0 ? 4 : 0)}%` }} />
      </div>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>{formatRupiah(pemakaian)}</span>
        <span>{formatRupiah(budget)}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;
}
