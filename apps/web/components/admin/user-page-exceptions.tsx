"use client";
import { useMemo, useState } from "react";
import { startTransition, useActionState } from "react";
import type { Role } from "@infulancer/core/enums";
import type { PagePermissionRow } from "@infulancer/core/access/page-visibility";
import { navByRole } from "@/components/shell/nav";
import { setUserPageAction } from "@/lib/actions/page-permissions";
import { idleState } from "@/lib/action-state";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type PermUser = { id: string; name: string; email: string; role: Role };

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", AGENCY: "Ajans", BRAND: "Marka", INFLUENCER: "Influencer" };
type Mode = "open" | "hide" | "clear";

/**
 * Kişiye özel sayfa istisnaları: bir kullanıcıya özel bir sayfayı AÇ (rol gizlemesini geri alır)
 * veya GİZLE (yalnız o kişide). "Varsayılana dön" istisnayı kaldırır.
 * Koddaki rol kuralları değişmez; bu yalnız ek daraltma/geri açmadır.
 */
export function UserPageExceptions({ users, perms }: { users: PermUser[]; perms: PagePermissionRow[] }) {
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [, action, pending] = useActionState(setUserPageAction, idleState);
  const [msg, setMsg] = useState<string>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const list = needle ? users.filter((u) => `${u.name} ${u.email}`.toLocaleLowerCase("tr").includes(needle)) : users;
    return list.slice(0, 50);
  }, [q, users]);
  const user = users.find((u) => u.id === userId) ?? null;

  // Seçili kullanıcının rolüne göre olası menü sayfaları.
  const pages = user ? (navByRole[user.role === "AGENCY" ? "AGENCY" : user.role] ?? []) : [];
  const userPerm = (href: string) => perms.find((p) => p.scopeType === "USER" && p.scopeId === userId && p.pathPrefix === href);
  const rolePerm = (href: string) => perms.find((p) => p.scopeType === "ROLE" && p.scopeId === user?.role && p.pathPrefix === href && !p.allowed);

  const apply = (href: string, mode: Mode) => {
    if (!userId) return;
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("pathPrefix", href);
    fd.set("mode", mode);
    setMsg("");
    startTransition(async () => {
      const res = await action(fd);
      void res;
      setMsg(mode === "clear" ? "Varsayılana döndürüldü." : mode === "open" ? "Kişiye açıldı." : "Kişide gizlendi.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="relative">
          <span className="sr-only">Kullanıcı ara</span>
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="İsim veya e-posta ile ara"
            className="h-10 w-full rounded-full border border-border bg-bg pr-3 pl-9 text-sm text-fg placeholder:text-fg-passive focus:border-fg focus:outline-none"
          />
        </label>
        <select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setMsg(""); }}
          className="h-10 rounded-[8px] border border-border bg-bg px-3 text-sm text-fg focus:border-fg focus:outline-none"
          aria-label="Kullanıcı seç"
        >
          <option value="">Kullanıcı seçin…</option>
          {filtered.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABEL[u.role] ?? u.role} · {u.email}
            </option>
          ))}
        </select>
      </div>

      {!user ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-muted">Bir kullanıcı seçin; o kişiye özel sayfa istisnalarını buradan yönetin.</p>
      ) : (
        <>
          <p className="text-[13px] text-fg-muted">
            <strong>{user.name}</strong> ({ROLE_LABEL[user.role] ?? user.role}) için istisnalar. &quot;Aç&quot; bu kişide sayfayı görünür yapar (rol gizlemesini geri alır); &quot;Gizle&quot; yalnız bu kişide saklar.
          </p>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {pages.map((i) => {
              const up = userPerm(i.href);
              const roleHidden = !!rolePerm(i.href);
              const state = up ? (up.allowed ? "Kişiye açık" : "Kişide gizli") : roleHidden ? "Rol gereği gizli" : "Varsayılan (görünür)";
              return (
                <li key={i.href} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] text-fg">{i.label}</span>
                    <span className="truncate font-mono text-[11px] text-fg-passive">{i.href} · {state}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" disabled={pending} onClick={() => apply(i.href, "open")} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-fg transition-standard hover:border-fg/50 disabled:opacity-40">
                      Aç
                    </button>
                    <button type="button" disabled={pending} onClick={() => apply(i.href, "hide")} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-fg transition-standard hover:border-fg/50 disabled:opacity-40">
                      Gizle
                    </button>
                    <button type="button" disabled={pending || !up} onClick={() => apply(i.href, "clear")} className="rounded-full px-2.5 py-1 text-[12px] text-fg-muted transition-standard hover:text-fg disabled:opacity-40">
                      Varsayılan
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className={cn("text-[13px]", msg ? "text-emerald-600" : "")}>{msg}</p>
        </>
      )}
    </div>
  );
}
