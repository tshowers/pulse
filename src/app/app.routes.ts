import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';

/**
 * design_handoff_todd_pulse, "Information architecture". Every pulse has
 * one flow, /survey/:id/write → share → results, inside PulseShellComponent.
 * The old URLs (/survey-list, /survey/:id, /survey-dashboard/:id,
 * /survey-edit?id=) redirect so links in email, Universal Links and
 * bookmarks keep working.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import( './features/about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    // Dedicated product showcase for the Pulsur iOS app.
    path: 'ios',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    path: 'take/:id',
    data: { chrome: 'none' },
    loadComponent: () =>
      import( './features/take-survey/take-survey.component' ).then( ( m ) => m.TakeSurveyComponent ),
  },
  {
    path: 'app',
    loadComponent: () =>
      import( './features/pulse/home/pulses-home.component' ).then( ( m ) => m.PulsesHomeComponent ),
  },
  {
    // New pulse (1b). ?id= is the old editor's URL; it forwards to Write.
    path: 'survey-edit',
    loadComponent: () =>
      import( './features/pulse/new/new-pulse.component' ).then( ( m ) => m.NewPulseComponent ),
  },
  {
    path: 'survey/:id',
    loadComponent: () =>
      import( './features/pulse/shell/pulse-shell.component' ).then( ( m ) => m.PulseShellComponent ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import( './features/pulse/shell/pulse-shell.component' ).then( ( m ) => m.PulseStepRedirectComponent ),
      },
      {
        path: 'write',
        loadComponent: () =>
          import( './features/pulse/write/write-step.component' ).then( ( m ) => m.WriteStepComponent ),
      },
      {
        path: 'share',
        loadComponent: () =>
          import( './features/pulse/share/share-step.component' ).then( ( m ) => m.ShareStepComponent ),
      },
      {
        path: 'results',
        loadComponent: () =>
          import( './features/pulse/results/results-step.component' ).then( ( m ) => m.ResultsStepComponent ),
      },
    ],
  },
  { path: 'survey-list', redirectTo: 'app', pathMatch: 'full' },
  { path: 'survey-dashboard/:surveyId', redirectTo: 'survey/:surveyId/results' },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/pulse-paid-success/pulse-paid-success.component' ).then( ( m ) => m.PulsePaidSuccessComponent ),
  },
  {
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts; replaces the old
    // Stripe plan page. Share's "Choose a plan to publish" lands here.
    path: 'pricing',
    data: { product: 'pulse' },
    loadComponent: () =>
      import( './features/get-the-app/get-the-app.component' ).then( ( m ) => m.GetTheAppComponent ),
  },
  {
    // Pre-sign-in wizard: build a first survey, then name + company, then
    // sign in (web twin of pulse-ios's PreAuthSurveyBuilderView). /login
    // stays a direct handoff for returning users and deep links.
    path: 'get-started',
    loadComponent: () =>
      import( './features/get-started/get-started.component' ).then( ( m ) => m.GetStartedComponent ),
  },
  {
    // In-app profile (shared fields/API with the iOS apps' TODDProfileKit),
    // replacing the menu's link out to TODD's /update-profile.
    path: 'profile',
    loadComponent: () =>
      import( './features/profile/profile.component' ).then( ( m ) => m.ProfileComponent ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'auth/callback',
    data: { chrome: 'none' },
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'support',
    loadComponent: () =>
      import( './features/support/support.component' ).then( ( m ) => m.SupportComponent ),
  },
  {
    path: 'mobile-handoff',
    data: { chrome: 'none' },
    loadComponent: () =>
      import( './features/mobile-handoff/mobile-handoff.component' ).then( ( m ) => m.MobileHandoffComponent ),
  },
  {
    // Catches any unmatched URL (typos, stale links, deep links to routes
    // that never existed here) - without this, the router just silently
    // fails to navigate instead of showing anything.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
