/**
 * Write's one rule (1c): Next: Share stays off, and says why, until the
 * pulse has a title and every question is complete. Writing itself is never
 * blocked - a blank pulse autosaves.
 */
describe( 'Pulse Write - Next: Share rules', () => {
  it( 'says what is missing and enables Next: Share only when complete', () => {
    let survey: any = null;
    cy.intercept( 'GET', '**/account/summary*', { statusCode: 200, body: { success: true, data: { writeAccess: { pulse: false } } } } );
    cy.intercept( 'POST', '**/api/surveys', ( req ) => {
      survey = { id: 'e2e-blank', ...req.body, status: 'draft', responseCount: 0, revision: 1 };
      req.reply( { statusCode: 201, body: survey } );
    } );
    cy.intercept( 'GET', '**/api/surveys/e2e-blank', ( req ) => req.reply( { statusCode: 200, body: survey } ) );
    cy.intercept( 'PUT', '**/api/surveys/e2e-blank', ( req ) => {
      survey = { ...survey, ...req.body, revision: survey.revision + 1 };
      req.reply( { statusCode: 200, body: survey } );
    } ).as( 'save' );
    cy.intercept( 'POST', '**/api/surveys/e2e-blank/todd/review', { statusCode: 200, body: { suggestions: [], hash: 'h' } } );

    cy.visitWithFirebaseEmulators( '/survey-edit', { email: `pulse-rules-${Date.now()}@example.com`, password: 'CypressTest123!' } );
    cy.contains( 'button', 'Start from blank', { timeout: 20000 } ).click();

    cy.location( 'pathname', { timeout: 30000 } ).should( 'eq', '/survey/e2e-blank/write' );
    cy.contains( 'button', 'Next: Share' ).should( 'be.disabled' );
    cy.contains( 'To share it: Add a title.' ).should( 'be.visible' );

    cy.get( 'input[aria-label="Title"]' ).type( 'Friday check-in' );
    cy.contains( 'To share it: Finish question 1.' ).should( 'be.visible' );

    cy.get( 'input[aria-label="Question"]' ).type( 'Anything blocking you?' );
    cy.contains( 'To share it' ).should( 'not.exist' );
    cy.contains( 'button', 'Next: Share' ).should( 'not.be.disabled' );
    cy.wait( '@save' ).its( 'request.body.questions.0.questionText' ).should( 'eq', 'Anything blocking you?' );

    // Without a plan, Share offers the plan instead of publishing.
    cy.contains( 'button', 'Next: Share' ).click();
    cy.contains( 'button', 'Choose a plan to publish' ).should( 'be.visible' );
  } );
} );
