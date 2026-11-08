"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createAdDraftAction, createAdDraftsBulkAction, transitionAdDraftAction } from "@/lib/actions/ad-drafts";

type Brand = { id: string; name: string };
type Objective = { key: string; label: string };
type Asset = { id: string; label: string };

/** Tek reklam taslağı oluşturma (marka seçimi admin'de, markada gizli). */
export function AdDraftForm({ brands, metaObjectives, tiktokObjectives, assets, isAdmin, defaultAssetId }: { brands: Brand[]; metaObjectives: Objective[]; tiktokObjectives: Objective[]; assets: Asset[]; isAdmin: boolean; defaultAssetId?: string }) {
  const tt = useTT();
  return (
    <ActionForm action={createAdDraftAction} submitLabel={tt("Taslak oluştur")} resetOnSuccess aria-label={tt("Reklam taslağı oluştur")}>
      {isAdmin ? (
        <Field label={tt("Marka")}>
          {(p) => (
            <Select {...p} name="tenantId" defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tt("Platform")}>
          {(p) => (
            <Select {...p} name="platform" defaultValue="META">
              <option value="META">{tt("Meta (Instagram/Facebook)")}</option>
              <option value="TIKTOK">{tt("TikTok")}</option>
            </Select>
          )}
        </Field>
        <Field label={tt("Reklam adı")}>{(p) => <Input {...p} name="name" placeholder={tt("Örn. Yaz koleksiyonu – trafik")} />}</Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tt("Hedef")} hint={tt("Platforma göre uygun hedefler listelenir.")}>
          {(p) => (
            <Select {...p} name="objective" defaultValue={metaObjectives[0]?.key}>
              <optgroup label={tt("Meta")}>
                {metaObjectives.map((o) => (
                  <option key={`m-${o.key}`} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={tt("TikTok")}>
                {tiktokObjectives.map((o) => (
                  <option key={`t-${o.key}`} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label={tt("Günlük bütçe (TL)")} hint={tt("En az 10 TL. Öğrenme aşaması için 50 TL+ önerilir.")}>
          {(p) => <Input {...p} name="dailyBudgetTl" inputMode="decimal" placeholder="100" />}
        </Field>
      </div>
      <Field label={tt("Görsel (opsiyonel)")} hint={tt("Creative'de üretilmiş bir görseli bağlayın.")}>
        {(p) => (
          <Select {...p} name="assetId" defaultValue={defaultAssetId ?? ""}>
            <option value="">{tt("Görsel yok")}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tt("Reklam metni")}>{(p) => <Textarea {...p} name="primaryText" rows={3} placeholder={tt("Ürünün faydasını ve net bir çağrıyı yazın.")} />}</Field>
    </ActionForm>
  );
}

/** Toplu kampanya: aynı içerikle birden çok platformda taslak. */
export function BulkAdDraftForm({ brands, metaObjectives, tiktokObjectives, assets, isAdmin, defaultAssetId }: { brands: Brand[]; metaObjectives: Objective[]; tiktokObjectives: Objective[]; assets: Asset[]; isAdmin: boolean; defaultAssetId?: string }) {
  const tt = useTT();
  const objectives = [...metaObjectives];
  for (const o of tiktokObjectives) if (!objectives.some((x) => x.key === o.key)) objectives.push(o);
  return (
    <ActionForm action={createAdDraftsBulkAction} submitLabel={tt("Toplu taslak oluştur")} resetOnSuccess aria-label={tt("Toplu reklam taslağı")}>
      {isAdmin ? (
        <Field label={tt("Marka")}>
          {(p) => (
            <Select {...p} name="tenantId" defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-fg-muted">{tt("Platformlar")}</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="platforms" value="META" defaultChecked className="h-4 w-4 accent-[var(--color-fg)]" />{" "}{tt("Meta")}</label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="platforms" value="TIKTOK" defaultChecked className="h-4 w-4 accent-[var(--color-fg)]" />{" "}{tt("TikTok")}</label>
        </div>
        <p className="text-[12px] text-fg-passive">{tt("Seçilen hedef bir platformda desteklenmiyorsa o platformda en uygun hedefe düşülür.")}</p>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tt("Reklam adı (ortak)")}>{(p) => <Input {...p} name="name" placeholder={tt("Örn. Lansman kampanyası")} />}</Field>
        <Field label={tt("Günlük bütçe / platform (TL)")}>{(p) => <Input {...p} name="dailyBudgetTl" inputMode="decimal" placeholder="100" />}</Field>
      </div>
      <Field label={tt("Hedef")}>
        {(p) => (
          <Select {...p} name="objective" defaultValue={objectives[0]?.key}>
            {objectives.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tt("Görsel (opsiyonel)")}>
        {(p) => (
          <Select {...p} name="assetId" defaultValue={defaultAssetId ?? ""}>
            <option value="">{tt("Görsel yok")}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tt("Reklam metni (ortak)")}>{(p) => <Textarea {...p} name="primaryText" rows={3} />}</Field>
    </ActionForm>
  );
}

/** Durum geçiş butonu (onaya gönder / onayla / reddet / yeniden). */
export function AdDraftTransition({ id, to, label, variant = "secondary", requireNote = false }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost"; requireNote?: boolean }) {
  const tt = useTT();
  return (
    <ActionForm action={transitionAdDraftAction} aria-label={label} className="!flex-row items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {requireNote ? <Input name="reviewNote" placeholder={tt("Ret gerekçesi (opsiyonel)")} className="h-8 text-[12px]" /> : null}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </ActionForm>
  );
}
