/**
 * Paid Pulse reports (backend survey/pulseReports.service.js).
 *   generating → ready (teaser, pay to unlock) | failed
 *   ready → in_review (paid, owner reviewing) → released (full report)
 *   generating → referred (outside the owner's work: free providers from Find)
 */
export type PulseReportStatus = 'generating' | 'ready' | 'failed' | 'in_review' | 'released' | 'referred';

/** A local provider from Find (the free referral path). */
export interface PulseReferralProvider { name: string; url: string; displayUrl: string; phone: string; address: string; rating: string; description: string; }

export interface PulseReferral { headline: string; message: string; postalCode: string; providers: PulseReferralProvider[]; }

export interface PulseReportIssue { title: string; severity: 'critical' | 'high' | 'medium'; }

export interface PulseReportTeaser { headline: string; summary: string; issues: PulseReportIssue[]; }

/**
 * The structured report (backend survey/pulseReportStructure.js; design
 * handoff "Tech Rescue report redesign", 2026-11-09). Reports written before
 * it have reportMarkdown instead and structured is null.
 */
export type ReportStatus = 'off_track' | 'at_risk' | 'on_track';
export type ReportRating = 'red' | 'amber' | 'green';
export type ReportSeverity = 'critical' | 'high' | 'medium';
export interface ReportAction { title: string; detail: string; }
export interface ReportTile { area: string; rating: ReportRating; level: number; label: string; note: string; }
export interface ReportCost { spent: number | null; monthsBehind: number | null; monthlyCost: number | null; projection: { label: string; value: number; }[]; headline: string; footnote: string; }
export interface ReportFinding { severity: ReportSeverity; title: string; saw: string; why: string; assumption: string; good: string; when: string; owner: string; }
export interface ReportWeek { week: string; title: string; steps: string[]; milestone: string; }
export interface ReportDecisionOption { name: string; tone: ReportRating; tag: string; criteria: string[]; }
export interface ReportDecision { intro: string; options: ReportDecisionOption[]; }
export interface StructuredReport {
  client: string;
  project: string;
  status: ReportStatus;
  statusNote: string;
  verdict: string;
  actions: ReportAction[];
  scorecard: ReportTile[];
  cost: ReportCost | null;
  findings: ReportFinding[];
  plan: ReportWeek[];
  decision: ReportDecision | null;
  questions: string[];
  heard: string[];
  scope: string;
}

/** The free preview: cover, verdict and the three actions; the rest is only counted. */
export interface ReportPreview {
  client: string;
  project: string;
  status: ReportStatus;
  statusNote: string;
  verdict: string;
  actions: ReportAction[];
  findingCount: number;
  hasPlan: boolean;
  hasDecision: boolean;
  hasQuestions: boolean;
}

/** Cover and sign-off details the server fills in. */
export interface ReportCover {
  preparedFor: string;
  preparedBy: string;
  date: string | null;
  reportId: string;
  /** "IT consulting · Seattle" from the owner's business profile, or ''. */
  ownerTagline: string;
  /** "taliferro.com", or ''. */
  ownerWebsite: string;
  /** The owner's brand logo (Profile > Brand), or '' for initials. */
  ownerLogoUrl?: string;
}

/** The respondent's private page. Full report only once released. */
export interface PulseReportPublic {
  token: string;
  status: PulseReportStatus;
  surveyTitle: string;
  ownerName: string;
  firstName: string;
  productName: string;
  priceUsd: number;
  turnaroundHours: number;
  teaser: PulseReportTeaser | null;
  paidAt: string | null;
  dueAt: string | null;
  releasedAt: string | null;
  debriefUrl: string;
  reportMarkdown: string;
  /** The full structured report, only once released. */
  structured?: StructuredReport | null;
  /** The free preview (ready, in_review, released) for structured reports. */
  preview?: ReportPreview | null;
  cover?: ReportCover | null;
  referral: PulseReferral | null;
  /** The owner's Meta Pixel (digits) or ''. */
  metaPixelId?: string;
}

/** The owner's review queue. */
export interface PulseReportOwner {
  token: string;
  status: PulseReportStatus;
  respondent: { name: string; email: string; };
  surveyId: string;
  responseId: string;
  priceUsd: number;
  productName: string;
  teaser: PulseReportTeaser | null;
  reportMarkdown: string;
  /** Null for reports written before the structured redesign. */
  structured?: StructuredReport | null;
  reportId?: string;
  ownerName?: string;
  edited: boolean;
  failureReason: string;
  path: 'report' | 'referral';
  referral: PulseReferral | null;
  createdAt: string | null;
  readyAt: string | null;
  paidAt: string | null;
  dueAt: string | null;
  releasedAt: string | null;
  publicUrl: string;
}
