import type { ReactNode } from "react";
import type { Role } from "@infulancer/core/enums";
import { roleLabels } from "@infulancer/core/domain/labels";
import { SearchIcon } from "@/components/icons";
import { getSessionUser, requireActor } from "@/lib/auth-guard";
import { AccountMenu } from "./account-menu";
import { MobileTabBar } from "./mobile-tab-bar";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { Sidebar } from "./sidebar";

/**
 * Uygulama iskeleti: kenar çubuğu (md+) / alt sekme çubuğu (mobil), 64px başlık
 * (admin için arama, bildirim, hesap) ve max 1440px ortalanmış içerik.
 */
export async function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const actor = await requireActor(role);
  const user = await getSessionUser();
  const navRole: Role = actor.staffRole ?? role;

  return (
    <div className="relative isolate flex min-h-dvh bg-bg text-fg">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-[-10%] h-[520px] w-[520px] rounded-full bg-neon-pink/10 blur-[140px] animate-aurora" />
        <div className="absolute bottom-[-20%] left-[10%] h-[560px] w-[560px] rounded-full bg-neon-cyan/8 blur-[140px] animate-aurora [animation-delay:-9s]" />
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[8px] focus:bg-fg focus:px-3 focus:py-2 focus:text-bg"
      >
        İçeriğe geç
      </a>
      <Sidebar role={navRole} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-bg/70 px-4 backdrop-blur-xl md:px-8">
          <span className="text-[15px] font-semibold tracking-tight md:hidden">Infulancer</span>
          {role === "ADMIN" ? (
            <form action="/admin/ara" method="get" role="search" className="hidden max-w-md flex-1 sm:block">
              <label htmlFor="global-search" className="sr-only">
                Kampanya, influencer veya marka ara
              </label>
              <div className="relative">
                <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
                <input
                  id="global-search"
                  name="q"
                  type="search"
                  minLength={2}
                  placeholder="Kampanya, influencer veya marka ara"
                  className="h-9 w-full rounded-[8px] border border-border bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-passive transition-standard hover:border-border-strong focus:border-fg focus:outline-none"
                />
              </div>
            </form>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell userId={actor.userId} />
            <AccountMenu name={user?.name ?? ""} email={user?.email ?? ""} roleLabel={roleLabels[navRole]} />
          </div>
        </header>
        <main id="icerik" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 pb-24 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
      <MobileTabBar role={navRole} />
      <CopilotLauncher />
    </div>
  );
}
