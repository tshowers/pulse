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
];
