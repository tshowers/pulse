import { Injectable } from '@angular/core';

/**
 * Single-method no-op stub. There's no Network precedent for this one -
 * PulseHomeComponent (survey-home in the monorepo) is the only place in
 * Pulse that touches TODD's real 515-line ToddOnboardingService, and it
 * calls exactly one method: `completeFirstWin(context, 'analyze')`, fired
 * when a user finishes the guided "first win" flow after analyzing survey
 * results. TODD's full onboarding system (intent overlays, guided routes,
 * localStorage-backed maturity tracking) is out of scope for this
 * extraction, so this just swallows the call.
 */
@Injectable( { providedIn: 'root' } )
export class PulseOnboardingService {
  completeFirstWin ( _context: Record<string, unknown>, _intent: string ): void { }
}
