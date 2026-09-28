/**
 * The builder only enables Save once the Pulse has what the backend
 * requires (title, description, at least one question with text) and says
 * what's missing; an existing Pulse needs a change before Save enables.
 */
describe( 'Pulse builder - save rules', () => {
  it( 'says what is missing and enables Save only when complete', () => {
    cy.intercept( 'GET', '**/account/summary*', { statusCode: 200, body: { success: true, data: { tenant: { surveyPaidAccess: true } } } } );
    cy.visitWithFirebaseEmulators( '/survey-edit', { email: `pulse-save-${Date.now()}@example.com`, password: 'CypressTest123!' } );

    cy.get( '[data-cy="pulse-save-hint"]', { timeout: 15000 } ).should( 'contain.text', 'a title' ).and( 'contain.text', 'a description' );
    cy.get( '[data-cy="pulse-save-submit"]' ).should( 'be.disabled' );

    cy.get( '#surveyTitle, input[formControlName="title"]' ).first().type( 'Friday check-in' );
    cy.get( '[data-cy="pulse-save-hint"]' ).should( 'not.contain.text', 'a title' ).and( 'contain.text', 'a description' );
    cy.get( '[data-cy="pulse-save-submit"]' ).should( 'be.disabled' );

    cy.get( '#surveyDescription' ).type( 'How the week went.' );
    cy.get( 'body' ).then( ( body ) => {
      if ( body.find( '[data-cy="pulse-save-hint"]' ).text().includes( 'question' ) ) {
        cy.get( '[data-cy="pulse-add-question"]' ).click();
        cy.get( 'input[formControlName="questionText"]' ).first().type( 'Anything blocking you?' );
      }
    } );
    cy.get( '[data-cy="pulse-save-hint"]' ).should( 'not.exist' );
    cy.get( '[data-cy="pulse-save-submit"]' ).should( 'not.be.disabled' );
  } );
} );
