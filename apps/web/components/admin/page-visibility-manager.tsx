"use client";
import { useActionState, useState } from "react";
import { startTransition } from "react";
import type { Role } from "@infulancer/core/enums";
import { isPathHidden, type PagePermissionRow } from "@infulancer/core/access/page-visibility";
import { navByRole } from "@/components/shell/nav";
import { toggleRolePageAction } from "@/lib/actions/page-permissions";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

const ROLES: { id: Role; label: string }[] = [
  { id: "ADMIN", label: "Admin" },
  { id: "AGENCY", label: "Ajans" },
  { id: "BRAND", label: "Marka" },
  { id: "INFLUENCER", label: "Influencer" },
];

/** Bir rol+sayfa için görünürlük anahtarı (optimistik; sunucuya yazar). */
function VisibilityToggle({ role, href, label, hidden }: { role: Role; href: string; label: string; hidden: boolean }) {
  const [, action, pending] = useActionState(toggleRolePageAction, idleState);
  const [on, setOn] = useState(!hidden); // on = görünür
  const toggle = () => {
    const next = !on;
    setOn(next);
    const fd = new FormData();
    fd.set("role", role);
    fd.set("pathPrefix", href);
    fd.set("visible", next ? "1" : "0");
    startTransition(() => action(fd));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? "görünür" : "gizli"}`}
      disabled={pending}
      onClick={toggle}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-standard disabled:opacity-50", on ? "bg-fg" : "bg-border")}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-bg transition-standard", on ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

/**
 * Rol başına menü sayfası görünürlüğü. Varsayılan: tüm sayfalar görünür.
 * Kapatılan sayfa ilgili rolde menüden kalkar ve erişim engellenir (daraltıcı katman).
 * Koddaki rol kuralları (örn. markanın /admin'e girememesi) değişmez.
 */
export function PageVisibilityManager({ perms }: { perms: PagePermissionRow[] }) {
  const [role, setRole] = useState<Role>("BRAND");
  // Aynı sayfanın birden çok rolde görünmesini sadeleştir: seçili rolün menü öğeleri.
  const items = navByRole[role] ?? [];
  // Tekrarları (örn. aynı href) ve bölümleri koru.
  const seen = new Set<string>();
  const rows = items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-fg-muted">Rol:</span>
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={role === r.id}
            onClick={() => setRole(r.id)}
            className={cn("rounded-full border px-3 py-1 text-[13px] transition-standard", role === r.id ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-fg-muted">
        Anahtarı kapatınca sayfa <strong>{ROLES.find((r) => r.id === role)?.label}</strong> rolünde menüden kalkar ve açılmaya çalışılırsa ana sayfaya yönlendirilir. Bu katman yalnız daraltır; koddaki rol kuralları korunur.
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((i) => {
          const hidden = isPathHidden(perms, role, null, i.href);
          return (
            <li key={i.href} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] text-fg">{i.label}</span>
                <span className="truncate font-mono text-[11px] text-fg-passive">{i.href}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-[12px]", hidden ? "text-fg-passive" : "text-fg-muted")}>{hidden ? "Gizli" : "Görünür"}</span>
                <VisibilityToggle role={role} href={i.href} label={i.label} hidden={hidden} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
