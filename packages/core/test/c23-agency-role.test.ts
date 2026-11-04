import { describe, expect, it } from "vitest";
import { requireRole, toAuditActor } from "../src/access/actor";

describe("ajans rolü", () => {
  it("ADMIN yetkisiyle çalışır ama denetim kaydına AGENCY yazılır", () => {
    const actor = { userId: "u1", role: "ADMIN" as const, staffRole: "AGENCY" as const };
    expect(requireRole(actor, "ADMIN").userId).toBe("u1");
    expect(toAuditActor(actor)).toEqual({ id: "u1", role: "AGENCY" });
    expect(toAuditActor({ userId: "u2", role: "ADMIN" })).toEqual({ id: "u2", role: "ADMIN" });
  });
});
