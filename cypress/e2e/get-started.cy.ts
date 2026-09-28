/**
 * Pulse's pre-sign-in wizard at /get-started: build a first survey, then
 * name and company, then hand off to TODD's hosted login. The draft is kept
 * in localStorage so it survives that redirect (it's saved after sign-in
 * by PulseSignupDraftService.submitIfPending in AuthCallbackComponent).
 */
describe( 'Pulse get started wizard', () => {
  const storageKey = 'pulse_signup_draft';

  beforeEach( () => cy.clearLocalStorage() );

  it( 'builds a survey, asks name and company, and saves the draft', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-progress"] li' ).should( 'have.length', 4 );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 0 ).should( 'have.class', 'is-done' );

    cy.contains( '[data-cy="get-started-template"]', 'Team Pulse Check' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'Give it a title' );
    cy.get( '[data-cy="get-started-description"]' ).should( 'have.value', 'A quick, anonymous check-in on how the week is going.' );
    cy.get( '[data-cy="get-started-input"]' ).should( 'have.value', 'Team Pulse Check' ).clear().type( 'Friday check-in' );
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'Your first question' );
    cy.get( '[data-cy="get-started-input"]' ).should( 'have.value', 'How is your workload this week?' );
    cy.get( '[data-cy="get-started-add-question"]' ).click();
    cy.contains( '[data-cy="get-started-question"]', 'Another question' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Anything blocking you?' );
    cy.contains( '[data-cy="get-started-question-type"]', 'Yes / No' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', "Here's your Pulse" );
    cy.get( '[data-cy="get-started-preview"]' ).should( 'contain.text', 'Friday check-in' ).and( 'contain.text', 'Anything blocking you?' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'contain.text', 'Continue to sign up' ).click();

    cy.get( '[data-cy="get-started-progress"] li' ).eq( 1 ).should( 'have.class', 'is-done' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Analytical Co{enter}' );

    cy.contains( '[data-cy="get-started-question"]', 'create your account' );
    cy.window().then( ( win ) => {
      const draft = JSON.parse( win.localStorage.getItem( storageKey ) || '{}' );
      expect( draft ).to.include( { firstName: 'Ada', lastName: 'Lovelace', companyName: 'Analytical Co', readyToSubmit: true } );
      expect( draft.survey.title ).to.equal( 'Friday check-in' );
      expect( draft.survey.questions ).to.have.length( 2 );
      expect( draft.survey.questions[1] ).to.include( { questionText: 'Anything blocking you?', questionType: 'yes_no' } );
    } );

    cy.get( '[data-cy="get-started-sign-in"]' ).click();
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );

  it( 'requires at least two choices for a multiple choice question', () => {
    cy.visit( '/get-started' );
    cy.contains( '[data-cy="get-started-template"]', 'Team Pulse Check' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    // The Team Pulse Check starter has three choices - leave only one.
    cy.get( '[data-cy="get-started-choice"]' ).eq( 1 ).clear();
    cy.get( '[data-cy="get-started-next"]' ).should( 'not.be.disabled' );
    cy.get( '[data-cy="get-started-choice"]' ).eq( 2 ).clear();
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
  } );

  it( 'links returning users straight to sign-in', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href' ).and( 'include', '/login' );
  } );
} );
