import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { PulseAuthService } from './services/pulse-auth.service';

import { LandingComponent } from './features/landing/landing.component';
import { AboutComponent } from './features/about/about.component';
import { AppShowcaseComponent } from './features/app-showcase/app-showcase.component';
import { TakeSurveyComponent } from './features/take-survey/take-survey.component';
import { PulsePaidSuccessComponent } from './features/pulse-paid-success/pulse-paid-success.component';
import { GetTheAppComponent } from './features/get-the-app/get-the-app.component';
import { PulsesHomeComponent } from './features/pulse/home/pulses-home.component';
import { NewPulseComponent } from './features/pulse/new/new-pulse.component';
import { PulseShellComponent, PulseStepRedirectComponent } from './features/pulse/shell/pulse-shell.component';
import { WriteStepComponent } from './features/pulse/write/write-step.component';
import { ShareStepComponent } from './features/pulse/share/share-step.component';
import { ResultsStepComponent } from './features/pulse/results/results-step.component';
import { SignInComponent } from './features/sign-in/sign-in.component';
import { AuthCallbackComponent } from './features/auth-callback/auth-callback.component';
import { NotFoundComponent } from './features/not-found/not-found.component';

/**
 * Route-table coverage for app.routes.ts: every path resolves the
 * component it claims to, and the old URLs redirect into the new
 * Write / Share / Results flow. Defaults PulseAuthService to a signed-in
 * user and flips to signed-out where that's the point.
 */
describe( 'app.routes', () => {
  let currentUser: { uid: string; email: string; displayName?: string } | null;
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

  const pulseChildren = () => routes.find( ( route ) => route.path === 'survey/:id' )?.children || [];

  it( 'routes /ios to AppShowcaseComponent', async () => {
    const harness = await RouterTestingHarness.create( '/ios' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( AppShowcaseComponent );
  } );

  it( 'routes /about to AboutComponent', async () => {
    const harness = await RouterTestingHarness.create( '/about' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( AboutComponent );
  } );

  it( 'routes /take/:id to TakeSurveyComponent with no header', async () => {
    const harness = await RouterTestingHarness.create( '/take/survey-123' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( TakeSurveyComponent );
    expect( routes.find( ( route ) => route.path === 'take/:id' )?.data?.['chrome'] ).toBe( 'none' );
  } );

  it( 'routes /success to PulsePaidSuccessComponent', async () => {
    const harness = await RouterTestingHarness.create( '/success' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulsePaidSuccessComponent );
  } );

  it( 'routes /app to PulsesHomeComponent', async () => {
    const harness = await RouterTestingHarness.create( '/app' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulsesHomeComponent );
  } );

  it( 'routes /survey-edit to NewPulseComponent', async () => {
    const harness = await RouterTestingHarness.create( '/survey-edit' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( NewPulseComponent );
  } );

  it( 'routes /survey/:id to the pulse shell, with one child per step', async () => {
    const harness = await RouterTestingHarness.create( '/survey/survey-123/results' );
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulseShellComponent );
    const load = ( path: string ) => pulseChildren().find( ( route ) => route.path === path )?.loadComponent?.();
    expect( await load( '' ) ).toBe( PulseStepRedirectComponent );
    expect( await load( 'write' ) ).toBe( WriteStepComponent );
    expect( await load( 'share' ) ).toBe( ShareStepComponent );
    expect( await load( 'results' ) ).toBe( ResultsStepComponent );
  } );

  it( 'redirects the old list and dashboard URLs into the new flow', async () => {
    const router = TestBed.inject( Router );
    await RouterTestingHarness.create( '/survey-list' );
    expect( router.url ).toBe( '/app' );
    await router.navigateByUrl( '/survey-dashboard/survey-123' );
    expect( router.url ).toBe( '/survey/survey-123/results' );
  } );

  it( 'routes /pricing to GetTheAppComponent ("Choose a plan to publish" lands here)', async () => {
    // Checks the route without rendering it: Karma's webpack build doesn't
    // load the symlinked @taliferro/ui model the page reads.
    const route = routes.find( ( candidate ) => candidate.path === 'pricing' );
    expect( await route?.loadComponent?.() ).toBe( GetTheAppComponent );
    expect( route?.data?.['product'] ).toBe( 'pulse' );
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
    expect( harness.routeDebugElement?.componentInstance ).toBeInstanceOf( PulsesHomeComponent );
  } );
} );
