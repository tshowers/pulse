/**
 * The redesigned paid report (design handoff "Tech Rescue report redesign",
 * 2026-11-09) on the respondent's page, /report/:token. The API is stubbed
 * with the design's Acme Storage sample.
 */
const TOKEN = 'a'.repeat( 48 );

const finding = ( severity: string, title: string, when: string, owner: string, assumption = '' ) => ( {
  severity, title, when, owner, assumption,
  saw: 'You listed integrations that keep breaking as a top pain. These connect to your billing platform and customer records.',
  why: 'A broken billing connection can mean customers billed wrongly or not at all. Those errors cost money directly.',
  good: 'Every failed sync is logged and someone is alerted the same day.',
} );

const STRUCTURED = {
  client: 'Acme Storage',
  project: 'Platform replacement project',
  status: 'at_risk',
  statusNote: 'Recoverable in 30 days',
  verdict: 'Acme Storage can’t see real progress because nobody has agreed what “done” means, and the agency holds all the knowledge needed to judge its own work.',
  actions: [
    { title: 'Put a daily check on billing and customer sync', detail: 'So broken connections are caught the same day, before customers notice.' },
    { title: 'Write down what “done” means for the 10 features that matter most', detail: 'Nothing counts as finished until it passes those checks in a live demo.' },
    { title: 'Confirm you own the code and the cloud accounts', detail: 'You can’t judge, or replace, an agency that holds the only keys.' },
  ],
  scorecard: [
    { area: 'Delivery', rating: 'red', level: 1, label: 'Off track', note: 'Three months late. Sprints on paper, not in practice.' },
    { area: 'Integrations', rating: 'red', level: 1, label: 'Off track', note: 'Billing and customer sync keep breaking.' },
    { area: 'Definition of done', rating: 'red', level: 1, label: 'Missing', note: 'No shared acceptance criteria for features.' },
    { area: 'Vendor dependency', rating: 'amber', level: 2, label: 'At risk', note: 'The agency holds all system knowledge.' },
    { area: 'Team follow-up', rating: 'amber', level: 2, label: 'At risk', note: 'Follow-up with customers and vendors “often doesn’t” happen.' },
    { area: 'Architecture', rating: 'amber', level: 3, label: 'Unverified', note: 'Standard stack: React, Node.js, PostgreSQL, AWS. Not yet reviewed.' },
  ],
  cost: {
    spent: 180000, monthsBehind: 3, monthlyCost: 15000,
    projection: [{ label: 'Today', value: 180000 }, { label: 'Dec', value: 195000 }, { label: 'Jan', value: 210000 }, { label: 'Feb', value: 225000 }, { label: 'Mar', value: 240000 }],
    headline: 'About $240K spent by March, with no launch date you can trust.',
    footnote: 'Based on your own estimates. Development cost only.',
  },
  findings: [
    finding( 'critical', 'Billing and customer integrations keep breaking', 'Week 1', 'Agency builds it · you verify', 'We don’t know if the new system is already live and touching real billing.' ),
    finding( 'critical', 'Nobody has agreed what “done” means', 'Week 2', 'You and the agency' ),
    finding( 'high', 'The agency holds all the knowledge', 'Week 3', 'You · independent reviewer' ),
    finding( 'high', 'Status reports don’t match results', 'Week 2', 'Agency · you attend' ),
    finding( 'medium', 'Fixes create new breakage', 'Weeks 3-4', 'Agency' ),
  ],
  plan: [
    { week: 'Week 1', title: 'Stop the bleeding', steps: ['Turn on logging and alerts for every sync', 'Daily billing reconciliation check', 'Pause new features until sync is stable'], milestone: 'Sync failures visible the same day' },
    { week: 'Week 2', title: 'Define done', steps: ['Acceptance checks for the top 10 features', 'Replace status reports with a live demo', 'Re-rank remaining work by business value'], milestone: 'Signed checks for 10 features' },
    { week: 'Week 3', title: 'Take back the knowledge', steps: ['Confirm ownership of code and AWS accounts', 'Recorded architecture walkthrough', 'Independent code review'], milestone: 'You hold every key' },
    { week: 'Week 4', title: 'Make the call', steps: ['Score the agency against the test below', 'Keep, fix or replace decision', 'New milestones you can hold them to'], milestone: 'A plan with real dates' },
  ],
  decision: {
    intro: 'Score the agency at the end of Week 4. Make the call on evidence, not on how the last meeting felt.',
    options: [
      { name: 'Keep', tone: 'green', tag: 'Best case', criteria: ['Demos working features against the agreed checks by Week 2', 'Hands over code, accounts and docs without friction', 'Integration errors fall week over week'] },
      { name: 'Fix', tone: 'amber', tag: 'Likely', criteria: ['The work is sound but the process is broken', 'Agrees to checks, demos and a fixed-price recovery milestone', 'You add a part-time technical lead on your side'] },
      { name: 'Replace', tone: 'red', tag: 'Last resort', criteria: ['Can’t demo working software against agreed checks', 'Resists handing over code or access', 'Independent review finds the core needs rebuilding'] },
    ],
  },
  questions: [
    'Which features pass our acceptance checks today, and can you demo them this week?',
    'When billing sync fails, what exactly breaks, and how will we know the same day?',
    'Do we own the code repository and the AWS account? Who has admin access?',
    'What tests run automatically before each release?',
    'What is left, in a realistic order, and what does each piece cost?',
    'If an independent reviewer looked at the code next week, what would they find?',
  ],
  heard: [
    'Acme Storage started a project about nine months ago to replace several disconnected systems. It was planned for six months.',
    'An agency or contractor team of 2 to 5 people builds it. You have limited in-house technical expertise to check their decisions.',
  ],
  scope: 'This report and the debrief work from your answers. They do not include reading your code.',
};

const PREVIEW = {
  client: STRUCTURED.client, project: STRUCTURED.project, status: STRUCTURED.status, statusNote: STRUCTURED.statusNote,
  verdict: STRUCTURED.verdict, actions: STRUCTURED.actions, findingCount: 5, hasPlan: true, hasDecision: true, hasQuestions: true,
};

const COVER = { preparedFor: 'Tennal Jennings', preparedBy: 'Taliferro Tech', date: '2026-11-07T18:00:00.000Z', reportId: 'TR-2026-0142', ownerTagline: 'IT consulting · Seattle', ownerWebsite: 'taliferro.com', ownerLogoUrl: '/assets/16ahead-icon.png' };

const BASE = {
  token: TOKEN, surveyTitle: 'Tech Diagnosis', ownerName: 'Taliferro Tech', firstName: 'Tennal', productName: 'Tech Diagnosis report + debrief',
  priceUsd: 999, turnaroundHours: 24, teaser: null, paidAt: null, dueAt: null, releasedAt: null, debriefUrl: '', reportMarkdown: '', referral: null, metaPixelId: '',
};

function stub ( body: object ): void {
  cy.intercept( 'GET', `**/api/public/pulse-reports/${TOKEN}`, { statusCode: 200, body: { success: true, data: body } } );
}

describe( 'The redesigned paid report', () => {
  it( 'free preview: cover, verdict and the three actions, the rest locked behind the unlock card', () => {
    stub( { ...BASE, status: 'ready', preview: PREVIEW, cover: COVER, structured: null } );
    cy.intercept( 'POST', `**/api/public/pulse-reports/${TOKEN}/checkout`, { statusCode: 200, body: { success: true, data: { checkoutUrl: '/report/' + TOKEN + '?paid=1' } } } ).as( 'checkout' );
    cy.viewport( 1280, 900 );
    cy.visit( `/report/${TOKEN}` );
    cy.contains( 'h1', 'Acme Storage' );
    cy.contains( 'Tech Diagnosis · Confidential' );
    cy.get( '[data-cy="report-verdict"]' ).should( 'contain.text', 'nobody has agreed what “done” means' );
    cy.contains( 'Do these three things this week' );
    cy.contains( 'Confirm you own the code and the cloud accounts' );
    cy.get( '[data-cy="report-locked"]' ).should( 'contain.text', '5 findings with fixes' ).and( 'contain.text', 'Keep / fix / replace test' );
    cy.contains( 'Billing and customer integrations keep breaking' ).should( 'not.exist' );
    cy.get( '[data-cy="report-pdf"]' ).should( 'not.exist' );
    cy.get( '[data-cy="report-unlock"]' ).should( 'contain.text', 'Get the full report · $999' ).click();
    cy.wait( '@checkout' );
  } );

  it( 'released: every section, numbered, with the debrief and PDF', () => {
    stub( { ...BASE, status: 'released', releasedAt: COVER.date, debriefUrl: 'https://calendar.example/debrief', preview: PREVIEW, cover: COVER, structured: STRUCTURED } );
    cy.viewport( 1280, 900 );
    cy.visit( `/report/${TOKEN}` );
    cy.contains( '.tr-sh', '01' ).should( 'contain.text', 'The verdict' );
    cy.contains( '.tr-sh', 'Health scorecard' ).should( 'contain.text', '02' );
    cy.contains( '.tr-sh', 'The cost of waiting' ).should( 'contain.text', '03' );
    cy.contains( '.tr-sh', 'Findings' ).should( 'contain.text', '04' );
    cy.contains( '2 Critical' );
    cy.contains( 'F5' );
    cy.contains( '.tr-sh', '30-day recovery plan' );
    cy.contains( '.tr-sh', 'Keep, fix or replace' );
    cy.contains( '.tr-sh', 'Questions to ask' );
    cy.contains( '.tr-sh', 'What we heard' );
    cy.contains( 'Prepared by Taliferro Tech' );
    cy.contains( 'IT consulting · Seattle · TR-2026-0142 · November 7, 2026' );
    cy.get( '.tr-pill' ).each( ( pill ) => expect( pill.text().trim() ).not.to.equal( '' ) );
    cy.get( '[data-cy="report-pdf"]' ).should( 'be.visible' );
    cy.get( '.tr-top .tr-mark--logo img' ).should( 'have.attr', 'src', COVER.ownerLogoUrl );
  } );

  it( 'with no cost numbers and no vendor choice, those sections are gone and the numbers close up', () => {
    stub( { ...BASE, status: 'released', preview: PREVIEW, cover: COVER, structured: { ...STRUCTURED, cost: null, decision: null } } );
    cy.viewport( 1280, 900 );
    cy.visit( `/report/${TOKEN}` );
    cy.contains( '.tr-sh', 'The cost of waiting' ).should( 'not.exist' );
    cy.contains( '.tr-sh', 'Keep, fix or replace' ).should( 'not.exist' );
    cy.contains( '.tr-sh', 'Findings' ).should( 'contain.text', '03' );
  } );

  it( 'on a phone: one column, no sideways scroll', () => {
    stub( { ...BASE, status: 'released', preview: PREVIEW, cover: COVER, structured: STRUCTURED } );
    cy.viewport( 390, 844 );
    cy.visit( `/report/${TOKEN}` );
    cy.get( '.tr-nav' ).should( 'not.be.visible' );
    cy.contains( 'PDF' ).should( 'be.visible' );
    cy.document().then( ( doc ) => expect( doc.documentElement.scrollWidth ).to.be.at.most( 390 ) );
  } );

  it( 'a report written before the redesign still shows its text', () => {
    stub( { ...BASE, status: 'released', teaser: { headline: 'Old headline', summary: '', issues: [] }, reportMarkdown: '## What we heard\n\nOld report text.', preview: null, cover: null, structured: null } );
    cy.visit( `/report/${TOKEN}` );
    cy.contains( 'Old report text.' );
    cy.get( 'app-tech-report' ).should( 'not.exist' );
  } );
} );
