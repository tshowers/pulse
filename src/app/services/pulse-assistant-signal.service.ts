import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';

export type ToddSignalState = 'idle' | 'listening' | 'thinking' | 'ready';

export interface ToddEngagementActionRequest {
  interventionId: string;
  action: string;
  payload?: Record<string, unknown>;
  source: 'primary' | 'secondary';
}

export interface PulseAssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: 'view' | 'create' | 'edit' | 'list' | 'search' | 'dashboard';
  title?: string;
  description?: string;
  allowedActions?: string[];
  selectedEntityType?: string;
  selectedEntityId?: string;
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
}

export interface PulseAssistantActivityEvent {
  feature: string;
  page: string;
  action: string;
  route?: string;
  mode?: string;
  summary?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface PulseAssistantTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Real implementation of the bus every ported Pulse page already calls into
 * - unlike Network's original stub, this one was already widened before
 * today (SurveyHomeComponent/SurveyViewComponent/SurveyAddComponent/
 * PulsePricingComponent/PulsePaidSuccessComponent all subscribe to
 * `signalState$`, and SurveyAddComponent/SurveyViewComponent also subscribe
 * to `engagementActionRequest$`). Those two stay exactly as they were in the
 * no-op stub - always idle, never emits - since neither is rendered
 * anywhere in the ported templates and wiring them to something real would
 * mean pulling in the suite-wide engagement-decision engine this scoping
 * decision keeps out. Everything else (pageContext$/transcriptIn$/unread$)
 * is the same real bus pattern as web-products/network's
 * NetworkAssistantSignalService.
 */
@Injectable( { providedIn: 'root' } )
export class PulseAssistantSignalService {
  /** Always idle - matches the stub this replaces; nothing renders it. */
  readonly signalState$: Observable<ToddSignalState> = of( 'idle' );

  /** Never emits - matches the stub this replaces; no engagement-decision engine here. */
  readonly engagementActionRequest$: Observable<ToddEngagementActionRequest> = new Observable();

  private readonly pageContextSubject = new BehaviorSubject<PulseAssistantPageContext | null>( null );
  private readonly transcriptInSubject = new Subject<PulseAssistantTranscriptMessage>();
  private readonly activitySubject = new Subject<PulseAssistantActivityEvent>();
  private readonly unreadSubject = new BehaviorSubject<boolean>( false );
  private readonly readySubject = new BehaviorSubject<boolean>( false );

  readonly pageContext$ = this.pageContextSubject.asObservable();
  readonly transcriptIn$ = this.transcriptInSubject.asObservable();
  readonly activity$ = this.activitySubject.asObservable();
  readonly unread$ = this.unreadSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  get currentPageContext (): PulseAssistantPageContext | null {
    return this.pageContextSubject.value;
  }

  emitAssistantActivity ( event: PulseAssistantActivityEvent ): void {
    this.activitySubject.next( event );
  }

  setPageContext ( context: PulseAssistantPageContext ): void {
    this.pageContextSubject.next( context );
  }

  clearPageContext (): void {
    this.pageContextSubject.next( null );
  }

  pushTranscript ( message: PulseAssistantTranscriptMessage ): void {
    this.transcriptInSubject.next( message );
  }

  markAssistantUnread (): void {
    this.unreadSubject.next( true );
  }

  clearAssistantUnread (): void {
    this.unreadSubject.next( false );
  }

  setSignalReady (): void {
    this.readySubject.next( true );
  }
}
