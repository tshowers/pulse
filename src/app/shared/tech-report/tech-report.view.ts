import {
  ReportCover, ReportPreview, ReportRating, ReportSeverity, ReportStatus, StructuredReport,
} from '../../models/pulse-report.model';

/**
 * Everything the report template shows, worked out once from the report
 * (design handoff "Tech Rescue report redesign", 2026-11-09). The template
 * only binds these fields; nothing in it computes.
 *
 * mode 'full' is the released report; 'preview' is the free page before
 * payment: cover and verdict, then a blurred placeholder scorecard behind
 * the unlock card. The preview never has the locked data to begin with
 * (the server only sends ReportPreview).
 */

export type Tone = 'r' | 'a' | 'g';

export interface ReportViewInput {
  mode: 'full' | 'preview';
  report: StructuredReport | null;
  preview: ReportPreview | null;
  cover: ReportCover | null;
  ownerName: string;
  /** The pulse's title, e.g. "Tech Diagnosis". */
  productName: string;
  priceUsd: number;
  turnaroundHours: number;
}

export interface NavItem { id: string; num: string; title: string; }
export interface MetaItem { label: string; value: string; }
export interface Bar { x: number; y: number; width: number; height: number; center: number; fill: string; opacity: number; value: string; label: string; }

export interface ReportView {
  mode: 'full' | 'preview';
  ownerName: string;
  initials: string;
  productName: string;
  eyebrow: string;
  client: string;
  project: string;
  meta: MetaItem[];
  /** The PDF cover's 2x2 grid: prepared for / date / prepared by / report. */
  pdfMeta: MetaItem[];
  ownerWebsite: string;
  status: { tone: Tone; label: string; };
  statusNote: string;
  verdict: string;
  actions: { num: number; title: string; detail: string; }[];
  nav: NavItem[];
  num: Record<string, string>;
  scorecardIntro: string;
  tiles: { area: string; tone: Tone; label: string; note: string; segments: boolean[]; }[];
  cost: null | { stats: { value: string; label: string; }[]; headline: string; footnote: string; bars: Bar[]; };
  severityCounts: { label: string; cls: ReportSeverity; }[];
  findings: { code: string; severity: ReportSeverity; severityLabel: string; meta: string; title: string; saw: string; why: string; assumption: string; good: string; }[];
  plan: { week: string; title: string; steps: string[]; milestone: string; first: boolean; }[];
  decision: null | { intro: string; options: { name: string; tone: Tone; tag: string; criteria: string[]; }[]; };
  questions: { num: string; text: string; }[];
  questionsTitle: string;
  decisionTitle: string;
  heard: string[];
  scope: string;
  signoff: string;
  reportId: string;
  confidential: string;
  unlockItems: string[];
  unlockLabel: string;
  unlockNote: string;
  printHeaderLeft: string;
  printHeaderRight: string;
  printFooterLeft: string;
}

const STATUS: Record<ReportStatus, { tone: Tone; label: string; }> = {
  off_track: { tone: 'r', label: 'Off track' },
  at_risk: { tone: 'a', label: 'At risk' },
  on_track: { tone: 'g', label: 'On track' },
};
const TONE: Record<ReportRating, Tone> = { red: 'r', amber: 'a', green: 'g' };
const SEVERITY_LABEL: Record<ReportSeverity, string> = { critical: 'Critical', high: 'High', medium: 'Medium' };

/** "$180K", "$1.2M", "$950". */
export function money ( value: number ): string {
  const abs = Math.abs( value );
  if ( abs >= 1_000_000 ) return `$${trim( value / 1_000_000 )}M`;
  if ( abs >= 1_000 ) return `$${trim( value / 1_000 )}K`;
  return `$${Math.round( value )}`;
}

function trim ( value: number ): string {
  return ( Math.round( value * 10 ) / 10 ).toString();
}

export function initialsOf ( name: string ): string {
  return ( name || '' ).split( /\s+/ ).filter( ( word ) => /[A-Za-z0-9]/.test( word ) ).slice( 0, 2 ).map( ( word ) => word[0].toUpperCase() ).join( '' );
}

export function longDate ( iso: string | null | undefined ): string {
  if ( !iso ) return '';
  const date = new Date( iso );
  return Number.isNaN( date.getTime() ) ? '' : date.toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', year: 'numeric' } );
}

/** The bar chart: today navy, then brass at 55%, the last bar full brass (420x230 viewBox). */
export function costBars ( projection: { label: string; value: number; }[] ): Bar[] {
  const points = projection.slice( 0, 6 );
  if ( points.length < 2 ) return [];
  const max = Math.max( ...points.map( ( point ) => point.value ), 1 );
  const slot = 400 / points.length;
  const width = Math.min( 52, slot - 20 );
  return points.map( ( point, index ) => {
    const height = Math.max( 6, Math.round( ( point.value / max ) * 166 ) );
    const x = Math.round( 10 + slot * index + ( slot - width ) / 2 );
    const last = index === points.length - 1;
    return {
      x, y: 200 - height, width, height, center: x + width / 2,
      fill: index === 0 ? '#0d1b2e' : '#c9a36a',
      opacity: index === 0 || last ? 1 : 0.55,
      value: money( point.value ),
      label: point.label,
    };
  } );
}

function plural ( count: number, word: string ): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function buildReportView ( input: ReportViewInput ): ReportView | null {
  const full = input.mode === 'full' ? input.report : null;
  const head = full || input.preview;
  if ( !head ) return null;
  const cover = input.cover || { preparedFor: '', preparedBy: '', date: null, reportId: '', ownerTagline: '', ownerWebsite: '' };
  const ownerName = input.ownerName || cover.preparedBy;
  const productName = input.productName || 'Diagnostic';
  const client = head.client || cover.preparedFor;
  const date = longDate( cover.date );
  const preparedFor = cover.preparedFor && head.client && cover.preparedFor !== head.client ? `${cover.preparedFor} · ${head.client}` : ( cover.preparedFor || head.client );

  // Section numbers follow what's actually there: no cost, no gap.
  const order: { id: string; title: string; show: boolean; }[] = [
    { id: 'verdict', title: 'The verdict', show: true },
    { id: 'scorecard', title: 'Health scorecard', show: !!full?.scorecard.length },
    { id: 'cost', title: 'Cost of waiting', show: !!full?.cost },
    { id: 'findings', title: 'Findings', show: !!full?.findings.length },
    { id: 'plan', title: '30-day plan', show: !!full?.plan.length },
    { id: 'decision', title: 'Keep, fix or replace', show: !!full?.decision },
    { id: 'questions', title: 'Questions to ask', show: !!full?.questions.length },
  ];
  const num: Record<string, string> = {};
  const nav: NavItem[] = [];
  order.filter( ( item ) => item.show ).forEach( ( item, index ) => {
    num[item.id] = String( index + 1 ).padStart( 2, '0' );
    nav.push( { id: item.id, num: num[item.id], title: item.title } );
  } );
  if ( full && ( full.heard.length || full.scope ) ) {
    num['appendix'] = 'A';
    nav.push( { id: 'appendix', num: 'A', title: 'What we heard' } );
  }

  const counts = ( ['critical', 'high', 'medium'] as ReportSeverity[] )
    .map( ( severity ) => ( { severity, count: full?.findings.filter( ( finding ) => finding.severity === severity ).length || 0 } ) )
    .filter( ( item ) => item.count );

  const cost = full?.cost || null;
  const stats: { value: string; label: string; }[] = [];
  if ( cost?.spent !== null && cost?.spent !== undefined ) stats.push( { value: money( cost.spent ), label: 'Spent so far' } );
  if ( cost?.monthsBehind !== null && cost?.monthsBehind !== undefined ) stats.push( { value: plural( cost.monthsBehind, 'month' ), label: 'Behind schedule' } );
  if ( cost?.monthlyCost !== null && cost?.monthlyCost !== undefined ) stats.push( { value: money( cost.monthlyCost ), label: 'Every further month of delay' } );

  // The unlock card's checklist counts what's really in this report.
  const findingCount = full ? full.findings.length : input.preview?.findingCount || 0;
  const hasDecision = full ? !!full.decision : !!input.preview?.hasDecision;
  const unlockItems = [
    findingCount ? `${plural( findingCount, 'finding' )} with fixes` : '',
    full ? full.plan.length ? '30-day recovery plan' : '' : input.preview?.hasPlan ? '30-day recovery plan' : '',
    hasDecision ? 'Keep / fix / replace test' : '',
    ( full ? full.questions.length : input.preview?.hasQuestions ) ? 'Questions to ask your team or vendor' : '',
    'PDF to share with your team',
  ].filter( Boolean );

  return {
    mode: input.mode,
    ownerName,
    initials: initialsOf( ownerName ) || '•',
    productName,
    eyebrow: `${productName} · Confidential`,
    client,
    project: head.project,
    meta: [
      { label: 'Prepared for', value: preparedFor },
      { label: 'Prepared by', value: cover.preparedBy || ownerName },
      { label: 'Date', value: date },
      { label: 'Report', value: cover.reportId },
    ].filter( ( item ) => item.value ),
    pdfMeta: [
      { label: 'Prepared for', value: cover.preparedFor || head.client },
      { label: 'Date', value: date },
      { label: 'Prepared by', value: cover.preparedBy || ownerName },
      { label: 'Report', value: cover.reportId },
    ].filter( ( item ) => item.value ),
    ownerWebsite: cover.ownerWebsite,
    status: STATUS[head.status] || STATUS.at_risk,
    statusNote: head.statusNote,
    verdict: head.verdict,
    actions: head.actions.map( ( action, index ) => ( { num: index + 1, title: action.title, detail: action.detail } ) ),
    nav,
    num,
    scorecardIntro: full ? `${plural( full.scorecard.length, 'area' ).replace( /^(\d+)/, ( n ) => ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][Number( n )] || n )} that decide whether this recovers. Rated from your answers; the debrief confirms them.` : '',
    tiles: ( full?.scorecard || [] ).map( ( tile ) => ( {
      area: tile.area, tone: TONE[tile.rating] || 'a', label: tile.label, note: tile.note,
      segments: [1, 2, 3, 4, 5].map( ( n ) => n <= tile.level ),
    } ) ),
    cost: cost ? { stats, headline: cost.headline, footnote: cost.footnote, bars: costBars( cost.projection ) } : null,
    severityCounts: counts.map( ( item ) => ( { label: `${item.count} ${SEVERITY_LABEL[item.severity]}`, cls: item.severity } ) ),
    findings: ( full?.findings || [] ).map( ( finding, index ) => ( {
      code: `F${index + 1}`,
      severity: finding.severity,
      severityLabel: SEVERITY_LABEL[finding.severity],
      meta: [finding.when, finding.owner].filter( Boolean ).join( ' · ' ),
      title: finding.title, saw: finding.saw, why: finding.why, assumption: finding.assumption, good: finding.good,
    } ) ),
    plan: ( full?.plan || [] ).map( ( week, index ) => ( { ...week, first: index === 0 } ) ),
    decision: full?.decision ? {
      intro: full.decision.intro,
      options: full.decision.options.map( ( option ) => ( { name: option.name, tone: TONE[option.tone] || 'a', tag: option.tag, criteria: option.criteria } ) ),
    } : null,
    questions: ( full?.questions || [] ).map( ( text, index ) => ( { num: String( index + 1 ).padStart( 2, '0' ), text } ) ),
    questionsTitle: 'Questions to ask',
    decisionTitle: 'Keep, fix or replace',
    heard: full?.heard || [],
    scope: full?.scope || '',
    signoff: [cover.ownerTagline, cover.reportId, date].filter( Boolean ).join( ' · ' ),
    reportId: cover.reportId,
    confidential: `Confidential · Prepared for ${client}`,
    unlockItems,
    unlockLabel: `Get the full report · $${input.priceUsd}`,
    unlockNote: `Delivered within ${input.turnaroundHours || 24} hours of payment.`,
    printHeaderLeft: `${ownerName} · ${productName}`.toUpperCase(),
    printHeaderRight: client.toUpperCase(),
    printFooterLeft: `CONFIDENTIAL${cover.reportId ? ' · ' + cover.reportId : ''}`,
  };
}
