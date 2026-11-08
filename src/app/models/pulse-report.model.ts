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
