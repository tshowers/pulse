import { AfterViewInit, Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LandingEngagementService } from '../../services/landing-engagement.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

/**
 * The signed-out home (design_handoff_todd_pulse 2a). The hero's product
 * card is real markup in the Results look, not a screenshot, so it follows
 * light/dark. The sample numbers are illustrative.
 */
@Component( {
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteFooterComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly landingContext = inject( LandingEngagementService );

  readonly sampleBars = [
    { label: 'Yes', value: '30 · 79%', pct: 79, color: 'var(--t-green-fg)' },
    { label: 'Not sure', value: '8 · 21%', pct: 21, color: 'var(--t-yellow-fg)' },
    { label: 'No', value: '0 · 0%', pct: 0, color: 'var(--muted)' },
  ];

  readonly steps = [
    { n: 1, title: 'Write', tint: 'green', copy: 'Tell TODD what you want to find out and she drafts the questions. Change anything, or write your own. Free, as many as you like.' },
    { n: 2, title: 'Share', tint: 'violet', copy: 'Publish to get one link. People answer on any phone or computer, one question at a time, with no account to make.' },
    { n: 3, title: 'Results', tint: 'blue', copy: 'Answers fill in live. After 5 answers TODD writes a summary of what people said and suggests your next move.' },
  ];

  readonly painPoints = [
    {
      heading: 'Feedback lands in an inbox, not in a system',
      copy: 'Someone replies to an email or a Slack message with real feedback, and it just sits there. There is no structured record, no way to compare it against the next reply, and no dashboard anyone will ever open again.',
    },
    {
      heading: 'You publish a survey, then you are on your own',
      copy: 'The responses come back as a spreadsheet of raw answers. Reading fifty rows of open text and eyeballing the multiple-choice tally is not analysis - it is a chore nobody has time for.',
    },
    {
      heading: 'Decisions get made without checking the data',
      copy: 'The survey exists. The responses exist. But pulling them into something usable takes long enough that the team decides anyway, on instinct, before the data ever gets read.',
    },
  ];

  readonly faqs = [
    { question: 'Can I build a Pulse before I pay?', answer: 'Yes. You can create and preview pulses for free, then upgrade when you are ready to publish and collect responses.' },
    { question: 'How are responses summarized?', answer: 'Each question gets a live chart or list of answers. TODD reads all of them, groups written answers by theme, and writes a short summary with a suggested next move once 5 people have answered.' },
    { question: 'Do respondents need an account?', answer: 'No. A published pulse can be shared by link, and people can respond without installing an app or signing in.' },
    { question: 'Who is Pulse for?', answer: 'Pulse is for teams that need to ask a clear question, collect real feedback, and turn the answers into a direction quickly.' },
  ];

  readonly openFaq = signal( 0 );

  ngOnInit (): void {
    this.landingContext.start( {
      featureKey: 'pulse',
      title: 'Pulse Landing',
      description: 'Public product landing page for visitors evaluating Pulse as TODD\'s survey and feedback tool.',
      primaryRoute: '/app',
      pricingRoute: '/pricing',
    } );
  }

  ngAfterViewInit (): void {
    if ( typeof window === 'undefined' ) return;
    window.scrollTo( 0, 0 );
    this.publishScrollDepth();
  }

  ngOnDestroy (): void {
    this.landingContext.stop();
  }

  toggleFaq ( index: number ): void {
    this.openFaq.set( this.openFaq() === index ? -1 : index );
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
    if ( event.clientY <= 0 ) this.landingContext.markExitIntent();
  }

  private publishScrollDepth (): void {
    if ( typeof window === 'undefined' || typeof document === 'undefined' ) return;
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const maxScroll = Math.max( doc.scrollHeight - window.innerHeight, 0 );
    this.landingContext.updateScrollDepth( maxScroll > 0 ? Math.min( 1, scrollTop / maxScroll ) : 0 );
  }
}
