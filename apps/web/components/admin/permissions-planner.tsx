"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { startTransition, useMemo, useState } from "react";
import type { Role } from "@infulancer/core/enums";
import { isPathHidden, type PagePermissionRow } from "@infulancer/core/access/page-visibility";
import { navByRole, type NavItem } from "@/components/shell/nav";
import { setUserPageAction, toggleRolePageAction } from "@/lib/actions/page-permissions";
import { idleState } from "@/lib/action-state";
import { EyeIcon, EyeOffIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type PlannerUser = { id: string; name: string; email: string; role: Role };
const ROLES: { id: Role; label: string; text: string }[] = [
  { id: "ADMIN", label: "Admin", text: "Platform sahibi" },
  { id: "AGENCY", label: "Ajans", text: "Operasyon ekibi" },
  { id: "BRAND", label: "Marka", text: "Firma kullanıcıları" },
  { id: "INFLUENCER", label: "Influencer", text: "İçerik üreticileri" },
];
type UserMode = "role" | "open" | "hide";

/**
 * Rol + kişi görünürlüğü tek ekranda. Önce rol seçilir: o rolün menü sayfaları listelenir ve her sayfa
 * rol için aç/kapat yapılır. Sonra (isteğe bağlı) o rolden bir kişi seçilir: her sayfada "Rol gibi /
 * Bu kişiye aç / Bu kişide gizle" seçilir. Her satır kişinin sonuçta ne gördüğünü ("Görünüyor /
 * Görünmüyor") açıkça yazar; rolde gizli sayfa tek tıkla o kişiye açılabilir.
 * Kurallar daraltıcıdır: koddaki rol yetkilerini genişletmez (ör. markaya finans açılamaz).
 */
export function PermissionsPlanner({ perms: initial, users }: { perms: PagePermissionRow[]; users: PlannerUser[] }) {
  const tt = useTT();
  const [perms, setPerms] = useState<PagePermissionRow[]>(initial);
  const [role, setRole] = useState<Role>("BRAND");
  const [userId, setUserId] = useState<string>("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pages: NavItem[] = navByRole[role] ?? [];
  const roleUsers = useMemo(() => users.filter((u) => (role === "AGENCY" ? u.role === "AGENCY" : u.role === role)), [users, role]);
  const exceptionCount = (uid: string) => perms.filter((p) => p.scopeType === "USER" && p.scopeId === uid).length;
  const shownUsers = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr");
    const list = n ? roleUsers.filter((u) => `${u.name} ${u.email}`.toLocaleLowerCase("tr").includes(n)) : roleUsers;
    return [...list].sort((a, b) => exceptionCount(b.id) - exceptionCount(a.id) || a.name.localeCompare(b.name, "tr")).slice(0, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- perms değişince sayımlar yenilenir
  }, [q, roleUsers, perms]);
  const user = roleUsers.find((u) => u.id === userId) ?? null;
  // Kod rolü: AGENCY kullanıcıları menüde AGENCY listesini, kurallarda AGENCY rolünü kullanır.
  const roleHidden = (href: string) => perms.some((p) => p.scopeType === "ROLE" && p.scopeId === role && p.pathPrefix === href && !p.allowed);
  const userRule = (href: string) => perms.find((p) => p.scopeType === "USER" && p.scopeId === userId && p.pathPrefix === href);
  const effectiveHidden = (href: string) => (user ? isPathHidden(perms, role, user.id, href) : roleHidden(href));
  const hiddenForRole = pages.filter((p) => roleHidden(p.href)).length;

  const run = async (key: string, fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>, optimistic: (rows: PagePermissionRow[]) => PagePermissionRow[]) => {
    setBusy(key);
    setMsg(null);
    const prev = perms;
    setPerms(optimistic(perms));
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        setPerms(prev);
        setMsg({ text: r.error, error: true });
      } else setMsg({ text: r.message ?? "Kaydedildi." });
      setBusy(null);
    });
  };
  const setRoleVisible = (href: string, visible: boolean) => {
    const fd = new FormData();
    fd.set("role", role);
    fd.set("pathPrefix", href);
    fd.set("visible", visible ? "1" : "0");
    void run(`role:${href}`, () => toggleRolePageAction(idleState, fd), (rows) => {
      const rest = rows.filter((p) => !(p.scopeType === "ROLE" && p.scopeId === role && p.pathPrefix === href));
      return visible ? rest : [...rest, { id: `tmp-${href}`, scopeType: "ROLE", scopeId: role, pathPrefix: href, allowed: false }];
    });
  };
  const setUserMode = (href: string, mode: UserMode) => {
    if (!user) return;
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("pathPrefix", href);
    fd.set("mode", mode === "role" ? "clear" : mode);
    void run(`user:${href}`, () => setUserPageAction(idleState, fd), (rows) => {
      const rest = rows.filter((p) => !(p.scopeType === "USER" && p.scopeId === user.id && p.pathPrefix === href));
      return mode === "role" ? rest : [...rest, { id: `tmp-u-${href}`, scopeType: "USER", scopeId: user.id, pathPrefix: href, allowed: mode === "open" }];
    });
  };
  const sections = pages.reduce<{ name: string; items: NavItem[] }[]>((acc, p) => {
    const name = p.section ?? "Menü";
    const g = acc.find((x) => x.name === name);
    if (g) g.items.push(p);
    else acc.push({ name, items: [p] });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={tt("Rol")} className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {ROLES.map((r) => {
          const hidden = (navByRole[r.id] ?? []).filter((p) => perms.some((x) => x.scopeType === "ROLE" && x.scopeId === r.id && x.pathPrefix === p.href && !x.allowed)).length;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={role === r.id}
              onClick={() => {
                setRole(r.id);
                setUserId("");
                setMsg(null);
              }}
              className={cn("flex flex-col items-start gap-0.5 rounded-2xl border px-4 py-3 text-left transition-standard", role === r.id ? "border-fg bg-fg text-bg" : "border-line hover:border-fg/40")}
            >
              <span className="text-[15px] font-semibold">{r.label}</span>
              <span className={cn("text-[12px]", role === r.id ? "text-bg/70" : "text-fg-muted")}>
                {r.text} · {users.filter((u) => u.role === r.id).length}{" "}{tt("kişi")}{hidden ? ` · ${hidden} sayfa gizli` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3" aria-label={tt("Kişiler")}>
          <button
            type="button"
            onClick={() => setUserId("")}
            aria-pressed={!user}
            className={cn("rounded-2xl border px-4 py-3 text-left", !user ? "border-fg bg-fg/[0.05]" : "border-line hover:border-fg/40")}
          >
            <span className="block text-[14px] font-medium text-fg">{tt("Tüm")}{" "}{ROLES.find((r) => r.id === role)!.label.toLocaleLowerCase("tr")}{" "}{tt("rolü")}</span>
            <span className="block text-[12px] text-fg-muted">{tt("Rol için sayfaları aç/kapat ·")}{" "}{hiddenForRole}{" "}{tt("gizli")}</span>
          </button>
          <label className="relative">
            <span className="sr-only">{tt("Kişi ara")}</span>
            <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("Kişi ara (ad, e-posta)")} className="h-10 w-full rounded-full border border-line bg-bg pr-3 pl-9 text-sm text-fg placeholder:text-fg-passive focus:border-fg focus:outline-none" />
          </label>
          <ul className="flex max-h-[480px] flex-col gap-1 overflow-y-auto" aria-label={tt("Rolün kişileri")}>
            {shownUsers.map((u) => {
              const n = exceptionCount(u.id);
              return (
                <li key={u.id}>
                  <button type="button" onClick={() => setUserId(u.id)} aria-pressed={userId === u.id} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left", userId === u.id ? "bg-fg text-bg" : "hover:bg-fg/[0.05]")}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-medium">{u.name}</span>
                      <span className={cn("truncate text-[11px]", userId === u.id ? "text-bg/70" : "text-fg-passive")}>{u.email}</span>
                    </span>
                    {n ? <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px]", userId === u.id ? "bg-bg/20" : "bg-fg/10")}>{n}{" "}{tt("istisna")}</span> : null}
                  </button>
                </li>
              );
            })}
            {shownUsers.length === 0 ? <li className="px-3 py-2 text-[12px] text-fg-muted">{tt("Bu rolde kişi yok.")}</li> : null}
          </ul>
        </aside>
        <section className="flex min-w-0 flex-col gap-3" aria-label={tt("Sayfalar")}>
          <p className="text-[13px] text-fg-muted">
            {user ? (
              <>
                <strong className="text-fg">{user.name}</strong>{" "}{tt("için: “Rol gibi” rol ayarını izler; “Aç” rolde gizli olsa da bu kişiye gösterir; “Gizle” yalnız bu kişiden saklar.")}</>
            ) : (
              <>{tt("Rol ayarı bu roldeki herkese uygulanır. Gizlenen sayfa menüden kalkar ve adresle de açılamaz. Kişiye açmak için soldan kişiyi seçin.")}</>
            )}
          </p>
          {sections.map((g) => (
            <div key={g.name} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <h3 className="border-b border-line bg-fg/[0.03] px-4 py-2 text-[12px] font-medium text-fg-muted">{g.name}</h3>
              <ul className="divide-y divide-line">
                {g.items.map((p) => {
                  const rh = roleHidden(p.href);
                  const ur = userRule(p.href);
                  const hidden = effectiveHidden(p.href);
                  const mode: UserMode = ur ? (ur.allowed ? "open" : "hide") : "role";
                  return (
                    <li key={p.href} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", hidden ? "bg-critical/10 text-critical" : "bg-emerald-500/10 text-emerald-600")} aria-hidden>
                          {hidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] text-fg">{p.label}</span>
                          <span className="truncate text-[11px] text-fg-passive">
                            <span className="font-mono">{p.href}</span>{" "}{tt("· Rolde")}{" "}{rh ? "gizli" : tt("açık")}
                            {ur ? ` · kişiye özel: ${ur.allowed ? "açık" : "gizli"}` : ""}
                          </span>
                        </span>
                        <span className={cn("ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", hidden ? "bg-critical/10 text-critical" : "bg-emerald-500/10 text-emerald-600")}>
                          {hidden ? tt("Görünmüyor") : tt("Görünüyor")}
                        </span>
                      </div>
                      {user ? (
                        <div role="radiogroup" aria-label={`${p.label}: ${user.name} için`} className="flex shrink-0 rounded-full border border-line p-0.5">
                          {(["role", "open", "hide"] as UserMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              role="radio"
                              aria-checked={mode === m}
                              disabled={busy === `user:${p.href}`}
                              onClick={() => mode !== m && setUserMode(p.href, m)}
                              className={cn("rounded-full px-3 py-1 text-[12px] transition-standard disabled:opacity-50", mode === m ? "bg-fg text-bg" : "text-fg-muted hover:text-fg")}
                            >
                              {m === "role" ? tt("Rol gibi") : m === "open" ? tt("Aç") : tt("Gizle")}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === `role:${p.href}`}
                          onClick={() => setRoleVisible(p.href, rh)}
                          aria-pressed={!rh}
                          aria-label={`${p.label}: rolde ${rh ? "aç" : "gizle"}`}
                          className={cn("shrink-0 rounded-full border px-3 py-1 text-[12px] transition-standard disabled:opacity-50", rh ? "border-fg bg-fg text-bg" : "border-line text-fg hover:border-fg/40")}
                        >
                          {rh ? tt("Rolde aç") : tt("Rolde gizle")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p aria-live="polite" className={cn("text-[13px]", msg?.error ? "text-critical" : "text-emerald-600")}>
            {msg?.text}
          </p>
        </section>
      </div>
    </div>
  );
}
