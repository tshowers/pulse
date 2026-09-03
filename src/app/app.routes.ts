import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
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
    path: 'pricing',
    loadComponent: () =>
      import( './features/pulse-pricing/pulse-pricing.component' ).then( ( m ) => m.PulsePricingComponent ),
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
    // Catches any unmatched URL (typos, stale links, deep links to routes
    // that never existed here) - without this, the router just silently
    // fails to navigate instead of showing anything. Not in the plan's
    // route table, added anyway matching Network's own convention.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
