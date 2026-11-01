import type {
  Assignment,
  Campaign,
  Deliverable,
} from "../generated/prisma/client";

/**
 * Marka ve influencer ekranlarına giden veri yalnızca bu eşleyicilerden geçer.
 * Beyaz liste yaklaşımı: alanlar tek tek seçilir; yeni bir kolon eklendiğinde
 * yanlışlıkla sızmaz.
 *
 * Marka: Assignment.feeKurus, commissionKurus, Campaign.budgetKurus ve diğer
 *        markalar görünmez; yalnızca brandTotalFeeKurus görünür.
 * Influencer: budgetKurus, brandTotalFeeKurus, commissionKurus ve diğer
 *        influencerlar görünmez; yalnızca kendi bedeli görünür.
 */

type InfluencerRef = { id: string; name: string };

export type BrandDeliverableInput = Deliverable & {
  assignment: { influencer: InfluencerRef };
};

export type BrandDeliverableView = {
  id: string;
  platform: Deliverable["platform"];
  contentType: Deliverable["contentType"];
  plannedAt: Date;
  approvalDeadline: Date;
  status: Deliverable["status"];
  postUrl: string | null;
  publishedAt: Date | null;
  caption: string | null;
  hashtags: string[];
  mentions: string[];
  link: string | null;
  disclosureRequired: boolean;
  influencer: InfluencerRef;
};

export function toBrandDeliverableView(d: BrandDeliverableInput): BrandDeliverableView {
  return {
    id: d.id,
    platform: d.platform,
    contentType: d.contentType,
    plannedAt: d.plannedAt,
    approvalDeadline: d.approvalDeadline,
    status: d.status,
    postUrl: d.postUrl,
    publishedAt: d.publishedAt,
    caption: d.caption,
    hashtags: d.hashtags,
    mentions: d.mentions,
    link: d.link,
    disclosureRequired: d.disclosureRequired,
    influencer: { id: d.assignment.influencer.id, name: d.assignment.influencer.name },
  };
}

export type BrandCampaignInput = Campaign & {
  assignments?: (Assignment & { influencer: InfluencerRef })[];
};

export type BrandCampaignView = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  status: Campaign["status"];
  startsAt: Date;
  endsAt: Date;
  targets: Campaign["targets"];
  brandTotalFeeKurus: number;
  closedAt: Date | null;
  reportSummary: string | null;
  influencers: { assignmentId: string; influencer: InfluencerRef }[];
};

export function toBrandCampaignView(c: BrandCampaignInput): BrandCampaignView {
  return {
    id: c.id,
    brandId: c.brandId,
    name: c.name,
    slug: c.slug,
    status: c.status,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    targets: c.targets,
    brandTotalFeeKurus: c.brandTotalFeeKurus,
    closedAt: c.closedAt,
    reportSummary: c.reportSummary,
    influencers: (c.assignments ?? [])
      .filter((a) => a.contractStatus !== "RED")
      .map((a) => ({
        assignmentId: a.id,
        influencer: { id: a.influencer.id, name: a.influencer.name },
      })),
  };
}

export type InfluencerDeliverableView = Omit<BrandDeliverableView, "influencer"> & {
  contractViolation: boolean;
};

export function toInfluencerDeliverableView(d: Deliverable): InfluencerDeliverableView {
  return {
    id: d.id,
    platform: d.platform,
    contentType: d.contentType,
    plannedAt: d.plannedAt,
    approvalDeadline: d.approvalDeadline,
    status: d.status,
    postUrl: d.postUrl,
    publishedAt: d.publishedAt,
    caption: d.caption,
    hashtags: d.hashtags,
    mentions: d.mentions,
    link: d.link,
    disclosureRequired: d.disclosureRequired,
    contractViolation: d.contractViolation,
  };
}

export type InfluencerAssignmentInput = Assignment & {
  campaign: Campaign & { brand: { name: string } };
  deliverables?: Deliverable[];
};

export type InfluencerAssignmentView = {
  id: string;
  feeKurus: number;
  contractStatus: Assignment["contractStatus"];
  exclusivityDays: number;
  exclusivityCategory: string | null;
  couponCode: string | null;
  campaign: {
    id: string;
    name: string;
    slug: string;
    status: Campaign["status"];
    startsAt: Date;
    endsAt: Date;
    brandName: string;
  };
  deliverables: InfluencerDeliverableView[];
};

export function toInfluencerAssignmentView(a: InfluencerAssignmentInput): InfluencerAssignmentView {
  return {
    id: a.id,
    feeKurus: a.feeKurus,
    contractStatus: a.contractStatus,
    exclusivityDays: a.exclusivityDays,
    exclusivityCategory: a.exclusivityCategory,
    couponCode: a.couponCode,
    campaign: {
      id: a.campaign.id,
      name: a.campaign.name,
      slug: a.campaign.slug,
      status: a.campaign.status,
      startsAt: a.campaign.startsAt,
      endsAt: a.campaign.endsAt,
      brandName: a.campaign.brand.name,
    },
    deliverables: (a.deliverables ?? []).map(toInfluencerDeliverableView),
  };
}
