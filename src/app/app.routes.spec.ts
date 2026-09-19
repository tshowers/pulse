import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { PulseAuthService } from './services/pulse-auth.service';

import { LandingComponent } from './features/landing/landing.component';
import { AppShowcaseComponent } from './features/app-showcase/app-showcase.component';
import { TakeSurveyComponent } from './features/take-survey/take-survey.component';
import { PulsePaidSuccessComponent } from './features/pulse-paid-success/pulse-paid-success.component';
import { SurveyListComponent } from './features/survey-list/survey-list.component';
import { SurveyDashboardComponent } from './features/survey-dashboard/survey-dashboard.component';
import { SurveyViewComponent } from './features/survey-view/survey-view.component';
import { PulsePricingComponent } from './features/pulse-pricing/pulse-pricing.component';
import { SurveyAddComponent } from './features/survey-add/survey-add.component';
import { PulseHomeComponent } from './features/pulse-home/pulse-home.component';
import { SignInComponent } from './features/sign-in/sign-in.component';
import { AuthCallbackComponent } from './features/auth-callback/auth-callback.component';
import { NotFoundComponent } from './features/not-found/not-found.component';

/**
 * Route-table coverage for app.routes.ts: every path resolves the
 * component it claims to (catches typo'd loadComponent paths and
 * accidental route-order shadowing that a plain config-object assertion
 * wouldn't). survey-view/survey-dashboard redirect signed-out users to
 * /login (see their own file comments), so this defaults PulseAuthService
 * to a signed-in user and only flips to signed-out for the two tests
 * (/login, and / without the guard's redirect) where that behavior is the
 * point.
 */
describe( 'app.routes', () => {
  let currentUser: { uid: string; email: string } | null;
  let isLoggedIn: boolean;

  beforeEach( () => {
    currentUser = { uid: 'test-uid', email: 'test@example.com' };
    isLoggedIn = true;

    TestBed.configureTestingModule( {
      providers: [
        provideRouter( routes ),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PulseAuthService,
          useValue: {
            isLoggedIn: () => of( isLoggedIn ),
            getUserId: () => of( currentUser?.uid || '' ),
            getUser: () => of( currentUser ),
            getTenantId: () => of( currentUser?.uid || '' ),
            getCurrentUserIdSync: () => currentUser?.uid || '',
            signIn: () => { /* no-op: real service leaves the app for hosted login */ },
            signOut: async () => { },
            consumePendingLogin: () => null,
            signInWithCustomToken: async () => currentUser,
          },
        },
      ],
    } );
  } );

  it( 'routes /ios to AppShowcaseComponent', async () => {
    const harness = await RouterTestingHarness.create( '/ios' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( AppShowcaseComponent );
  } );

  it( 'routes /take/:id to TakeSurveyComponent', async () => {
    const harness = await RouterTestingHarness.create( '/take/survey-123' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( TakeSurveyComponent );
  } );

  it( 'routes /success to PulsePaidSuccessComponent', async () => {
    const harness = await RouterTestingHarness.create( '/success' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulsePaidSuccessComponent );
  } );

  it( 'routes /survey-list to SurveyListComponent', async () => {
    const harness = await RouterTestingHarness.create( '/survey-list' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( SurveyListComponent );
  } );

  it( 'routes /survey-dashboard/:surveyId to SurveyDashboardComponent when signed in', async () => {
    const harness = await RouterTestingHarness.create( '/survey-dashboard/survey-123' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( SurveyDashboardComponent );
  } );

  it( 'routes /survey/:id to SurveyViewComponent when signed in', async () => {
    const harness = await RouterTestingHarness.create( '/survey/survey-123' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( SurveyViewComponent );
  } );

  it( 'routes /pricing to PulsePricingComponent', async () => {
    const harness = await RouterTestingHarness.create( '/pricing' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulsePricingComponent );
  } );

  it( 'routes /survey-edit to SurveyAddComponent (create/edit a Pulse)', async () => {
    const harness = await RouterTestingHarness.create( '/survey-edit' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( SurveyAddComponent );
  } );

  it( 'routes /app to PulseHomeComponent', async () => {
    const harness = await RouterTestingHarness.create( '/app' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulseHomeComponent );
  } );

  it( 'routes /login to SignInComponent when signed out', async () => {
    currentUser = null;
    isLoggedIn = false;
    const harness = await RouterTestingHarness.create( '/login' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( SignInComponent );
  } );

  it( 'routes /auth/callback to AuthCallbackComponent', async () => {
    const harness = await RouterTestingHarness.create( '/auth/callback' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( AuthCallbackComponent );
  } );

  it( 'routes an unmatched path to NotFoundComponent via the wildcard route', async () => {
    const harness = await RouterTestingHarness.create( '/this-route-does-not-exist' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( NotFoundComponent );
  } );

  it( 'routes / to LandingComponent when signed out', async () => {
    currentUser = null;
    isLoggedIn = false;
    const harness = await RouterTestingHarness.create( '/' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( LandingComponent );
  } );

  it( 'redirects / to /app via landingRedirectGuard when already signed in', async () => {
    const harness = await RouterTestingHarness.create( '/' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulseHomeComponent );
  } );
} );
