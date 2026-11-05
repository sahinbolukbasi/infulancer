"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createAdDraftAction, createAdDraftsBulkAction, transitionAdDraftAction } from "@/lib/actions/ad-drafts";

type Brand = { id: string; name: string };
type Objective = { key: string; label: string };
type Asset = { id: string; label: string };

/** Tek reklam taslağı oluşturma (marka seçimi admin'de, markada gizli). */
export function AdDraftForm({ brands, metaObjectives, tiktokObjectives, assets, isAdmin }: { brands: Brand[]; metaObjectives: Objective[]; tiktokObjectives: Objective[]; assets: Asset[]; isAdmin: boolean }) {
  return (
    <ActionForm action={createAdDraftAction} submitLabel="Taslak oluştur" resetOnSuccess aria-label="Reklam taslağı oluştur">
      {isAdmin ? (
        <Field label="Marka">
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
        <Field label="Platform">
          {(p) => (
            <Select {...p} name="platform" defaultValue="META">
              <option value="META">Meta (Instagram/Facebook)</option>
              <option value="TIKTOK">TikTok</option>
            </Select>
          )}
        </Field>
        <Field label="Reklam adı">{(p) => <Input {...p} name="name" placeholder="Örn. Yaz koleksiyonu – trafik" />}</Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Hedef" hint="Platforma göre uygun hedefler listelenir.">
          {(p) => (
            <Select {...p} name="objective" defaultValue={metaObjectives[0]?.key}>
              <optgroup label="Meta">
                {metaObjectives.map((o) => (
                  <option key={`m-${o.key}`} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="TikTok">
                {tiktokObjectives.map((o) => (
                  <option key={`t-${o.key}`} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label="Günlük bütçe (TL)" hint="En az 10 TL. Öğrenme aşaması için 50 TL+ önerilir.">
          {(p) => <Input {...p} name="dailyBudgetTl" inputMode="decimal" placeholder="100" />}
        </Field>
      </div>
      <Field label="Görsel (opsiyonel)" hint="Creative'de üretilmiş bir görseli bağlayın.">
        {(p) => (
          <Select {...p} name="assetId" defaultValue="">
            <option value="">Görsel yok</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Reklam metni">{(p) => <Textarea {...p} name="primaryText" rows={3} placeholder="Ürünün faydasını ve net bir çağrıyı yazın." />}</Field>
    </ActionForm>
  );
}

/** Toplu kampanya: aynı içerikle birden çok platformda taslak. */
export function BulkAdDraftForm({ brands, metaObjectives, tiktokObjectives, assets, isAdmin }: { brands: Brand[]; metaObjectives: Objective[]; tiktokObjectives: Objective[]; assets: Asset[]; isAdmin: boolean }) {
  const objectives = [...metaObjectives];
  for (const o of tiktokObjectives) if (!objectives.some((x) => x.key === o.key)) objectives.push(o);
  return (
    <ActionForm action={createAdDraftsBulkAction} submitLabel="Toplu taslak oluştur" resetOnSuccess aria-label="Toplu reklam taslağı">
      {isAdmin ? (
        <Field label="Marka">
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
        <legend className="text-label text-fg-muted">Platformlar</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="platforms" value="META" defaultChecked className="h-4 w-4 accent-[var(--color-fg)]" /> Meta
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="platforms" value="TIKTOK" defaultChecked className="h-4 w-4 accent-[var(--color-fg)]" /> TikTok
          </label>
        </div>
        <p className="text-[12px] text-fg-passive">Seçilen hedef bir platformda desteklenmiyorsa o platformda en uygun hedefe düşülür.</p>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Reklam adı (ortak)">{(p) => <Input {...p} name="name" placeholder="Örn. Lansman kampanyası" />}</Field>
        <Field label="Günlük bütçe / platform (TL)">{(p) => <Input {...p} name="dailyBudgetTl" inputMode="decimal" placeholder="100" />}</Field>
      </div>
      <Field label="Hedef">
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
      <Field label="Görsel (opsiyonel)">
        {(p) => (
          <Select {...p} name="assetId" defaultValue="">
            <option value="">Görsel yok</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Reklam metni (ortak)">{(p) => <Textarea {...p} name="primaryText" rows={3} />}</Field>
    </ActionForm>
  );
}

/** Durum geçiş butonu (onaya gönder / onayla / reddet / yeniden). */
export function AdDraftTransition({ id, to, label, variant = "secondary", requireNote = false }: { id: string; to: string; label: string; variant?: "primary" | "secondary" | "ghost"; requireNote?: boolean }) {
  return (
    <ActionForm action={transitionAdDraftAction} aria-label={label} className="!flex-row items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {requireNote ? <Input name="reviewNote" placeholder="Ret gerekçesi (opsiyonel)" className="h-8 text-[12px]" /> : null}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </ActionForm>
  );
}
