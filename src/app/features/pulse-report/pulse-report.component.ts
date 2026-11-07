import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PulseReferralProvider, PulseReportPublic } from '../../models/pulse-report.model';
import { SurveyApiService } from '../../services/survey-api.service';
import { renderReportMarkdown } from '../../shared/report-markdown';

/**
 * /report/:token - a respondent's private paid-report page (backend
 * survey/pulseReports.service.js). Opens right after they answer:
 *   generating → "writing your report" (polls)
 *   ready      → the teaser + "Unlock" (Stripe Checkout)
 *   failed     → "we'll follow up" (the owner was emailed)
 *   in_review  → paid, being finalized, with the deadline + debrief link
 *   released   → the full report + debrief link
 */
@Component( {
  selector: 'app-pulse-report',
  standalone: true,
  template: `
    <div class="pr">
      <header class="pr-top">
        <span class="pr-avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="pr-sender">
          <span class="pr-sender__name">{{ report()?.ownerName || '' }}</span>
          <span class="pr-sender__title">{{ report()?.surveyTitle || '' }}</span>
        </span>
      </header>
      <main class="pr-stage">
        @if (loadError()) {
          <div class="pr-card">
            <h1>{{ loadError() === 'not_found' ? "This report link isn't valid" : "Your report didn't load" }}</h1>
            <p class="pr-lede">{{ loadError() === 'not_found' ? 'Check the link in your email, or reply to that email and we will sort it out.' : 'Check your connection and refresh the page.' }}</p>
          </div>
        } @else {
          @if (report(); as r) {
          @switch (r.status) {
            @case ('generating') {
              <div class="pr-card">
                <span class="pr-spinner" aria-hidden="true"></span>
                <h1>Writing your report{{ r.firstName ? ', ' + r.firstName : '' }}…</h1>
                <p class="pr-lede">We're reading your answers now. This usually takes a minute or two. You can leave this page; we've emailed you a link to come back.</p>
              </div>
            }
            @case ('failed') {
              <div class="pr-card">
                <h1>Thanks{{ r.firstName ? ', ' + r.firstName : '' }}. We've got your answers.</h1>
                <p class="pr-lede">Your report needs a closer look before we can show it. {{ r.ownerName || 'We' }} will follow up by email.</p>
              </div>
            }
            @case ('ready') {
              <div class="pr-card pr-card--wide">
                <span class="pr-eyebrow">Your preview</span>
                <h1>{{ r.teaser?.headline }}</h1>
                <p class="pr-lede">{{ r.teaser?.summary }}</p>
                @if (r.teaser?.issues?.length) {
                  <h2 class="pr-h2">What we found</h2>
                  <ol class="pr-issues">
                    @for (issue of r.teaser!.issues; track $index) {
                      <li><span class="pr-sev" [attr.data-sev]="issue.severity">{{ issue.severity }}</span>{{ issue.title }}</li>
                    }
                  </ol>
                }
                <div class="pr-locked" aria-hidden="true">
                  <span></span><span></span><span></span><span></span>
                </div>
                <div class="pr-unlock">
                  <h2 class="pr-h2">Unlock the full report</h2>
                  <p>Every finding explained, a step-by-step action plan with owners and effort, quick wins for this week, and a 60-minute debrief call. A person reviews your report before you get it, within {{ r.turnaroundHours }} hours of payment.</p>
                  <button type="button" class="p-btn p-btn--primary p-btn--lg" (click)="unlock()" [disabled]="busy()">
                    {{ busy() ? 'Opening checkout…' : 'Unlock for $' + r.priceUsd }}
                  </button>
                  @if (actionError()) { <p class="pr-error" role="alert">{{ actionError() }}</p> }
                  <p class="pr-fine">{{ r.productName }}. Secure payment by Stripe.</p>
                </div>
              </div>
            }
            @case ('referred') {
              <div class="pr-card pr-card--wide">
                <span class="pr-eyebrow">Thanks{{ r.firstName ? ', ' + r.firstName : '' }}</span>
                <h1>{{ r.referral?.headline || 'Some places that can help' }}</h1>
                <p class="pr-lede">{{ r.referral?.message || "What you need is outside what we do, so here are providers near you. There's no charge for this." }}</p>
                @if (r.referral?.providers?.length) {
                  <ul class="pr-providers">
                    @for (p of providers(); track p.url) {
                      <li>
                        <a class="pr-provider" [href]="p.url" target="_blank" rel="noopener nofollow">
                          <span class="pr-provider__name">{{ p.name }}</span>
                          <span class="pr-provider__meta">{{ p.meta }}</span>
                          @if (p.description) { <span class="pr-provider__desc">{{ p.description }}</span> }
                        </a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="pr-lede">We couldn't pull up providers{{ r.referral?.postalCode ? ' near ' + r.referral!.postalCode : '' }} just now.</p>
                }
                <p class="pr-fine">Listings found with <a href="https://find.16ahead.com" target="_blank" rel="noopener">Find</a>. We don't get paid for these, and we haven't vetted them.</p>
              </div>
            }
            @case ('in_review') {
              <div class="pr-card">
                <span class="pr-eyebrow">Payment received</span>
                <h1>Your report is being finalized</h1>
                <p class="pr-lede">{{ r.ownerName || 'We' }} personally review{{ r.ownerName ? 's' : '' }} every report before it's released. You'll get an email with the link{{ dueLabel() ? ' by ' + dueLabel() : ' within ' + r.turnaroundHours + ' hours' }}.</p>
                @if (r.debriefUrl) { <a class="p-btn p-btn--primary p-btn--lg" [href]="r.debriefUrl" target="_blank" rel="noopener">Book your debrief</a> }
              </div>
            }
            @case ('released') {
              <article class="pr-card pr-card--wide pr-report">
                <span class="pr-eyebrow">{{ r.surveyTitle }}</span>
                <h1>{{ r.teaser?.headline }}</h1>
                <div class="pr-body" [innerHTML]="reportHtml()"></div>
                @if (r.debriefUrl) {
                  <div class="pr-unlock">
                    <h2 class="pr-h2">Your 60-minute debrief</h2>
                    <p>Bring your questions. We'll walk through the plan and what to do first.</p>
                    <a class="p-btn p-btn--primary p-btn--lg" [href]="r.debriefUrl" target="_blank" rel="noopener">Book your debrief</a>
                  </div>
                }
              </article>
            }
          }
          } @else {
            <span class="pr-spinner" aria-label="Loading"></span>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pr { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: var(--surface); color: var(--text); font-family: var(--font); }
    .pr-top { display: flex; align-items: center; gap: 12px; padding: 24px 40px; }
    .pr-avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--text); color: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
    .pr-sender { display: flex; flex-direction: column; min-width: 0; }
    .pr-sender__name { font-size: 16px; font-weight: 700; }
    .pr-sender__title { font-size: 17px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pr-stage { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 32px 16px 64px; }
    .pr-card { width: 100%; max-width: 640px; background: var(--bg); border-radius: 28px; padding: 48px 56px; box-shadow: 0 24px 60px rgba(0,0,0,.08); display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
    .pr-card--wide { max-width: 760px; }
    .pr-card h1 { margin: 0; font-size: 32px; line-height: 1.15; font-weight: 700; letter-spacing: -0.03em; }
    .pr-lede { margin: 0; font-size: 18px; line-height: 1.5; color: var(--muted); }
    .pr-eyebrow { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--blue-ink); }
    .pr-h2 { margin: 16px 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .pr-issues { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .pr-issues li { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 600; padding: 14px 16px; border-radius: 16px; background: var(--surface); }
    .pr-sev { flex: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px; border-radius: 999px; background: var(--t-yellow); color: var(--t-yellow-fg); }
    .pr-sev[data-sev="critical"] { background: var(--t-pink); color: var(--t-pink-fg); }
    .pr-sev[data-sev="high"] { background: var(--t-violet); color: var(--t-violet-fg); }
    .pr-locked { width: 100%; display: flex; flex-direction: column; gap: 10px; padding: 8px 0; filter: blur(1px); opacity: .7; }
    .pr-locked span { height: 12px; border-radius: 6px; background: var(--surface2); }
    .pr-locked span:nth-child(2) { width: 92%; } .pr-locked span:nth-child(3) { width: 80%; } .pr-locked span:nth-child(4) { width: 60%; }
    .pr-unlock { width: 100%; border-top: 1px solid var(--surface2); padding-top: 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
    .pr-unlock p { margin: 0; font-size: 16px; line-height: 1.5; color: var(--muted); }
    .pr-fine { font-size: 13px !important; }
    .pr-error { color: var(--t-pink-fg) !important; font-weight: 600; }
    .pr-body { width: 100%; font-size: 17px; line-height: 1.6; }
    .pr-body ::ng-deep h2 { font-size: 22px; margin: 28px 0 8px; letter-spacing: -0.02em; }
    .pr-body ::ng-deep h3 { font-size: 18px; margin: 20px 0 6px; }
    .pr-body ::ng-deep p { margin: 0 0 12px; }
    .pr-body ::ng-deep ul, .pr-body ::ng-deep ol { margin: 0 0 12px; padding-left: 22px; }
    .pr-body ::ng-deep li { margin: 0 0 6px; }
    .pr-providers { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 10px; }
    .pr-provider { display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 16px; background: var(--surface); color: var(--text); text-decoration: none; }
    .pr-provider:hover { background: var(--surface2); }
    .pr-provider__name { font-size: 17px; font-weight: 700; }
    .pr-provider__meta { font-size: 14px; color: var(--muted); }
    .pr-provider__desc { font-size: 15px; line-height: 1.45; color: var(--muted); }
    .pr-fine { margin: 0; font-size: 13px; color: var(--muted); }
    .pr-fine a { color: var(--blue-ink); }
    .pr-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface2); border-top-color: var(--blue); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 640px) {
      .pr-top { padding: 16px; }
      .pr-stage { padding: 8px 0 0; }
      .pr-card { border-radius: 24px 24px 0 0; padding: 32px 20px 48px; box-shadow: none; min-height: calc(100dvh - 80px); }
      .pr-card h1 { font-size: 26px; }
    }
  `],
} )
export class PulseReportComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly api = inject( SurveyApiService );

  readonly report = signal<PulseReportPublic | null>( null );
  readonly loadError = signal<'' | 'not_found' | 'failed'>( '' );
  readonly busy = signal( false );
  readonly actionError = signal( '' );

  readonly initials = computed( () => ( this.report()?.ownerName || '' ).split( /\s+/ ).filter( Boolean ).slice( 0, 2 ).map( ( w ) => w[0].toUpperCase() ).join( '' ) );
  readonly providers = computed<( PulseReferralProvider & { meta: string; } )[]>( () =>
    ( this.report()?.referral?.providers || [] ).map( ( p ) => ( { ...p, meta: [p.rating, p.phone, p.address || p.displayUrl].filter( Boolean ).join( ' · ' ) } ) ) );
  readonly reportHtml = computed( () => renderReportMarkdown( this.report()?.reportMarkdown || '' ) );
  readonly dueLabel = computed( () => {
    const due = this.report()?.dueAt;
    if ( !due ) return '';
    const date = new Date( due );
    return Number.isNaN( date.getTime() ) ? '' : date.toLocaleString( undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } );
  } );

  private readonly token = this.route.snapshot.paramMap.get( 'token' ) || '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor () {
    inject( DestroyRef ).onDestroy( () => this.timer && clearTimeout( this.timer ) );
  }

  ngOnInit (): void {
    void this.load();
  }

  private async load (): Promise<void> {
    try {
      const report = await firstValueFrom( this.api.getPublicReport( this.token ) );
      this.report.set( report );
      this.loadError.set( '' );
      // Keep checking while it's being written, and while paid-but-unreleased
      // (slowly) so a release shows without a refresh.
      if ( report.status === 'generating' ) this.schedule( 4000 );
      else if ( report.status === 'in_review' ) this.schedule( 60000 );
    } catch ( error ) {
      if ( ( error as HttpErrorResponse )?.status === 404 ) {
        this.loadError.set( 'not_found' );
        return;
      }
      if ( !this.report() ) this.loadError.set( 'failed' );
      this.schedule( 10000 );
    }
  }

  private schedule ( ms: number ): void {
    if ( this.timer ) clearTimeout( this.timer );
    this.timer = setTimeout( () => void this.load(), ms );
  }

  async unlock (): Promise<void> {
    this.busy.set( true );
    this.actionError.set( '' );
    try {
      const { checkoutUrl } = await firstValueFrom( this.api.startReportCheckout( this.token ) );
      window.location.href = checkoutUrl;
    } catch ( error ) {
      const code = ( error as HttpErrorResponse )?.error?.code;
      if ( code === 'REPORT_ALREADY_PAID' ) {
        await this.load();
      } else {
        this.actionError.set( "Checkout didn't open. Try again in a moment." );
      }
      this.busy.set( false );
    }
  }
}
