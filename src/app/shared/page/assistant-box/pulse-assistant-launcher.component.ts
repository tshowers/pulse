import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AssistantBoxComponent } from './assistant-box.component';
import { PulseAuthService } from '../../../services/pulse-auth.service';
import { PulseAssistantPageContext, PulseAssistantSignalService } from '../../../services/pulse-assistant-signal.service';

type GuidanceTone = 'neutral' | 'progress' | 'attention' | 'ready';

interface PulseGuidanceCard {
  eyebrow: string;
  title: string;
  message: string;
  whyItMatters: string;
  bullets: string[];
  stageLabel: string;
  tone: GuidanceTone;
  icon: string;
  nextStage?: string;
}

/** What the template actually binds to - the tone class is precomputed here
 *  so [ngClass] can read a plain field instead of calling a method. */
type RenderedGuidanceCard = PulseGuidanceCard & { toneClass: string };

/**
 * Pulse's launcher shell - same from-scratch equivalent of TODD's
 * todd-assistant.component.ts as web-products/network's
 * NetworkAssistantLauncherComponent. See that file's header comment for the
 * full rationale (suite-wide onboarding stripped, launcher chrome ported
 * near-verbatim, guidance card rebuilt from scratch per-product).
 *
 * Guidance cards have no CTA buttons, matching the later revision made to
 * Network's cards - sign-in and navigation stay in the existing menu, not
 * duplicated as buttons inside the chat card.
 */
@Component( {
  selector: 'app-pulse-assistant-launcher',
  standalone: true,
  imports: [CommonModule, AssistantBoxComponent],
  templateUrl: './pulse-assistant-launcher.component.html',
  styleUrls: ['./pulse-assistant-launcher.component.css'],
} )
export class PulseAssistantLauncherComponent implements OnInit, OnDestroy {
  private readonly authService = inject( PulseAuthService );
  private readonly assistantBus = inject( PulseAssistantSignalService );
  private readonly router = inject( Router );
  private readonly zone = inject( NgZone );

  private readonly launcherHotzoneSize = 180;
  private readonly launcherRevealDurationMs = 2400;
  private launcherHideTimer: ReturnType<typeof setTimeout> | null = null;

  showAssistant = false;
  launcherVisible = false;
  hasUnread = false;
  pageContext: PulseAssistantPageContext | null = null;
  isLoggedIn = false;

  userId: string | null = null;
  tenantId: string | null = null;

  private readonly subscriptions: Subscription[] = [];

  private readonly onDocumentMouseMove = ( event: MouseEvent ): void => {
    if ( this.isInBottomRightHotzone( event.clientX, event.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  private readonly onDocumentTouchStart = ( event: TouchEvent ): void => {
    const touch = event.touches?.[0];
    if ( touch && this.isInBottomRightHotzone( touch.clientX, touch.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  /**
   * The hotzone is a broad 180x180 proximity area, not just the pill's own
   * footprint - on narrower viewports a page's own bottom-right-anchored
   * button (e.g. a wizard's primary action) can fall inside it. Revealing
   * the pill there put it, at a higher z-index, physically on top of that
   * button for the rest of the same synthetic event sequence, so a click
   * meant for the page's button landed on the pill instead (toggling the
   * chat open) and the page's own action never fired. Skip the reveal
   * whenever the pointer/touch is already on top of some other clickable
   * element - that means the user is reaching for that, not the assistant.
   */
  private isOverOtherInteractiveElement ( target: EventTarget | null ): boolean {
    if ( !( target instanceof Element ) ) return false;
    if ( target.closest( '.todd-assistant-root' ) ) return false;
    return !!target.closest( 'button, a, input, select, textarea, [role="button"]' );
  }

  ngOnInit (): void {
    this.subscriptions.push(
      this.authService.isLoggedIn().subscribe( ( loggedIn ) => { this.isLoggedIn = loggedIn; this.refreshGuidanceCard(); } ),
      this.authService.getUserId().subscribe( ( id ) => ( this.userId = id || null ) ),
      this.authService.getTenantId().subscribe( ( id ) => ( this.tenantId = id || null ) ),
      this.assistantBus.pageContext$.subscribe( ( ctx ) => { this.pageContext = ctx; this.refreshGuidanceCard(); } ),
      this.assistantBus.unread$.subscribe( ( unread ) => ( this.hasUnread = unread ) ),
      this.assistantBus.openRequests$.subscribe( () => { if ( !this.showAssistant ) this.toggleAssistant(); } ),
    );

    // Bound manually (rather than @HostListener) and outside Angular's zone:
    // @HostListener always runs its callback inside the zone, which means
    // zone.js schedules a full app-wide change detection pass after every
    // single mousemove/touchstart anywhere on the page, whether or not the
    // pointer is anywhere near the hotzone. Only re-enter the zone
    // (`this.zone.run`) on the rare occasion the pointer is actually in the
    // hotzone and launcherVisible needs to update.
    this.zone.runOutsideAngular( () => {
      document.addEventListener( 'mousemove', this.onDocumentMouseMove, { passive: true } );
      document.addEventListener( 'touchstart', this.onDocumentTouchStart, { passive: true } );
    } );
  }

  ngOnDestroy (): void {
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
    this.subscriptions.forEach( ( s ) => s.unsubscribe() );
    document.removeEventListener( 'mousemove', this.onDocumentMouseMove );
    document.removeEventListener( 'touchstart', this.onDocumentTouchStart );
  }

  private isInBottomRightHotzone ( clientX: number, clientY: number ): boolean {
    return clientX >= ( window.innerWidth - this.launcherHotzoneSize )
      && clientY >= ( window.innerHeight - this.launcherHotzoneSize );
  }

  private revealLauncherTemporarily (): void {
    this.zone.run( () => {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );

      if ( this.showAssistant ) return;

      this.launcherHideTimer = setTimeout( () => {
        if ( !this.showAssistant ) this.launcherVisible = false;
      }, this.launcherRevealDurationMs );
    } );
  }

  toggleAssistant (): void {
    this.showAssistant = !this.showAssistant;
    if ( this.showAssistant ) {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
      this.assistantBus.clearAssistantUnread();
    }
  }

  dismissAssistant (): void {
    this.showAssistant = false;
    this.launcherVisible = false;
  }

  onAssistantNavigate ( target: { path: string; queryParams?: any; fragment?: string; } ): void {
    if ( !target?.path ) return;
    void this.router.navigate( [target.path], { queryParams: target.queryParams, fragment: target.fragment } );
  }

  guidanceCard: RenderedGuidanceCard | null = null;

  private refreshGuidanceCard (): void {
    const card = this.isLoggedIn ? this.computeGuidanceCard( this.pageContext ) : this.guestOrientationCard;
    this.guidanceCard = card ? { ...card, toneClass: `todd-activation-card--${card.tone}` } : null;
  }

  /**
   * Guest/logged-out mode: no account data yet, so this orients a visitor
   * to what the page does instead of giving a personalized next move - same
   * role as web-products/network's guest card.
   */
  private get guestOrientationCard (): PulseGuidanceCard {
    return {
      eyebrow: 'WHAT IS THIS PAGE',
      stageLabel: 'Overview',
      tone: 'neutral',
      icon: 'fa-solid fa-compass',
      title: 'Pulse tracks how your customers actually feel',
      message: 'TODD uses survey responses to show where relief is visible, where a symptom still needs treatment, and what proof is emerging. Sign in to see it work with your own data.',
      whyItMatters: "A survey by itself is just a form - Pulse is what turns responses into a signal you can act on.",
      bullets: [
        'Create a Pulse to start collecting responses.',
        'TODD flags surveys sitting as drafts or published with no responses yet.',
        'Ask this chat how Pulse works, or what TODD actually does.',
      ],
    };
  }

  /** One short card per Pulse page (pages set `feature: 'pulse'` in their context). */
  private computeGuidanceCard ( ctx: PulseAssistantPageContext | null ): PulseGuidanceCard | null {
    if ( !ctx || ctx.feature !== 'pulse' ) return null;
    const summary = ctx.summary || {};

    switch ( ctx.page ) {
      case 'home': {
        const total = Number( summary['all'] || 0 );
        return {
          eyebrow: 'PULSES',
          stageLabel: total ? `${total} pulse${total === 1 ? '' : 's'}` : 'No pulses yet',
          tone: total ? 'neutral' : 'attention',
          icon: 'fa-solid fa-list',
          title: total ? 'Every pulse shows the one thing it needs' : 'Ask your first question',
          message: total ? 'Live pulses open their results, drafts open Write or Share. TODD’s latest next move sits on top.' : 'Describe what you want to find out and TODD drafts the questions.',
          whyItMatters: 'A pulse only says something once people have answered it.',
          bullets: ['Ask me which pulse needs attention, or what a summary means.'],
        };
      }
      case 'write':
        return {
          eyebrow: 'STEP 1 · WRITE',
          stageLabel: `${Number( summary['questions'] || 0 )} questions`,
          tone: 'progress',
          icon: 'fa-solid fa-pen',
          title: 'Short, neutral questions get the most answers',
          message: 'Everything saves as you type. TODD’s review on the right suggests fixes you can apply in one tap.',
          whyItMatters: 'Three to five questions is the sweet spot: every extra one means fewer people finish.',
          bullets: ['Use Try it to answer it yourself before you share it.'],
        };
      case 'results':
        return {
          eyebrow: 'STEP 3 · RESULTS',
          stageLabel: `${Number( summary['answers'] || 0 )} answers`,
          tone: summary['toddSummary'] ? 'ready' : 'progress',
          icon: 'fa-solid fa-chart-simple',
          title: summary['toddSummary'] ? 'Ask me about these results' : 'TODD writes a summary at 5 answers',
          message: summary['toddSummary'] ? String( summary['toddSummary'] ) : 'Question cards fill in as people answer. The summary and a next move appear once 5 people have answered.',
          whyItMatters: 'A result is only useful once it changes what you do next.',
          bullets: summary['nextMove'] ? [`Next move: ${summary['nextMove']}`] : [],
        };
      default:
        return null;
    }
  }
}
