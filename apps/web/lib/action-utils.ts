import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { DomainError, isDomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "./action-state";

// Zod varsayılan mesajları Türkçe.
z.config(z.locales.tr());

/**
 * Server Action gövdesini sarar: DomainError / zod / benzersizlik hatalarını
 * Türkçe { error } durumuna çevirir; redirect/notFound gibi Next hatalarını geçirir.
 */
export async function attempt(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    return toErrorState(err);
  }
}

export function toErrorState(err: unknown): ActionState {
  if (isDomainError(err)) {
    const conflicts =
      err.code === "CAKISMA"
        ? ((err.details?.conflicts as { message: string }[] | undefined) ?? []).map((c) => c.message)
        : undefined;
    return { error: err.message, conflicts };
  }
  if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Form geçersiz." };
  if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
    return { error: "Bu değer zaten kullanılıyor; benzersiz olmalı." };
  }
  console.error("[action]", err);
  return { error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." };
}

/** Zod ile ayrıştırır; ilk hatayı alan etiketiyle birlikte Türkçe DomainError olarak fırlatır. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown, labels: Record<string, string> = {}): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const key = String(issue?.path[0] ?? "");
  const label = labels[key];
  throw new DomainError("DOGRULAMA", label ? `${label}: ${issue?.message}` : (issue?.message ?? "Form geçersiz."));
}

/** FormData'dan kırpılmış metin ("" yoksa). */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key);
  return v === "on" || v === "true" || v === "1";
}

/** Satır başına bir öğe. */
export function lines(v: string): string[] {
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Boşluk/virgülle ayrılmış etiketler (tekrarlar atılır). */
export function tags(v: string): string[] {
  return [...new Set(v.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

/** "12.500,50" / "12500.50" / "12500" TL → kuruş. Geçersizse NaN. */
export function tlToKurus(v: string): number {
  const cleaned = v.replace(/\s|₺|TL/gi, "");
  if (cleaned === "") return NaN;
  // Türkçe gösterim: nokta binlik, virgül ondalık ayraç. Hem "2.500.000" hem "2500000,50" kabul edilir.
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, ""); // yalnız binlik ayracı olan noktalar
  } else {
    normalized = cleaned;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

/** Boşsa null, değilse tam sayı (geçersizse NaN). */
export function intOrNull(v: string): number | null {
  if (v === "") return null;
  const cleaned = v.replace(/[\s.]/g, "");
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : NaN;
}

/** Tüm rol arayüzlerini yeniler (veri birden çok ekranda görünür). */
export function revalidateAll(): void {
  revalidatePath("/", "layout");
}
