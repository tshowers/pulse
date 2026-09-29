import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
  },
  {
    // Dedicated product showcase for the future Pulse iOS app.
    path: 'ios',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'take/:id',
    loadComponent: () =>
      import( './features/take-survey/take-survey.component' ).then( ( m ) => m.TakeSurveyComponent ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/pulse-paid-success/pulse-paid-success.component' ).then( ( m ) => m.PulsePaidSuccessComponent ),
  },
  {
    path: 'survey-list',
    loadComponent: () =>
      import( './features/survey-list/survey-list.component' ).then( ( m ) => m.SurveyListComponent ),
  },
  {
    path: 'survey-dashboard/:surveyId',
    loadComponent: () =>
      import( './features/survey-dashboard/survey-dashboard.component' ).then( ( m ) => m.SurveyDashboardComponent ),
  },
  {
    path: 'survey/:id',
    loadComponent: () =>
      import( './features/survey-view/survey-view.component' ).then( ( m ) => m.SurveyViewComponent ),
  },
  {
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts; replaces the old
    // Stripe plan page.
    path: 'pricing',
    data: { product: 'pulse' },
    loadComponent: () =>
      import( './features/get-the-app/get-the-app.component' ).then( ( m ) => m.GetTheAppComponent ),
  },
  {
    path: 'survey-edit',
    loadComponent: () =>
      import( './features/survey-add/survey-add.component' ).then( ( m ) => m.SurveyAddComponent ),
  },
  {
    path: 'app',
    loadComponent: () =>
      import( './features/pulse-home/pulse-home.component' ).then( ( m ) => m.PulseHomeComponent ),
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
    loadComponent: () =>
      import( './features/mobile-handoff/mobile-handoff.component' ).then( ( m ) => m.MobileHandoffComponent ),
  },
  {
    // Catches any unmatched URL (typos, stale links, deep links to routes
    // that never existed here) - without this, the router just silently
    // fails to navigate instead of showing anything. Not in the plan's
    // route table, added anyway matching Network's own convention.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
