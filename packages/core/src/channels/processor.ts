import { prisma } from "../db";
import { getConfig, setConfig } from "../config/store";
import { captureOptOut, OPT_OUT_RE } from "../compliance/iys";
import type { ChannelProvider } from "../generated/prisma/enums";
import { runAgentTurn } from "../assistant/runtime";
import { prescreenCreator } from "../assistant/prescreen";
import { purgeMessage } from "../messaging/purge";
import { bumpDailyStat } from "../messaging/send";
import { applyTemplateQuality, applyTemplateStatus, mapQuality, mapStatusEvent } from "../messaging/templates";
import { readLimitFromEvent } from "../messaging/tiers";
import { onInbound } from "../messaging/windows";
import { firstSeen, rawBodies } from "./webhook";

/**
 * Webhook işlemcisi: external_ids → tenant_id çözümleme, dedupe, olay türüne göre dağıtım.
 * Sıralama garantisi yoktur: durum güncellemeleri zaman damgasına göre last-write-wins.
 */
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function processRawWebhook(rawId: string, bodyOverride?: string) {
  const raw = await prisma.rawWebhook.findUnique({ where: { id: rawId } });
  if (!raw || raw.processedAt) return { skipped: true };
  const body = bodyOverride ?? rawBodies.get(rawId);
  rawBodies.delete(rawId);
  if (!body) {
    await prisma.rawWebhook.update({ where: { id: rawId }, data: { error: "gövde bulunamadı (S3'ten yeniden okunmalı)" } });
    return { skipped: true };
  }
  let tenantId: string | null = null;
  try {
    const payload = JSON.parse(body) as Any;
    tenantId = await dispatch(payload);
    await prisma.rawWebhook.update({ where: { id: rawId }, data: { processedAt: new Date(), tenantId } });
    return { skipped: false, tenantId };
  } catch (err) {
    await prisma.rawWebhook.update({ where: { id: rawId }, data: { error: String((err as Error).message).slice(0, 500) } });
    throw err;
  }
}

async function tenantByPhoneNumberId(id: string) {
  const n = await prisma.whatsAppNumber.findUnique({ where: { phoneNumberId: id } });
  return n?.tenantId ?? null;
}

async function tenantByExternal(provider: ChannelProvider, key: string, value: string) {
  const c = await prisma.channelConnection.findFirst({ where: { provider, externalIds: { path: [key], equals: value } } });
  return c?.tenantId ?? null;
}

async function dispatch(p: Any): Promise<string | null> {
  if (p.object === "whatsapp_business_account") {
    let tenant: string | null = null;
    for (const entry of p.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        const t = v.metadata?.phone_number_id ? await tenantByPhoneNumberId(v.metadata.phone_number_id) : await tenantByExternal("WHATSAPP", "waba_id", String(entry.id));
        tenant ??= t;
        if (!t) continue;
        await handleWhatsAppChange(t, change.field, v);
      }
    }
    return tenant;
  }
  if (p.object === "instagram" || p.object === "page") {
    const provider: ChannelProvider = p.object === "instagram" ? "INSTAGRAM" : "MESSENGER";
    let tenant: string | null = null;
    for (const entry of p.entry ?? []) {
      const t = await tenantByExternal(provider, provider === "INSTAGRAM" ? "ig_user_id" : "page_id", String(entry.id));
      tenant ??= t;
      if (!t) continue;
      for (const m of entry.messaging ?? []) await handleMetaMessaging(t, provider, m);
    }
    return tenant;
  }
  return null;
}

async function handleWhatsAppChange(tenantId: string, field: string, v: Any) {
  if (field === "messages") {
    const contacts = new Map<string, string>((v.contacts ?? []).map((c: Any) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages ?? []) {
      if (!(await firstSeen(m.id, "whatsapp"))) continue;
      const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? null;
      await handleInbound(tenantId, "WHATSAPP", {
        externalMessageId: m.id,
        from: m.from,
        phoneE164: `+${m.from}`,
        name: contacts.get(m.from) ?? null,
        text,
        at: new Date(Number(m.timestamp) * 1000),
        fromAd: m.referral?.source_type === "ad" || !!m.referral?.ctwa_clid,
      });
    }
    for (const s of v.statuses ?? []) await applyMessageStatus(tenantId, s.id, s.status, new Date(Number(s.timestamp) * 1000));
    return;
  }
  if (field === "message_template_status_update" || field === "template_category_update") {
    const t = await prisma.messageTemplate.findFirst({ where: { tenantId, OR: [{ externalId: String(v.message_template_id) }, { name: v.message_template_name }] } });
    const st = mapStatusEvent(String(v.event ?? ""));
    if (t && st) await applyTemplateStatus(t.id, st, new Date());
    return;
  }
  if (field === "message_template_quality_update") {
    const t = await prisma.messageTemplate.findFirst({ where: { tenantId, OR: [{ externalId: String(v.message_template_id) }, { name: v.message_template_name }] } });
    if (t) await applyTemplateQuality(t.id, mapQuality(String(v.new_quality_score ?? "")));
    return;
  }
  if (field === "phone_number_quality_update") {
    const limit = readLimitFromEvent(v);
    const num = await prisma.whatsAppNumber.findUnique({ where: { tenantId } });
    if (num) {
      await prisma.whatsAppNumber.update({
        where: { id: num.id },
        data: { ...(limit ? { messagingLimit: limit } : {}), qualityRating: v.event ?? num.qualityRating, throughputLevel: v.throughput?.level ?? num.throughputLevel },
      });
    }
    // Throughput doğrulanmadı: ölçülen seviyeyi config'e yaz, hard-code etme.
    if (v.throughput?.level) {
      const map = await getConfig("whatsapp.throughputByLevel");
      if (typeof v.throughput.mps === "number") await setConfig("whatsapp.throughputByLevel", { ...map, [v.throughput.level]: v.throughput.mps });
    }
    return;
  }
  if (field === "business_capability_update" || field === "account_update" || field === "account_alerts") {
    if (String(v.event ?? v.alert_type ?? "").includes("INCREASED_CAPABILITIES_ELIGIBILITY_NEED_MORE_INFO")) {
      await prisma.whatsAppNumber.updateMany({ where: { tenantId }, data: { onboardingStep: "identity_verification" } });
    }
  }
}

/** Durum güncellemesi: last-write-wins (sıralama garantisi yok). */
export async function applyMessageStatus(tenantId: string, externalId: string, status: string, at: Date) {
  await prisma.message.updateMany({
    where: { tenantId, externalId, OR: [{ statusAt: null }, { statusAt: { lt: at } }] },
    data: { status, statusAt: at },
  });
}

async function handleMetaMessaging(tenantId: string, provider: ChannelProvider, m: Any) {
  const msg = m.message ?? {};
  if (msg.is_deleted || m.message_deletes) {
    const mid = msg.mid ?? m.message_deletes?.mid;
    if (mid) await purgeMessage(tenantId, { externalId: mid });
    return;
  }
  if (!msg.mid || msg.is_echo) return;
  if (!(await firstSeen(msg.mid, provider.toLowerCase()))) return;
  await handleInbound(tenantId, provider, {
    externalMessageId: msg.mid,
    from: m.sender?.id,
    phoneE164: null,
    name: null,
    text: msg.text ?? null,
    at: new Date(Number(m.timestamp ?? Date.now())),
    fromAd: !!m.referral?.ad_id || m.referral?.source === "ADS",
    mediaUrl: msg.attachments?.[0]?.payload?.url ?? null,
  });
}

export type InboundInput = {
  externalMessageId: string;
  from: string;
  phoneE164: string | null;
  name: string | null;
  text: string | null;
  at: Date;
  fromAd: boolean;
  mediaUrl?: string | null;
};

export async function handleInbound(tenantId: string, channel: ChannelProvider, input: InboundInput) {
  const cfg = {
    serviceWindowHours: await getConfig("whatsapp.serviceWindowHours"),
    fepWindowDays: await getConfig("whatsapp.fepWindowDays"),
    humanAgentWindowDays: await getConfig("whatsapp.humanAgentWindowDays"),
  };
  const contact = await prisma.contact.upsert({
    where: { tenantId_channel_externalId: { tenantId, channel, externalId: input.from } },
    create: { tenantId, channel, externalId: input.from, phoneE164: input.phoneE164, name: input.name },
    update: input.name ? { name: input.name } : {},
  });
  let conv = await prisma.conversation.findFirst({ where: { tenantId, contactId: contact.id, status: { not: "closed" } }, orderBy: { createdAt: "desc" } });
  const isFirst = !conv;
  conv ??= await prisma.conversation.create({ data: { tenantId, channel, contactId: contact.id, agentKey: input.fromAd ? "campaign_welcome" : null } });
  const w = onInbound(conv, input.at, channel, { fromAd: input.fromAd, isFirstMessage: isFirst }, cfg);
  conv = await prisma.conversation.update({ where: { id: conv.id }, data: { ...w, lastInboundAt: input.at } });
  await prisma.message.create({
    data: { tenantId, conversationId: conv.id, externalId: input.externalMessageId, direction: "INBOUND", body: input.text, mediaUrl: input.mediaUrl ?? null, createdAt: input.at },
  });
  await bumpDailyStat(prisma, tenantId, channel, "INBOUND", input.at, 1);

  if (input.text && OPT_OUT_RE.test(input.text) && contact.phoneE164) {
    await captureOptOut(tenantId, contact.phoneE164, "MESAJ", `${channel.toLowerCase()}_opt_out`, input.at).catch(() => undefined);
    return { conversationId: conv.id, optOut: true };
  }
  if (input.text) {
    const pre = await prescreenCreator(tenantId, conv.id, input.text);
    if (!pre.handled) await runAgentTurn(tenantId, conv.id, input.text, input.at);
  }
  return { conversationId: conv.id, optOut: false };
}
