/**
 * Paid Pulse reports (backend survey/pulseReports.service.js).
 *   generating → ready (teaser, pay to unlock) | failed
 *   ready → in_review (paid, owner reviewing) → released (full report)
 */
export type PulseReportStatus = 'generating' | 'ready' | 'failed' | 'in_review' | 'released';

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
  createdAt: string | null;
  readyAt: string | null;
  paidAt: string | null;
  dueAt: string | null;
  releasedAt: string | null;
  publicUrl: string;
}
