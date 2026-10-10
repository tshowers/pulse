/**
 * A pulse end to end through the redesign (design_handoff_todd_pulse):
 * New pulse from a template → Write (autosave) → Share (settings, publish)
 * → live link → Results with TODD's summary → back to Pulses → delete.
 *
 * Auth is real (Firebase Auth emulator via visitWithFirebaseEmulators); the
 * TODD backend is stubbed with cy.intercept, mutating one `survey` the way
 * the real API would. Screenshots of each screen at laptop and phone width
 * land in cypress/screenshots for design review.
 */
describe( 'Pulse flow - New, Write, Share, Results', () => {
  const surveyId = 'e2e-survey-1';
  let survey: any = null;
  let puts = 0;

  const results = () => ( {
    surveyId, title: survey.title, totalResponses: 38, last24h: 6, lastResponseAt: new Date().toISOString(),
    questions: [
      { questionId: survey.questions[0].id, questionText: survey.questions[0].questionText, questionType: 'rating', kind: 'rating', responseCount: 38, average: 8, histogram: [0, 0, 0, 1, 0, 2, 3, 6, 9, 10, 7] },
      { questionId: survey.questions[1].id, questionText: survey.questions[1].questionText, questionType: 'multiple_choice', kind: 'choice', responseCount: 38, options: [{ label: 'Yes', count: 30, pct: 79 }, { label: 'Not sure', count: 8, pct: 21 }, { label: 'No', count: 0, pct: 0 }] },
      { questionId: survey.questions[2].id, questionText: survey.questions[2].questionText, questionType: 'checkbox', kind: 'choice', responseCount: 38, options: [{ label: 'Service one', count: 31, pct: 82 }, { label: 'Service two', count: 24, pct: 63 }, { label: 'Service three', count: 19, pct: 50 }, { label: 'Other', count: 12, pct: 32 }] },
      { questionId: survey.questions[3].id, questionText: survey.questions[3].questionText, questionType: 'textarea', kind: 'text', responseCount: 31, quotes: [
        { responseId: 'r1', text: 'Work is great. I just wish I did not have to chase replies for three days.', submittedAt: '2026-10-09T10:00:00Z' },
        { responseId: 'r2', text: 'Invoices are confusing. Itemize the hosting separately.', submittedAt: '2026-10-08T10:00:00Z' },
        { responseId: 'r3', text: 'Honestly nothing. The AI assistant saved us a hire.', submittedAt: '2026-10-08T09:00:00Z' },
        { responseId: 'r4', text: 'Faster replies, please.', submittedAt: '2026-10-07T09:00:00Z' },
      ] },
    ],
  } );

  const insights = () => ( {
    surveyId, state: 'ready', minAnswers: 5, responseCount: 38, answerCount: 38, updatedAt: new Date( Date.now() - 120000 ).toISOString(),
    summary: 'Clients like the work and most will renew. The ones who might leave are all frustrated by how long replies take.',
    findings: [
      { n: '79%', text: 'say they will renew. Nobody said no.' },
      { n: '8', text: 'are not sure, and all 8 mention slow replies to email or tickets.' },
      { n: '11', text: 'of 31 written answers ask for faster replies. It is the top request by far.' },
    ],
    nextMove: { id: 'm1', text: 'Call the 8 "Not sure" clients this week and promise a reply within one business day.', why: 'All 8 mention slow replies.', segment: null, recipientCount: 0, taskId: null, actions: ['add_task', 'another_idea'] },
    themesByQuestion: { [survey.questions[3].id]: [{ label: 'Faster replies', count: 2, responseIds: ['r1', 'r4'] }, { label: 'Clearer invoices', count: 1, responseIds: ['r2'] }] },
    capabilities: { movesTasks: true, draftEmail: false },
  } );

  const stubBackend = () => {
    cy.intercept( 'GET', '**/account/summary*', {
      statusCode: 200,
      body: { success: true, data: { tenant: { surveyPaidAccess: true }, writeAccess: { pulse: true } } },
    } ).as( 'accountSummary' );

    cy.intercept( 'POST', '**/api/surveys', ( req ) => {
      survey = { id: surveyId, ...req.body, status: 'draft', visibility: 'private', responseCount: 0, revision: 1, closeRule: { type: 'manual', value: null } };
      req.reply( { statusCode: 201, body: survey } );
    } ).as( 'createSurvey' );

    cy.intercept( 'GET', `**/api/surveys/${surveyId}`, ( req ) => req.reply( { statusCode: 200, body: survey } ) ).as( 'getSurvey' );

    cy.intercept( 'PUT', `**/api/surveys/${surveyId}`, ( req ) => {
      puts += 1;
      expect( req.body.revision, 'autosave sends the revision it was based on' ).to.equal( survey.revision );
      survey = { ...survey, ...req.body, revision: survey.revision + 1, updatedAt: new Date().toISOString() };
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'updateSurvey' );

    cy.intercept( 'POST', `**/api/surveys/${surveyId}/todd/review`, {
      statusCode: 200,
      body: { hash: 'h1', suggestions: [{ id: 's1', questionId: null, action: 'add', label: 'Add it', message: 'Ask what they would change first, so open answers come last.', question: { questionText: 'What is one thing we should change first?', questionType: 'text', options: [] } }] },
    } ).as( 'review' );

    cy.intercept( 'POST', `**/api/surveys/${surveyId}/tried`, ( req ) => {
      survey = { ...survey, triedAt: new Date().toISOString() };
      req.reply( { statusCode: 200, body: survey } );
    } );

    cy.intercept( 'POST', `**/api/surveys/${surveyId}/publish`, ( req ) => {
      survey = { ...survey, ...req.body, status: 'published', visibility: 'link_only', everPublished: true, publishedAt: new Date().toISOString() };
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'publishSurvey' );

    cy.intercept( 'POST', `**/api/surveys/${surveyId}/viewed`, ( req ) => req.reply( { statusCode: 200, body: { ...survey, newSinceViewed: 0 } } ) );
    cy.intercept( 'GET', `**/api/surveys/${surveyId}/results`, ( req ) => req.reply( { statusCode: 200, body: results() } ) ).as( 'results' );
    cy.intercept( 'GET', `**/api/surveys/${surveyId}/insights`, ( req ) => req.reply( { statusCode: 200, body: insights() } ) ).as( 'insights' );
    cy.intercept( 'POST', `**/api/surveys/${surveyId}/todd/next-move/task`, { statusCode: 201, body: { taskId: 'task-1', alreadyAdded: false } } ).as( 'addTask' );

    cy.intercept( 'GET', '**/api/surveys?*', ( req ) => req.reply( { statusCode: 200, body: { surveys: survey ? [survey] : [] } } ) ).as( 'listSurveys' );
    cy.intercept( 'DELETE', `**/api/surveys/${surveyId}`, ( req ) => {
      survey = null;
      req.reply( { statusCode: 200, body: { success: true } } );
    } ).as( 'deleteSurvey' );
  };

  const snap = ( name: string ) => {
    cy.viewport( 1280, 900 );
    cy.wait( 300 );
    cy.screenshot( `${name}-laptop`, { capture: 'fullPage', overwrite: true } );
    cy.viewport( 390, 844 );
    cy.wait( 300 );
    cy.screenshot( `${name}-phone`, { capture: 'fullPage', overwrite: true } );
    cy.viewport( 1280, 900 );
  };

  it( 'writes, shares and reads a pulse, then deletes it', () => {
    stubBackend();
    cy.viewport( 1280, 900 );
    cy.visitWithFirebaseEmulators( '/survey-edit', { email: `pulse-flow-${Date.now()}@example.com`, password: 'CypressTest123!' } );

    // ── New pulse (1b) ──
    cy.contains( 'h1', 'What do you want to find out?', { timeout: 20000 } ).should( 'be.visible' );
    snap( '1b-new-pulse' );
    cy.contains( 'button', 'Client check-in' ).click();
    cy.wait( '@createSurvey', { timeout: 30000 } ).its( 'request.body' ).should( ( body ) => {
      expect( body.questions ).to.have.length( 4 );
      expect( body.collectIdentity ).to.equal( true );
      body.questions.forEach( ( q: any ) => expect( q.id ).to.match( /^q_[0-9a-f]{12}$/ ) );
    } );

    // ── Write (1c) ──
    cy.location( 'pathname' ).should( 'eq', `/survey/${surveyId}/write` );
    cy.get( 'input[aria-label="Title"]' ).clear().type( 'Q4 client check-in' );
    cy.wait( '@updateSurvey' ).its( 'request.body.title' ).should( 'eq', 'Q4 client check-in' );
    cy.contains( 'Draft · saved' ).should( 'be.visible' );
    cy.wait( '@review', { timeout: 10000 } );
    cy.contains( "TODD's review" ).should( 'be.visible' );
    snap( '1c-write' );
    cy.contains( 'button', 'Next: Share' ).should( 'not.be.disabled' ).click();

    // ── Share, before publishing (1d) ──
    cy.location( 'pathname' ).should( 'eq', `/survey/${surveyId}/share` );
    cy.contains( 'h1', 'Ready to share' ).should( 'be.visible' );
    cy.contains( 'button', 'After 50 answers' ).click();
    cy.wait( '@updateSurvey' ).its( 'request.body.closeRule' ).should( 'deep.equal', { type: 'count', value: 50 } );
    snap( '1d-share' );
    cy.contains( 'button', 'Publish and get my link' ).click();
    cy.wait( '@publishSurvey' ).its( 'request.body' ).should( 'deep.equal', { closeRule: { type: 'count', value: 50 }, collectIdentity: true } );

    // ── Share, live (1e) ──
    cy.contains( 'h1', "It's live. Send people this link" ).should( 'be.visible' );
    cy.contains( `/take/${surveyId}` ).should( 'be.visible' );
    cy.contains( 'Taking answers until 50 answers · asks for name and email' ).should( 'be.visible' );
    snap( '1e-live' );

    // ── Results (1f) ──
    cy.then( () => { survey = { ...survey, responseCount: 38, newSinceViewed: 6 }; } );
    cy.contains( 'a', 'See results' ).click();
    cy.wait( ['@results', '@insights'] );
    cy.contains( 'Clients like the work and most will renew.' ).should( 'be.visible' );
    cy.contains( 'What TODD heard · from 38 answers' ).should( 'be.visible' );
    cy.contains( 'button', 'Draft the email' ).should( 'not.exist' );
    cy.contains( '8.0' ).should( 'be.visible' );
    cy.contains( 'button', 'Faster replies · 2' ).click();
    cy.contains( 'Invoices are confusing' ).should( 'not.exist' );
    cy.contains( 'button', 'Faster replies · 2' ).click();
    snap( '1f-results' );
    cy.contains( 'button', 'Add to my tasks' ).click();
    cy.wait( '@addTask' );
    cy.contains( 'button', 'In your tasks' ).should( 'be.disabled' );

    // ── Pulses home (1a) ──
    cy.get( 'a[aria-label="Back to Pulses"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/app' );
    cy.contains( 'Q4 client check-in' ).should( 'be.visible' );
    cy.contains( 'Live' ).should( 'be.visible' );
    snap( '1a-pulses-home' );

    cy.then( () => expect( puts, 'autosave batched the edits' ).to.be.lessThan( 6 ) );
  } );
} );
