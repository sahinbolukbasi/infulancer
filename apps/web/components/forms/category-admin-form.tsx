"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { saveCategory } from "@/lib/actions/categories";

export function CategoryEditForm({
  roots,
  category,
}: {
  roots: { id: string; name: string }[];
  category?: { id: string; name: string; parentId: string | null; sort: number; active: boolean };
}) {
  return (
    <ActionForm action={saveCategory} resetOnSuccess={!category} submitLabel={category ? "Kaydet" : "Ekle"} submitSize="sm" aria-label="Kategori">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Ad">{(p) => <Input {...p} name="name" required minLength={2} maxLength={60} defaultValue={category?.name} />}</Field>
        <Field label="Üst kategori">
          {(p) => (
            <Select {...p} name="parentId" defaultValue={category?.parentId ?? ""}>
              <option value="">— Ana kategori —</option>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sıra">{(p) => <Input {...p} name="sort" type="number" min={0} max={9999} defaultValue={category?.sort ?? 500} />}</Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-fg-muted">
          <input type="checkbox" name="active" defaultChecked={category?.active ?? true} className="h-4 w-4 accent-[#fafafa]" />
          Aktif
        </label>
      </div>
    </ActionForm>
  );
}
