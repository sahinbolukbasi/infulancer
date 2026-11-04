import type { Actor } from "@infulancer/core/access/actor";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { copilotWelcome } from "@/lib/copilot";

/** Rol ana sayfalarının üstünde gömülü asistan: ilk açılışta "bugün ne yapmalıyım" ve hızlı başlatma. */
export async function CopilotHome({ actor }: { actor: Actor }) {
  const welcome = await copilotWelcome(actor);
  return (
    <section aria-label="Infulancer Asistan" className="relative overflow-hidden rounded-3xl border border-line bg-surface">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-neon-pink/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-neon-cyan/15 blur-3xl" />
      <div className="relative">
        <CopilotChat welcome={welcome} />
      </div>
    </section>
  );
}
