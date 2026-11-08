import { describe, expect, it } from "vitest";
import { isPathHidden, type PagePermissionRow } from "../src/access/page-visibility";

const row = (scopeType: "ROLE" | "USER", scopeId: string, pathPrefix: string, allowed: boolean, id = Math.random().toString()): PagePermissionRow => ({ id, scopeType, scopeId, pathPrefix, allowed });

describe("K40 görünürlük planlayıcısı: rol + kişi istisnası", () => {
  const rows = [row("ROLE", "BRAND", "/marka/reklam", false), row("USER", "u1", "/marka/reklam", true), row("USER", "u2", "/marka/kesfet", false), row("ROLE", "AGENCY", "/admin/linkler", false)];
  it("rolde gizli sayfa kişiye açılabilir; diğerleri görmez", () => {
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/reklam")).toBe(false);
    expect(isPathHidden(rows, "BRAND", "u3", "/marka/reklam")).toBe(true);
    expect(isPathHidden(rows, "BRAND", "u3", "/marka/reklam/yeni")).toBe(true);
  });
  it("kişiye özel gizleme yalnız o kişiyi etkiler", () => {
    expect(isPathHidden(rows, "BRAND", "u2", "/marka/kesfet")).toBe(true);
    expect(isPathHidden(rows, "BRAND", "u1", "/marka/kesfet")).toBe(false);
  });
  it("ajans rolü kuralları admin'i etkilemez", () => {
    expect(isPathHidden(rows, "AGENCY", "a1", "/admin/linkler")).toBe(true);
    expect(isPathHidden(rows, "ADMIN", "a2", "/admin/linkler")).toBe(false);
  });
});
