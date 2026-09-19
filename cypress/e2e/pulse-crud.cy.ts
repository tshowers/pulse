/**
 * Full lifecycle coverage for a Pulse: Create -> Read -> Update -> Publish
 * -> Delete, driven through the real UI (survey-add, survey-view,
 * survey-list) as one signed-in user.
 *
 * Auth is real: a fresh user is created against the Firebase Auth emulator
 * via visitWithFirebaseEmulators (see cypress/support/commands.ts and
 * app.config.ts's appReady gate), so PulseAuthService.getUserId()/getUser()
 * resolve exactly as they would in production. The backend REST API
 * (SurveyApiService's /api/surveys* calls and AccountBillingService's
 * /account/summary) is stubbed with cy.intercept, since there is no
 * emulator for TODD's own Node API - the survey below (id fixed at
 * "e2e-survey-1") lives only in the `survey` closure for the duration of
 * this test, mutated by each intercept exactly like a real backend would
 * persist it.
 */
describe( 'Pulse lifecycle - Create, Read, Update, Publish, Delete', () => {
  const surveyId = 'e2e-survey-1';
  let survey: any = null;

  const stubBackend = () => {
    cy.intercept( 'GET', '**/account/summary*', {
      statusCode: 200,
      body: { success: true, data: { tenant: { surveyPaidAccess: true } } },
    } ).as( 'accountSummary' );

    cy.intercept( 'POST', '**/api/surveys', ( req ) => {
      survey = {
        id: surveyId,
        ...req.body,
        status: req.body.status || 'draft',
        visibility: req.body.visibility || 'private',
        responseCount: 0,
      };
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'createSurvey' );

    cy.intercept( 'GET', `**/api/surveys/${surveyId}`, ( req ) => {
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'getSurvey' );

    cy.intercept( 'PUT', `**/api/surveys/${surveyId}`, ( req ) => {
      survey = { ...survey, ...req.body };
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'updateSurvey' );

    cy.intercept( 'POST', `**/api/surveys/${surveyId}/publish`, ( req ) => {
      survey = { ...survey, status: 'published', visibility: 'public' };
      req.reply( { statusCode: 200, body: { id: survey.id, status: survey.status, visibility: survey.visibility, title: survey.title } } );
    } ).as( 'publishSurvey' );

    cy.intercept( 'GET', '**/api/surveys?*', ( req ) => {
      req.reply( { statusCode: 200, body: { surveys: survey ? [survey] : [] } } );
    } ).as( 'listSurveys' );

    cy.intercept( 'DELETE', `**/api/surveys/${surveyId}`, {
      statusCode: 200,
      body: {},
    } ).as( 'deleteSurvey' );
  };

  it( 'creates, reads, updates, publishes, and deletes a Pulse end to end', () => {
    stubBackend();

    const credentials = { email: `pulse-crud-${Date.now()}@example.com`, password: 'CypressTest123!' };
    cy.visitWithFirebaseEmulators( '/survey-edit', credentials );

    // --- Create ---
    cy.get( '[data-cy="pulse-create-shell"]' ).should( 'be.visible' );
    cy.get( '#surveyTitle' ).type( 'Customer Satisfaction Q3' );
    cy.get( '#surveyDescription' ).type( 'How are we doing this quarter?' );
    cy.get( '[data-cy="pulse-add-question"]' ).click();
    cy.get( 'input[placeholder="Enter your question"]' ).type( 'Would you recommend us to a friend?' );
    cy.get( '[data-cy="pulse-save-submit"]' ).should( 'not.be.disabled' ).click();

    cy.wait( '@createSurvey' ).its( 'request.body' ).then( ( body ) => {
      expect( body.title ).to.eq( 'Customer Satisfaction Q3' );
      expect( body.description ).to.eq( 'How are we doing this quarter?' );
      expect( body.questions ).to.have.length( 1 );
      expect( body.questions[0].questionText ).to.eq( 'Would you recommend us to a friend?' );
      expect( body.status ).to.eq( 'draft' );
    } );

    cy.location( 'pathname', { timeout: 10000 } ).should( 'eq', `/survey/${surveyId}` );

    // --- Read ---
    // Generous timeouts here: this is the first Firestore call of the
    // session (PulseAuthService.getTenantId's users/{uid} read, which
    // PulseEntitlementService depends on), and a freshly-started emulator's
    // first connection can take longer than Cypress's 5s default.
    cy.wait( '@getSurvey', { timeout: 20000 } );
    cy.wait( '@accountSummary', { timeout: 20000 } );
    cy.get( '[data-cy="pulse-command-shell"]' ).should( 'be.visible' );
    cy.contains( 'h1', 'Customer Satisfaction Q3' ).should( 'be.visible' );
    cy.contains( 'p', 'How are we doing this quarter?' ).should( 'be.visible' );
    cy.get( '[data-cy="pulse-command-pills"]' ).should( 'contain.text', 'draft' );

    // --- Update ---
    cy.get( '[data-cy="pulse-back-to-edit"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/survey-edit' );
    cy.get( '#surveyTitle' ).should( 'have.value', 'Customer Satisfaction Q3' );
    cy.get( '#surveyTitle' ).clear().type( 'Customer Satisfaction Q4' );
    cy.get( '[data-cy="pulse-save-submit"]' ).click();

    cy.wait( '@updateSurvey' ).its( 'request.body' ).then( ( body ) => {
      expect( body.title ).to.eq( 'Customer Satisfaction Q4' );
    } );

    cy.location( 'pathname', { timeout: 10000 } ).should( 'eq', `/survey/${surveyId}` );
    cy.wait( '@getSurvey' );
    cy.contains( 'h1', 'Customer Satisfaction Q4' ).should( 'be.visible' );

    // --- Publish ---
    cy.get( '[data-cy="pulse-publish"]' ).should( 'not.be.disabled' ).click();
    cy.wait( '@publishSurvey' );
    cy.get( '[data-cy="pulse-command-pills"]' ).should( 'contain.text', 'published' );
    cy.get( '[data-cy="pulse-publish"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="pulse-open-live"]' ).should( 'be.visible' );
    cy.get( '[data-cy="pulse-move-to-draft"]' ).should( 'be.visible' );

    // --- Delete ---
    cy.visit( '/survey-list' );
    cy.wait( '@listSurveys' );
    cy.get( `[data-cy="pulse-list-row-${surveyId}"]` )
      .should( 'be.visible' )
      .and( 'contain.text', 'Customer Satisfaction Q4' );

    cy.on( 'window:confirm', () => true );
    cy.get( `[data-cy="pulse-list-delete-${surveyId}"]` ).click();
    cy.wait( '@deleteSurvey' );
    cy.get( `[data-cy="pulse-list-row-${surveyId}"]` ).should( 'not.exist' );
  } );
} );
