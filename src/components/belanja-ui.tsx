import { ReactNode, useEffect, useRef, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

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

/**
 * Text/number input with local draft state so typing is instant (no per-keystroke
 * network write). Commits on blur / Enter / ✓; reverts on Esc / ✕. Auto-selects
 * on focus so the user can overwrite immediately.
 */
export function DraftInput({ value, onCommit, type = "text", placeholder, inputClassName }: {
  value: string; onCommit: (raw: string) => void; type?: "text" | "number"; placeholder?: string; inputClassName?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useRef(false); // once true, block commit until next focus

  // Keep draft in sync with server value while not actively editing.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    if (guard.current) return;
    guard.current = true;
    if (draft !== value) onCommit(draft);
    setEditing(false);
    inputRef.current?.blur();
  };
  const cancel = () => {
    guard.current = true;
    setDraft(value);
    setEditing(false);
    inputRef.current?.blur();
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={draft}
        placeholder={placeholder}
        onFocus={(e) => { guard.current = false; setEditing(true); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") cancel(); }}
        className={inputClassName ?? "h-9"}
      />
      {editing && (
        <>
          <Button type="button" size="icon" variant="ghost" aria-label="Simpan"
            className="h-9 w-9 shrink-0 text-success" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Batal"
            className="h-9 w-9 shrink-0 text-muted-foreground" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
