import { Routes } from '@angular/router';

/**
 * Routes are added incrementally as each component is ported per the
 * extraction plan's build order - every ported component must be wired in
 * here before `ng build` is trusted, since `ng build` doesn't type-check
 * anything unreachable from a route.
 */
export const routes: Routes = [
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
];
