import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';
import { PageMeta } from './shared/page-meta';

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
    data: { meta: { title: 'About Pulse — How 16Ahead listens | 16Ahead', description: 'Pulse asks your customers, users and team a few focused questions, so your next move is based on what people actually said instead of a guess.' } satisfies PageMeta },
    loadComponent: () =>
      import( './features/about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
  {
    path: 'help',
    data: { meta: { title: 'Pulse help — Writing surveys that get answers | 16Ahead', description: 'How to write, share and read a pulse: from a question to a decision, writing questions that get answers, and common questions about plans and publishing.' } satisfies PageMeta },
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    // Dedicated product showcase for the Pulsur iOS app.
    path: 'ios',
    data: { meta: { title: 'Pulsur — Pulse in your pocket for iPhone | 16Ahead', description: 'Pulsur brings Pulse to iPhone: the question, the responses, and the read on the room, wherever the moment happens. Coming soon to the App Store.' } satisfies PageMeta },
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
    data: {
      product: 'pulse',
      meta: { title: 'Pricing — Pulse | 16Ahead', description: 'Pulse pricing: writing pulses is free. Publishing a pulse and collecting answers is on the paid plan.' } satisfies PageMeta,
    },
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
    // replacing the menu's link out to the hub's /update-profile.
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
    data: { meta: { title: 'Pulse support | 16Ahead', description: 'Questions about your surveys, your account, or the Pulse app? Read the FAQ or reach out and we\'ll get back to you.' } satisfies PageMeta },
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
