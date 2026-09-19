/**
 * visitWithFirebaseEmulators works by writing __useFirebaseEmulators and
 * __cypressEmulatorCredentials to localStorage before the app boots.
 * app.config.ts only reads them when window.Cypress is present (see
 * appReady there) - this has no effect outside a Cypress-driven browser,
 * never in production, never in normal dev use.
 */
type EmulatorCredentials = {
  email: string;
  password: string;
};

declare global {
  namespace Cypress {
    interface Chainable {
      visitWithFirebaseEmulators ( path: string, credentials: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ): Chainable<AUTWindow>;
    }
  }
}

Cypress.Commands.add( 'visitWithFirebaseEmulators', ( path: string, credentials: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ) => {
  return cy.visit( path, {
    ...options,
    onBeforeLoad: ( win ) => {
      win.localStorage.setItem( '__useFirebaseEmulators', 'true' );
      win.localStorage.setItem( '__cypressEmulatorCredentials', JSON.stringify( credentials ) );

      if ( options?.onBeforeLoad ) {
        options.onBeforeLoad( win );
      }
    },
  } );
} );

export { };
