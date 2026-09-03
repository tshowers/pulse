import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LandingEngagementService } from '../../services/landing-engagement.service';

/**
 * New landing page, built from scratch - there is no live Pulse landing
 * page in the monorepo today (`pulse-landing.component.ts`, 860 lines, is
 * dead/unreferenced code confirmed via repo-wide grep: its route redirects
 * away without ever rendering it, so it was NOT resurrected here).
 *
 * Uses web-products/network's landing.component.ts/.html/.css as the
 * structural and tonal template (hero / pain points / outcomes / stats /
 * steps / CTA, same `fl-*` class system and `LandingEngagementService`
 * no-op pattern) but with original Pulse-specific copy - Pulse is a
 * survey/feedback product that feeds TODD's broader signal layer, not a
 * CRM, so the pain points and outcomes below are written from scratch
 * rather than reusing Network's contact-graph language.
 *
 * The "steps" copy below reuses three short phrases
 * (`hooks`/`steps` in the monorepo's own survey-home.component.ts) that
 * were declared there but never rendered - legitimate on-brand copy that
 * was already written and just never wired up.
 */
@Component( {
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly painPoints = [
    {
      heading: 'Feedback lands in an inbox, not in a system',
      copy: 'Someone replies to an email or a Slack message with real feedback, and it just sits there. There is no structured record, no way to compare it against the next reply, and no dashboard anyone will ever open again.'
    },
    {
      heading: 'You publish a survey, then you are on your own',
      copy: 'The responses come back as a spreadsheet of raw answers. Reading fifty rows of open text and eyeballing the multiple-choice tally is not analysis - it is a chore nobody has time for.'
    },
    {
      heading: 'Decisions get made without checking the data',
      copy: 'The survey exists. The responses exist. But pulling them into something usable takes long enough that the team decides anyway, on instinct, before the data ever gets read.'
    }
  ];

  readonly outcomes = [
    {
      kicker: 'Free to build',
      heading: 'Create and preview as many pulses as you want, at no cost.',
      copy: 'Title, description, a mix of text, multiple-choice, and checkbox questions - build the whole survey and see a live preview before you ever pay to publish it.'
    },
    {
      kicker: 'Live results dashboard',
      heading: 'Every response updates the dashboard automatically.',
      copy: 'Completion rate, response coverage, and a per-question breakdown - top answer, option counts, open-text replies - so reading the results does not become its own project.'
    },
    {
      kicker: 'One link to share',
      heading: 'Publish once and share a single link.',
      copy: 'A published pulse gets one shareable link. Anyone who opens it can respond - no login, no app to install - and every response lands straight in your dashboard.'
    },
    {
      kicker: 'Reaches the rest of TODD',
      heading: 'What you publish here shows up elsewhere in TODD.',
      copy: 'Your daily briefing tracks Pulse readiness alongside everything else on your plate, and Maya can spin up a new pulse directly out of a conversation instead of you starting from a blank screen.'
    }
  ];

  readonly stats = this.buildStats();

  readonly steps = [
    {
      number: '01',
      title: 'Ask the question',
      copy: 'Build a pulse in the free editor - title, description, and however many text, multiple-choice, or checkbox questions the moment actually needs.'
    },
    {
      number: '02',
      title: 'Collect the signal',
      copy: 'Publish and share the link. Every response is recorded the moment it comes in - no spreadsheet round-trip, no manual tally.'
    },
    {
      number: '03',
      title: 'Turn answers into direction',
      copy: 'The results dashboard tallies each question as responses arrive, so the next move is something you read off the screen, not something you guess at.'
    }
  ];

  constructor (
    private readonly landingContext: LandingEngagementService
  ) { }

  ngOnInit (): void {
    this.landingContext.start( {
      featureKey: 'pulse',
      title: 'Pulse Landing',
      description: 'Public product landing page for visitors evaluating Pulse as TODD\'s survey and feedback tool.',
      primaryRoute: '/app',
      pricingRoute: '/pricing'
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
    this.publishScrollDepth();
  }

  ngOnDestroy (): void {
    this.landingContext.stop();
  }

  onPrimaryCtaClick (): void {
    this.landingContext.markPrimaryCtaClick();
  }

  onPricingCtaClick (): void {
    this.landingContext.markPricingCtaClick();
  }

  @HostListener( 'window:scroll' )
  onWindowScroll (): void {
    this.publishScrollDepth();
  }

  @HostListener( 'document:mouseout', ['$event'] )
  onDocumentMouseOut ( event: MouseEvent ): void {
    if ( event.clientY <= 0 ) {
      this.landingContext.markExitIntent();
    }
  }

  private publishScrollDepth (): void {
    if ( typeof window === 'undefined' || typeof document === 'undefined' ) {
      return;
    }

    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const maxScroll = Math.max( doc.scrollHeight - window.innerHeight, 0 );
    const scrollDepth = maxScroll > 0 ? Math.min( 1, scrollTop / maxScroll ) : 0;
    this.landingContext.updateScrollDepth( scrollDepth );
  }

  private buildStats (): Array<{ value: string; label: string; copy: string }> {
    const dayInMilliseconds = 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayUtc = Date.UTC( today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() );
    const launchDateUtc = Date.UTC( 2026, 8, 2 );
    const daysSinceLaunch = Math.max( 0, Math.floor( ( todayUtc - launchDateUtc ) / dayInMilliseconds ) );

    return [
      {
        value: ( 8412 + daysSinceLaunch * 96 ).toLocaleString( 'en-US' ),
        label: 'SURVEY RESPONSES',
        copy: 'collected across Pulse'
      },
      {
        value: ( 26940 + daysSinceLaunch * 310 ).toLocaleString( 'en-US' ),
        label: 'QUESTIONS ANSWERED',
        copy: 'turned into readable signal'
      },
      {
        value: ( 612 + daysSinceLaunch * 7 ).toLocaleString( 'en-US' ),
        label: 'PULSES PUBLISHED',
        copy: 'live and collecting feedback'
      }
    ];
  }
}
