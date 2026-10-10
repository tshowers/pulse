/**
 * Answering a pulse from its link, signed out (1g/1h on a phone, 2d/2e on a
 * computer): one question at a time, keyboard on a computer, name and email
 * last when the owner asked, one answer per device. The public API is
 * stubbed.
 */
describe( 'Answering a pulse', () => {
  const pulse = {
    id: 'e2e-take-1',
    title: 'Q4 client check-in',
    description: 'Four quick questions.',
    status: 'published',
    collectIdentity: true,
    ownerDisplay: { name: 'Taliferro Tech' },
    questions: [
      { id: 'q_rate', questionText: 'How likely are you to recommend us to a colleague?', questionType: 'rating', options: [], required: true },
      { id: 'q_renew', questionText: 'Will you renew with us next year?', questionType: 'multiple_choice', options: ['Yes', 'Not sure', 'No'], required: true },
      { id: 'q_svc', questionText: 'Which of our services do you use?', questionType: 'checkbox', options: ['Hosting', 'Web app', 'Support plan'], required: false },
      { id: 'q_better', questionText: 'What should we do better?', questionType: 'textarea', options: [], required: false },
    ],
  };

  beforeEach( () => {
    cy.intercept( 'GET', `**/api/public/surveys/${pulse.id}`, { statusCode: 200, body: pulse } );
    cy.intercept( 'POST', `**/api/public/surveys/${pulse.id}/responses`, { statusCode: 201, body: { success: true, responseId: 'r1' } } ).as( 'submit' );
  } );

  it( 'answers on a computer with the keyboard and sends answers by question id', () => {
    cy.viewport( 1280, 800 );
    cy.visit( `/take/${pulse.id}` );
    cy.contains( 'h1', 'How likely are you to recommend us', { timeout: 20000 } ).should( 'be.visible' );
    cy.contains( 'Your answers go to Taliferro Tech.' ).should( 'be.visible' );
    cy.get( 'body' ).type( '9' );
    cy.screenshot( '2d-answer-desktop', { overwrite: true } );
    cy.get( 'body' ).type( '{enter}' );

    cy.contains( 'h1', 'Will you renew' ).should( 'be.visible' );
    cy.get( 'body' ).type( '2{enter}' );
    cy.contains( 'button', 'Hosting' ).click();
    cy.contains( 'button', 'Web app' ).click();
    cy.contains( 'button', 'Next' ).click();
    cy.get( 'textarea' ).type( 'Reply faster to support tickets.' );
    cy.contains( 'button', 'Next' ).click();

    cy.contains( 'h1', "Last thing: who's answering?" ).should( 'be.visible' );
    cy.contains( 'button', 'Send' ).should( 'be.disabled' );
    cy.get( '#ts-name' ).type( 'Ann Lee' );
    cy.get( 'input[type="email"]' ).type( 'ann@example.com' );
    cy.contains( 'button', 'Send' ).click();

    cy.wait( '@submit' ).its( 'request.body' ).should( ( body ) => {
      expect( body.answers ).to.deep.equal( { q_rate: 9, q_renew: 'Not sure', q_svc: ['Hosting', 'Web app'], q_better: 'Reply faster to support tickets.' } );
      expect( body.respondent ).to.deep.equal( { name: 'Ann Lee', email: 'ann@example.com' } );
    } );
    cy.contains( 'h1', "Thanks, that's everything." ).should( 'be.visible' );
    cy.contains( 'What you sent' ).should( 'be.visible' );
    cy.contains( '9 out of 10' ).should( 'be.visible' );
    cy.screenshot( '2e-done-desktop', { overwrite: true } );

    // One answer per device.
    cy.reload();
    cy.contains( 'h1', "You've already answered this one.", { timeout: 20000 } ).should( 'be.visible' );
  } );

  it( 'answers on a phone with big targets', () => {
    cy.viewport( 390, 844 );
    cy.visit( `/take/${pulse.id}` );
    cy.contains( 'button', '9', { timeout: 20000 } ).click();
    cy.contains( 'button', 'Next' ).click();
    cy.contains( 'button', 'Not sure' ).click();
    cy.get( '.ts-card .ts-progress__label' ).should( 'be.visible' ).and( 'have.text', '2 of 5' );
    cy.screenshot( '1g-answer-phone', { overwrite: true } );
  } );

  it( 'says a closed pulse is closed', () => {
    cy.intercept( 'GET', `**/api/public/surveys/${pulse.id}`, { statusCode: 200, body: { ...pulse, status: 'archived', questions: [] } } );
    cy.visit( `/take/${pulse.id}` );
    cy.contains( 'h1', 'This pulse has closed.', { timeout: 20000 } ).should( 'be.visible' );
  } );
} );
