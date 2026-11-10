import { StructuredReport } from '../../models/pulse-report.model';
import { buildReportView, costBars, money } from './tech-report.view';

const REPORT: StructuredReport = {
  client: 'Acme Storage', project: 'Platform replacement', status: 'off_track', statusNote: 'Recoverable in 30 days',
  verdict: 'Nobody agreed what done means.',
  actions: [{ title: 'A', detail: '' }, { title: 'B', detail: '' }, { title: 'C', detail: '' }],
  scorecard: [{ area: 'Delivery', rating: 'red', level: 1, label: 'Off track', note: '' }],
  cost: null,
  findings: [
    { severity: 'critical', title: 'F one', saw: '', why: '', assumption: '', good: '', when: 'Week 1', owner: 'You' },
    { severity: 'high', title: 'F two', saw: '', why: '', assumption: '', good: '', when: '', owner: '' },
  ],
  plan: [], decision: null, questions: ['Q?'], heard: ['Heard.'], scope: 'Scope.',
};
const COVER = { preparedFor: 'Tennal Jennings', preparedBy: 'Taliferro Tech', date: '2026-11-07T18:00:00.000Z', reportId: 'TR-2026-0142', ownerTagline: 'IT consulting · Seattle', ownerWebsite: '' };
const input = { mode: 'full' as const, report: REPORT, preview: null, cover: COVER, ownerName: 'Taliferro Tech', productName: 'Tech Diagnosis', priceUsd: 999, turnaroundHours: 24 };

describe( 'the report view', () => {
  it( 'writes money the way the design does', () => {
    expect( money( 180000 ) ).toBe( '$180K' );
    expect( money( 1250000 ) ).toBe( '$1.3M' );
    expect( money( 950 ) ).toBe( '$950' );
  } );

  it( 'numbers only the sections that are there, so missing ones leave no gap', () => {
    const view = buildReportView( input )!;
    expect( view.nav.map( ( item ) => `${item.num} ${item.title}` ) ).toEqual( ['01 The verdict', '02 Health scorecard', '03 Findings', '04 Questions to ask', 'A What we heard'] );
    expect( view.cost ).toBeNull();
    expect( view.decision ).toBeNull();
  } );

  it( 'labels every status with words, not just a color', () => {
    const view = buildReportView( input )!;
    expect( view.status ).toEqual( { tone: 'r', label: 'Off track' } );
    expect( view.tiles[0].segments ).toEqual( [true, false, false, false, false] );
    expect( view.severityCounts.map( ( s ) => s.label ) ).toEqual( ['1 Critical', '1 High'] );
    expect( view.findings[0].meta ).toBe( 'Week 1 · You' );
  } );

  it( 'fills the cover and sign-off from the server, and the PDF running header and footer', () => {
    const view = buildReportView( input )!;
    expect( view.meta ).toEqual( [
      { label: 'Prepared for', value: 'Tennal Jennings · Acme Storage' },
      { label: 'Prepared by', value: 'Taliferro Tech' },
      { label: 'Date', value: 'November 7, 2026' },
      { label: 'Report', value: 'TR-2026-0142' },
    ] );
    expect( view.signoff ).toBe( 'IT consulting · Seattle · TR-2026-0142 · November 7, 2026' );
    expect( [view.printHeaderLeft, view.printHeaderRight, view.printFooterLeft] ).toEqual( ['TALIFERRO TECH · TECH DIAGNOSIS', 'ACME STORAGE', 'CONFIDENTIAL · TR-2026-0142'] );
  } );

  it( 'uses the owner\'s brand logo when there is one, initials otherwise', () => {
    expect( buildReportView( input )!.logoUrl ).toBe( '' );
    expect( buildReportView( input )!.initials ).toBe( 'TT' );
    expect( buildReportView( { ...input, cover: { ...COVER, ownerLogoUrl: 'https://x/logo.png' } } )!.logoUrl ).toBe( 'https://x/logo.png' );
  } );

  it( 'the preview counts what is locked from the preview alone', () => {
    const view = buildReportView( { ...input, mode: 'preview', report: null, preview: {
      client: 'Acme Storage', project: 'P', status: 'at_risk', statusNote: '', verdict: 'V', actions: REPORT.actions,
      findingCount: 5, hasPlan: true, hasDecision: false, hasQuestions: true,
    } } )!;
    expect( view.nav.map( ( item ) => item.id ) ).toEqual( ['verdict'] );
    expect( view.unlockItems ).toEqual( ['5 findings with fixes', '30-day recovery plan', 'Questions to ask your team or vendor', 'PDF to share with your team'] );
    expect( view.unlockLabel ).toBe( 'Get the full report · $999' );
  } );

  it( 'draws the cost chart: today navy, the last bar full brass, the rest faded', () => {
    const bars = costBars( [{ label: 'Today', value: 180000 }, { label: 'Dec', value: 195000 }, { label: 'Mar', value: 240000 }] );
    expect( bars.map( ( b ) => [b.fill, b.opacity] ) ).toEqual( [['#0d1b2e', 1], ['#c9a36a', 0.55], ['#c9a36a', 1]] );
    expect( bars[2].height ).toBe( 166 );
    expect( costBars( [{ label: 'Today', value: 1 }] ) ).toEqual( [] );
  } );
} );
