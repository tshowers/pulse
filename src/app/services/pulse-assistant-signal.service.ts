import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export type ToddSignalState = 'idle' | 'listening' | 'thinking' | 'ready';

export interface ToddEngagementActionRequest {
  interventionId: string;
  action: string;
  payload?: Record<string, unknown>;
  source: 'primary' | 'secondary';
}

/**
 * No-op stand-in for the page-context/activity-reporting slice of
 * ToddAssistantBusService, copied from web-products/network's
 * NetworkAssistantSignalService. This app deliberately doesn't carry
 * TODD's full assistant bus (a separate, much bigger project than this
 * extraction), so ported components' calls to report page context,
 * transcript nudges, and activity events have nowhere to go. Kept as a
 * same-shaped no-op rather than deleted from each call site, both to
 * minimize the diff against the original component and because a real
 * Pulse-scoped assistant (if/when built) would plug in here.
 *
 * Widened beyond Network's version: SurveyHomeComponent, SurveyViewComponent,
 * SurveyAddComponent, PulsePricingComponent, and PulsePaidSuccessComponent
 * all subscribe to `signalState$` (to drive a status indicator) and
 * SurveyAddComponent/SurveyViewComponent also subscribe to
 * `engagementActionRequest$` - both need to exist as real observables here,
 * not just method stubs, or those subscriptions would fail to compile.
 */
@Injectable( { providedIn: 'root' } )
export class PulseAssistantSignalService {
  /** Always idle - no real assistant bus behind this app. */
  readonly signalState$: Observable<ToddSignalState> = of( 'idle' );

  /** Never emits - nothing ever requests an engagement action here. */
  readonly engagementActionRequest$: Observable<ToddEngagementActionRequest> = new Observable();

  emitAssistantActivity ( _event: Record<string, unknown> ): void { }
  setPageContext ( _context: Record<string, unknown> | null ): void { }
  clearPageContext (): void { }
  pushTranscript ( _message: { role: string; content: string } ): void { }
  markAssistantUnread (): void { }
  setSignalReady (): void { }
}
