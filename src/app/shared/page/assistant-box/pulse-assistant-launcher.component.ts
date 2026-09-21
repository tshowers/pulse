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

  private computeGuidanceCard ( ctx: PulseAssistantPageContext | null ): PulseGuidanceCard | null {
    if ( !ctx || String( ctx.feature || '' ).toLowerCase() !== 'surveys' ) return null;

    switch ( String( ctx.page || '' ).toLowerCase() ) {
      case 'survey-home': return this.surveyHomeCard( ctx );
      case 'survey-list': return this.surveyListCard( ctx );
      case 'survey-add': return this.surveyAddCard( ctx );
      case 'survey-view': return this.surveyViewCard( ctx );
      case 'survey-dashboard': return this.surveyDashboardCard( ctx );
      default: return null;
    }
  }

  private surveyHomeCard ( ctx: PulseAssistantPageContext ): PulseGuidanceCard {
    const summary = ctx.summary || {};
    const total = Number( summary['totalSurveyCount'] || 0 );
    const draftCount = Number( summary['draftSurveyCount'] || 0 );
    const dormantCount = Number( summary['dormantPublishedCount'] || 0 );
    const totalResponses = Number( summary['totalResponses'] || 0 );
    const healthScore = Number( summary['customerHealthScore'] || 0 );

    if ( total === 0 ) {
      return {
        eyebrow: 'GETTING STARTED',
        stageLabel: 'No pulses yet',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Create your first Pulse',
        message: "TODD doesn't see any surveys yet. Build one to start collecting customer signal.",
        whyItMatters: 'Pulse only has something to say once there are responses to read.',
        bullets: ['Describe what you want to learn and TODD can draft the questions.'],
      };
    }

    if ( dormantCount > 0 ) {
      return {
        eyebrow: 'CUSTOMER HEALTH',
        stageLabel: 'Needs attention',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: dormantCount === 1 ? '1 published Pulse has no responses yet' : `${dormantCount} published Pulses have no responses yet`,
        message: 'A published survey with zero responses isn’t generating signal. Share it again or check that it’s reaching the right people.',
        whyItMatters: 'Response volume is what turns a Pulse into usable customer health data.',
        bullets: [`${total.toLocaleString()} total Pulses, ${totalResponses.toLocaleString()} responses so far.`],
      };
    }

    if ( draftCount > 0 ) {
      return {
        eyebrow: 'CUSTOMER HEALTH',
        stageLabel: 'Drafts pending',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: `${draftCount} draft Pulse${draftCount === 1 ? '' : 's'} waiting to publish`,
        message: 'Finish and publish these to start collecting responses.',
        whyItMatters: 'A draft collects nothing until it’s published.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'CUSTOMER HEALTH',
      stageLabel: healthScore >= 70 ? 'Healthy' : healthScore >= 40 ? 'Mixed' : 'Watch',
      tone: healthScore >= 70 ? 'ready' : healthScore >= 40 ? 'progress' : 'attention',
      icon: healthScore >= 70 ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half',
      title: `Customer health score: ${healthScore}`,
      message: `${total.toLocaleString()} Pulses, ${totalResponses.toLocaleString()} responses collected. Review the diagnosis and treatment log for where signal is missing or improving.`,
      whyItMatters: 'The health score is only as good as the response volume behind it - keep Pulses active to keep it current.',
      bullets: [],
    };
  }

  private surveyListCard ( ctx: PulseAssistantPageContext ): PulseGuidanceCard {
    const summary = ctx.summary || {};
    const hasSurveys = summary['hasSurveys'] === true;
    const surveyCount = Number( summary['surveyCount'] || 0 );

    if ( !hasSurveys ) {
      return {
        eyebrow: 'PULSE LIST',
        stageLabel: 'Empty',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'No Pulses yet',
        message: 'Create one to see it listed here.',
        whyItMatters: 'This is where you browse, sort, and open every survey you’ve built.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'PULSE LIST',
      stageLabel: 'Browsing',
      tone: 'neutral',
      icon: 'fa-solid fa-list',
      title: `Browsing ${surveyCount.toLocaleString()} Pulses`,
      message: 'Click any Pulse to open it, sort by clicking a column header, or open the dashboard for response detail.',
      whyItMatters: 'Status (draft/published/archived) tells you which surveys are actually live.',
      bullets: [],
    };
  }

  private surveyAddCard ( ctx: PulseAssistantPageContext ): PulseGuidanceCard {
    const summary = ctx.summary || {};
    const isEditing = summary['isEditing'] === true;
    const hasTitle = summary['hasTitle'] === true;
    const questionCount = Number( summary['questionCount'] || 0 );

    if ( !hasTitle ) {
      return {
        eyebrow: isEditing ? 'EDIT PULSE' : 'CREATE PULSE',
        stageLabel: 'Getting started',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Give this Pulse a title',
        message: 'A clear title helps respondents (and TODD) know what this survey is actually asking about.',
        whyItMatters: 'Titles show up everywhere - the list, the dashboard, and the link you share.',
        bullets: [],
      };
    }

    if ( questionCount === 0 ) {
      return {
        eyebrow: isEditing ? 'EDIT PULSE' : 'CREATE PULSE',
        stageLabel: 'No questions yet',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Add at least one question',
        message: 'Describe what you want to learn - ask TODD to draft questions from that description, or add them one at a time.',
        whyItMatters: 'A Pulse with no questions has nothing to publish.',
        bullets: [],
      };
    }

    return {
      eyebrow: isEditing ? 'EDIT PULSE' : 'CREATE PULSE',
      stageLabel: 'Ready',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: `${questionCount} question${questionCount === 1 ? '' : 's'} ready`,
      message: 'This Pulse has a title and questions. Save it, then publish when you’re ready to start collecting responses.',
      whyItMatters: 'Nothing collects responses until it’s saved and published.',
      bullets: [],
    };
  }

  private surveyViewCard ( ctx: PulseAssistantPageContext ): PulseGuidanceCard {
    const summary = ctx.summary || {};
    const status = String( summary['surveyStatus'] || 'draft' );
    const responseCount = Number( summary['responseCount'] || 0 );

    if ( status !== 'published' ) {
      return {
        eyebrow: 'PULSE',
        stageLabel: 'Draft',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'This Pulse is still a draft',
        message: 'Publish it to start collecting responses - or preview it first to see what respondents will see.',
        whyItMatters: 'A draft is invisible to everyone but you.',
        bullets: [],
      };
    }

    if ( responseCount === 0 ) {
      return {
        eyebrow: 'PULSE',
        stageLabel: 'Published, no responses',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Published, but no responses yet',
        message: 'Copy the share link and get it in front of respondents.',
        whyItMatters: 'A published Pulse with zero responses isn’t generating any signal yet.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'PULSE',
      stageLabel: 'Collecting',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: `${responseCount.toLocaleString()} response${responseCount === 1 ? '' : 's'} so far`,
      message: 'Open the results dashboard to see the strongest response signals and question-level detail.',
      whyItMatters: 'Response volume is what makes the dashboard’s signal detection meaningful.',
      bullets: [],
      nextStage: 'Results dashboard',
    };
  }

  private surveyDashboardCard ( ctx: PulseAssistantPageContext ): PulseGuidanceCard {
    const summary = ctx.summary || {};
    const totalResponses = Number( summary['totalResponses'] || 0 );
    const completionPercent = Number( summary['completionPercent'] || 0 );
    const engagementPercent = Number( summary['engagementPercent'] || 0 );

    if ( totalResponses === 0 ) {
      return {
        eyebrow: 'RESULTS',
        stageLabel: 'No responses',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'No responses yet',
        message: 'There’s nothing to analyze until responses come in. Share the survey link to start collecting them.',
        whyItMatters: 'This dashboard needs response data to have anything to show.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'RESULTS',
      stageLabel: engagementPercent >= 60 ? 'Strong signal' : engagementPercent >= 30 ? 'Building' : 'Early',
      tone: engagementPercent >= 60 ? 'ready' : engagementPercent >= 30 ? 'progress' : 'attention',
      icon: engagementPercent >= 60 ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half',
      title: `${totalResponses.toLocaleString()} response${totalResponses === 1 ? '' : 's'} collected`,
      message: `${completionPercent}% completion rate, ${engagementPercent}% engagement. Review the strongest response signals to see what’s worth acting on first.`,
      whyItMatters: 'Completion and engagement together tell you whether the questions themselves are working, not just whether people started.',
      bullets: [],
    };
  }
}
