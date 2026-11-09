import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PulseReportOwner, PulseReportStatus, StructuredReport } from '../../../models/pulse-report.model';
import { SurveyApiService } from '../../../services/survey-api.service';
import { renderReportMarkdown } from '../../../shared/report-markdown';
import { PulseBarComponent } from '../shell/pulse-bar.component';
import { TechReportComponent } from '../../../shared/tech-report/tech-report.component';
import { buildReportView } from '../../../shared/tech-report/tech-report.view';
import { ReportEditorComponent } from './report-editor.component';
import { PulseStore } from '../pulse.store';

const STATUS_LABEL: Record<PulseReportStatus, string> = {
  generating: 'Writing',
  ready: 'Preview sent',
  failed: "Didn't generate",
  in_review: 'Paid · review',
  released: 'Released',
  referred: 'Referred (free)',
};

function dueSpan ( ms: number ): string {
  const hours = Math.round( Math.abs( ms ) / 3600000 );
  const span = hours >= 1 ? `${hours}h` : `${Math.max( 1, Math.round( Math.abs( ms ) / 60000 ) )}m`;
  return ms < 0 ? `${span} late` : `due in ${span}`;
}

function formatWhen ( iso: string | null | undefined ): string {
  if ( !iso ) return '';
  const date = new Date( iso );
  return Number.isNaN( date.getTime() ) ? '' : date.toLocaleString( undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } );
}

/**
 * /survey/:id/reports - the owner's review queue for a paid-report pulse
 * (backend survey/pulseReports.service.js). Paid reports waiting on review
 * come first, soonest deadline on top. Pick one to read, edit, and release;
 * releasing emails the respondent their private link.
 *
 * Structured reports (2026-11-09 redesign) are edited field by field
 * (report-editor) and previewed exactly as the client's page shows them;
 * older reports keep the Markdown editor.
 */
@Component( {
  selector: 'app-reports-step',
  standalone: true,
  imports: [PulseBarComponent, ReportEditorComponent, TechReportComponent],
  template: `
    <div class="p-page">
      <app-pulse-bar [survey]="store.survey()!" step="reports" [subtitle]="subtitle()" />
      @if (loadFailed() && !reports().length) {
        <div class="p-card rp-empty"><span>Reports didn't load.</span><button type="button" class="p-btn p-btn--bg" (click)="load()">Try again</button></div>
      } @else if (loaded() && !reports().length) {
        <div class="p-card rp-empty"><span>No reports yet. Each answer to this pulse gets its own report here.</span></div>
      } @else {
        <div class="rp">
          <ul class="rp-list" aria-label="Reports">
            @for (r of rows(); track r.token) {
              <li>
                <button type="button" class="rp-item" [class.is-on]="r.token === selectedToken()" (click)="select(r.token)">
                  <span class="rp-item__name">{{ r.respondent.name || r.respondent.email }}</span>
                  <span class="rp-item__meta">
                    <span class="rp-status" [attr.data-status]="r.status">{{ r.statusLabel }}</span>
                    @if (r.dueText) { <span [class.rp-late]="r.late">{{ r.dueText }}</span> }
                  </span>
                </button>
              </li>
            }
          </ul>
          @if (selected(); as r) {
            <section class="p-card rp-detail">
              <header class="rp-detail__head">
                <div>
                  <h2>{{ r.respondent.name || 'No name' }}</h2>
                  <a class="rp-muted" [href]="'mailto:' + r.respondent.email">{{ r.respondent.email }}</a>
                </div>
                <a class="p-btn p-btn--sm" [href]="r.publicUrl" target="_blank" rel="noopener">Their page</a>
              </header>
              @switch (r.status) {
                @case ('generating') { <p class="rp-muted">16Ahead is writing this report. It'll appear here in a minute or two.</p> }
                @case ('referred') {
                  <p class="rp-muted">Outside your work, so they got free providers from Find{{ r.referral?.postalCode ? ' near ' + r.referral!.postalCode : '' }} instead of a report. Their answers are in Results.</p>
                  @if (r.referral?.providers?.length) {
                    <ul class="rp-providers">
                      @for (p of r.referral!.providers; track p.url) { <li><a [href]="p.url" target="_blank" rel="noopener">{{ p.name }}</a></li> }
                    </ul>
                  } @else { <p class="rp-muted">Find returned no providers, so their page says to look elsewhere.</p> }
                }
                @case ('failed') {
                  <p class="rp-muted">This report didn't generate: {{ r.failureReason || 'unknown reason' }}. They were told you'll follow up.</p>
                  <button type="button" class="p-btn p-btn--primary" (click)="retry(r)" [disabled]="!!busy()">{{ busy() ? 'Retrying…' : 'Try again' }}</button>
                }
                @default {
                  <p class="rp-muted">
                    @switch (r.status) {
                      @case ('ready') { They have the preview and haven't paid yet. You can edit now; release opens after payment. }
                      @case ('in_review') { Paid {{ times().paid ? '· ' + times().paid : '' }}. Promised by {{ times().due }}. Review, edit if needed, then release. }
                      @case ('released') { Released {{ times().released }}. Edits you save now show on their page right away. }
                    }
                  </p>
                  <div class="rp-tabs" role="tablist">
                    <button type="button" role="tab" class="rp-tab" [class.is-on]="mode() === 'edit'" (click)="mode.set('edit')">Edit</button>
                    <button type="button" role="tab" class="rp-tab" [class.is-on]="mode() === 'preview'" (click)="mode.set('preview')">Preview</button>
                  </div>
                  @if (r.structured) {
                    @if (mode() === 'edit') {
                      <app-report-editor [report]="r.structured" (reportChange)="draftStructured.set($event)" />
                    } @else {
                      <app-tech-report [view]="previewView()" [embedded]="true" />
                    }
                  } @else if (mode() === 'edit') {
                    <textarea class="rp-editor" [value]="draft()" (input)="draft.set($any($event.target).value)" aria-label="Report"></textarea>
                  } @else {
                    <div class="rp-preview" [innerHTML]="previewHtml()"></div>
                  }
                  @if (actionError()) { <p class="rp-error" role="alert">{{ actionError() }}</p> }
                  <div class="rp-actions">
                    <button type="button" class="p-btn" (click)="save(r)" [disabled]="busy() || !dirty()">{{ busy() === 'save' ? 'Saving…' : dirty() ? 'Save changes' : 'Saved' }}</button>
                    @if (r.status === 'in_review') {
                      <button type="button" class="p-btn p-btn--primary" (click)="release(r)" [disabled]="!!busy()">{{ busy() === 'release' ? 'Releasing…' : dirty() ? 'Save and release' : 'Release to ' + (r.respondent.name || 'them').split(' ')[0] }}</button>
                    }
                  </div>
                }
              }
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .rp { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; margin-top: 24px; }
    .rp-empty { display: flex; align-items: center; gap: 16px; margin-top: 24px; padding: 24px; }
    .rp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .rp-item { width: 100%; text-align: left; border: 0; cursor: pointer; background: var(--surface); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; font: inherit; color: var(--text); }
    .rp-item.is-on { background: var(--t-blue); }
    .rp-item__name { font-weight: 700; font-size: 15px; }
    .rp-item__meta { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--muted); }
    .rp-status { font-weight: 700; font-size: 12px; padding: 3px 9px; border-radius: 999px; background: var(--surface2); color: var(--text); }
    .rp-status[data-status="in_review"] { background: var(--t-yellow); color: var(--t-yellow-fg); }
    .rp-status[data-status="released"] { background: var(--t-green); color: var(--t-green-fg); }
    .rp-status[data-status="failed"] { background: var(--t-pink); color: var(--t-pink-fg); }
    .rp-providers { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
    .rp-status[data-status="referred"] { background: var(--t-cyan); color: var(--t-cyan-fg); }
    .rp-late { color: var(--t-pink-fg); font-weight: 700; }
    .rp-detail { padding: 28px; display: flex; flex-direction: column; gap: 16px; }
    .rp-detail__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .rp-detail__head h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.02em; }
    .rp-muted { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
    .rp-tabs { display: flex; gap: 4px; }
    .rp-tab { border: 0; background: transparent; font: inherit; font-weight: 600; padding: 8px 14px; border-radius: 999px; cursor: pointer; color: var(--muted); }
    .rp-tab.is-on { background: var(--surface); color: var(--text); }
    .rp-editor { width: 100%; min-height: 520px; resize: vertical; border: 1px solid var(--surface2); border-radius: 16px; padding: 16px; font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg); color: var(--text); box-sizing: border-box; }
    .rp-preview { font-size: 16px; line-height: 1.6; }
    .rp-preview ::ng-deep h2 { font-size: 20px; margin: 24px 0 8px; }
    .rp-preview ::ng-deep h3 { font-size: 17px; margin: 16px 0 6px; }
    .rp-preview ::ng-deep p { margin: 0 0 10px; }
    .rp-preview ::ng-deep ul, .rp-preview ::ng-deep ol { margin: 0 0 10px; padding-left: 22px; }
    .rp-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .rp-error { margin: 0; color: var(--t-pink-fg); font-weight: 600; }
    @media (max-width: 860px) { .rp { grid-template-columns: 1fr; } }
  `],
} )
export class ReportsStepComponent implements OnInit {
  readonly store = inject( PulseStore );
  private readonly api = inject( SurveyApiService );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );

  readonly reports = signal<PulseReportOwner[]>( [] );
  readonly loaded = signal( false );
  readonly loadFailed = signal( false );
  readonly selectedToken = signal( '' );
  readonly draft = signal( '' );
  /** The structured report being edited (null for older Markdown reports). */
  readonly draftStructured = signal<StructuredReport | null>( null );
  readonly mode = signal<'edit' | 'preview'>( 'preview' );
  readonly busy = signal<'' | 'save' | 'release' | 'retry'>( '' );
  readonly actionError = signal( '' );
  readonly now = signal( Date.now() );

  /** List rows with their label and deadline worked out once per change. */
  readonly rows = computed( () => {
    const now = this.now();
    return this.reports().map( ( r ) => {
      const ms = r.status === 'in_review' && r.dueAt ? Date.parse( r.dueAt ) - now : NaN;
      return { ...r, statusLabel: STATUS_LABEL[r.status], late: ms < 0, dueText: Number.isNaN( ms ) ? '' : dueSpan( ms ) };
    } );
  } );
  readonly times = computed( () => {
    const r = this.selected();
    return { paid: formatWhen( r?.paidAt ), due: formatWhen( r?.dueAt ), released: formatWhen( r?.releasedAt ) };
  } );
  readonly selected = computed( () => this.reports().find( ( r ) => r.token === this.selectedToken() ) || null );
  readonly dirty = computed( () => {
    const r = this.selected();
    if ( !r ) return false;
    if ( r.structured ) return JSON.stringify( this.draftStructured() ) !== JSON.stringify( r.structured );
    return this.draft().trim() !== ( r.reportMarkdown || '' ).trim();
  } );
  readonly previewHtml = computed( () => renderReportMarkdown( this.draft() ) );
  /** The client's page, as it will look with the unsaved edits. */
  readonly previewView = computed( () => {
    const r = this.selected();
    const report = this.draftStructured();
    if ( !r || !report ) return null;
    return buildReportView( {
      mode: 'full', report, preview: null,
      cover: { preparedFor: r.respondent.name, preparedBy: r.ownerName || '', date: r.releasedAt || r.readyAt, reportId: r.reportId || '', ownerTagline: '', ownerWebsite: '' },
      ownerName: r.ownerName || '', productName: this.store.survey()?.title || '', priceUsd: r.priceUsd, turnaroundHours: 24,
    } );
  } );
  readonly subtitle = computed( () => {
    const waiting = this.reports().filter( ( r ) => r.status === 'in_review' ).length;
    return waiting ? `${waiting} paid report${waiting === 1 ? '' : 's'} to review` : `${this.reports().length} report${this.reports().length === 1 ? '' : 's'}`;
  } );

  private get surveyId (): string {
    return this.store.survey()?.id || '';
  }

  constructor () {
    const destroyRef = inject( DestroyRef );
    const refresh = setInterval( () => {
      this.now.set( Date.now() );
      if ( !this.dirty() ) void this.load( false );
    }, 60000 );
    destroyRef.onDestroy( () => clearInterval( refresh ) );
  }

  ngOnInit (): void {
    void this.load();
  }

  async load ( pickDefault = true ): Promise<void> {
    try {
      const reports = await firstValueFrom( this.api.listReports( this.surveyId ) );
      this.reports.set( reports );
      this.loaded.set( true );
      this.loadFailed.set( false );
      if ( pickDefault ) {
        const wanted = this.route.snapshot.queryParamMap.get( 'report' );
        const pick = reports.find( ( r ) => r.token === wanted ) || reports[0];
        if ( pick ) this.select( pick.token );
      } else if ( this.selected() && !this.dirty() ) {
        this.draft.set( this.selected()!.reportMarkdown );
        this.draftStructured.set( this.selected()!.structured || null );
      }
    } catch {
      this.loadFailed.set( true );
    }
  }

  select ( token: string ): void {
    const report = this.reports().find( ( r ) => r.token === token );
    if ( !report ) return;
    this.selectedToken.set( token );
    this.draft.set( report.reportMarkdown || '' );
    this.draftStructured.set( report.structured || null );
    this.mode.set( 'preview' );
    this.actionError.set( '' );
    void this.router.navigate( [], { relativeTo: this.route, queryParams: { report: token }, replaceUrl: true } );
  }


  private replace ( updated: PulseReportOwner ): void {
    this.reports.update( ( list ) => list.map( ( r ) => ( r.token === updated.token ? updated : r ) ) );
  }

  private errorText ( error: unknown, fallback: string ): string {
    return ( error as HttpErrorResponse )?.error?.message || fallback;
  }

  async save ( r: PulseReportOwner ): Promise<boolean> {
    this.busy.set( 'save' );
    this.actionError.set( '' );
    try {
      const structured = this.draftStructured();
      const change = r.structured && structured ? { structured } : { reportMarkdown: this.draft() };
      const updated = await firstValueFrom( this.api.updateReport( this.surveyId, r.token, change ) );
      this.replace( updated );
      this.draft.set( updated.reportMarkdown );
      this.draftStructured.set( updated.structured || null );
      return true;
    } catch ( error ) {
      this.actionError.set( this.errorText( error, "Your changes didn't save. Try again." ) );
      return false;
    } finally {
      this.busy.set( '' );
    }
  }

  async release ( r: PulseReportOwner ): Promise<void> {
    if ( this.dirty() && !( await this.save( r ) ) ) return;
    this.busy.set( 'release' );
    this.actionError.set( '' );
    try {
      this.replace( await firstValueFrom( this.api.releaseReport( this.surveyId, r.token ) ) );
    } catch ( error ) {
      this.actionError.set( this.errorText( error, "It didn't release. Try again." ) );
    } finally {
      this.busy.set( '' );
    }
  }

  async retry ( r: PulseReportOwner ): Promise<void> {
    this.busy.set( 'retry' );
    try {
      this.replace( await firstValueFrom( this.api.retryReport( this.surveyId, r.token ) ) );
      setTimeout( () => void this.load( false ), 90000 );
    } catch ( error ) {
      this.actionError.set( this.errorText( error, "Retry didn't start. Try again." ) );
    } finally {
      this.busy.set( '' );
    }
  }
}
