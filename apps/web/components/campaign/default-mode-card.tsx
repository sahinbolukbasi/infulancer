"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/card";
import { setBrandDefaultModeAction } from "@/lib/actions/execution-mode";

/**
 * Markanın varsayılan çalışma modu. Yeni açılan kampanyalar bu modla başlar; her kampanyada
 * ayrıca değiştirilebilir. SELF = kendiniz yürütürsünüz, AJANS = ajansa devredersiniz.
 */
export function DefaultModeCard({ mode }: { mode: "SELF" | "AJANS" }) {
  const tt = useTT();
  const self = mode === "SELF";
  return (
    <Card interactive={false} className="flex flex-col gap-3">
      <CardTitle>{tt("Çalışma şekliniz")}</CardTitle>
      <p className="text-sm text-fg-muted">
        {self
          ? tt("Yeni kampanyaları kendiniz yürütüyorsunuz: influencer'ı siz seçip atar, yayına siz alırsınız. İstediğiniz kampanyayı tek tıkla ajansa devredebilirsiniz.")
          : tt("Yeni kampanyaları ajansa devrediyorsunuz: siz brief'i hazırlarsınız, ajans influencer'ı atar ve yayına alır. İstediğiniz kampanyayı kendiniz de yürütebilirsiniz.")}
      </p>
      <ActionForm action={setBrandDefaultModeAction} aria-label={tt("Varsayılan çalışma modu")} className="flex flex-row flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-[13px] text-fg">
          {self ? tt("Varsayılan: Kendim yürütüyorum") : tt("Varsayılan: Ajans yürütüyor")}
        </span>
        {self ? (
          <Button type="submit" name="mode" value="AJANS" variant="secondary" size="sm">{tt("Ajansa devretmeye geç")}</Button>
        ) : (
          <Button type="submit" name="mode" value="SELF" size="sm">{tt("Kendim yürütmeye geç")}</Button>
        )}
      </ActionForm>
    </Card>
  );
}
