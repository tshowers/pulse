import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { QuestionResult, SurveyResults, ToddEmailDraft, ToddInsights } from '../../../models/survey.model';
import { PulseAssistantSignalService } from '../../../services/pulse-assistant-signal.service';
import { PulseNotificationService } from '../../../services/pulse-notification.service';
import { SurveyApiService, SurveyResponseRecord } from '../../../services/survey-api.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PulseBarComponent } from '../shell/pulse-bar.component';
import { PulseStore } from '../pulse.store';
import { plural, pulseLink, pulseStatus, shortDate, timeAgo } from '../pulse-state';
import { buildCsv } from './results-csv';

const THEME_TINTS = ['pink', 'yellow', 'green', 'cyan', 'violet'];

interface Bar { label: string; count: number; pct: number; color: string; }

/**
 * Step 3, Results (1f). TODD's summary and next move first, then every
 * question, all updating live (PulseStore polls; this refetches when the
 * answer count or the summary moves). Opening it resets the "N new" badge.
 */
@Component( {
  selector: 'app-results-step',
  standalone: true,
  imports: [PulseBarComponent, IconComponent],
  templateUrl: './results-step.component.html',
  styleUrl: './results-step.component.css',
} )
export class ResultsStepComponent implements OnInit {
  readonly store = inject( PulseStore );
  private readonly api = inject( SurveyApiService );
  private readonly notifications = inject( PulseNotificationService );
  private readonly assistant = inject( PulseAssistantSignalService );

  readonly survey = computed( () => this.store.survey()! );
  readonly status = computed( () => pulseStatus( this.survey() ) );
  readonly results = signal<SurveyResults | null>( null );
  readonly insights = signal<ToddInsights | null>( null );
  readonly loadFailed = signal( false );
  readonly now = signal( new Date() );

  readonly busy = signal<'email' | 'task' | 'idea' | 'refresh' | 'csv' | ''>( '' );
  readonly taskAdded = signal( false );
  readonly emailDraft = signal<ToddEmailDraft | null>( null );
  readonly themeFilter = signal<Record<string, string | null>>( {} );
  readonly expanded = signal<Record<string, boolean>>( {} );

  private responses: SurveyResponseRecord[] | null = null;

  readonly subtitle = computed( () => {
    const count = Math.max( this.survey().responseCount || 0, this.results()?.totalResponses || 0 );
    const today = this.results()?.last24h || 0;
    const label = { live: 'Live', closed: 'Closed', draft: 'Draft' }[this.status()];
    return [label, plural( count, 'answer' ), today ? `${today} today` : ''].filter( Boolean ).join( ' · ' );
  } );

  readonly hasSummary = computed( () => !!this.insights()?.summary );
  readonly sourceLine = computed( () => {
    const insights = this.insights();
    if ( !insights?.summary ) return '';
    const updated = insights.updatedAt ? `, updated ${timeAgo( insights.updatedAt, this.now() )}` : '';
    return `What TODD heard · from ${plural( insights.answerCount, 'answer' )}${updated}`;
  } );

  constructor () {
    const destroyRef = inject( DestroyRef );
    destroyRef.onDestroy( this.store.startPolling() );
    const clock = setInterval( () => this.now.set( new Date() ), 30000 );
    destroyRef.onDestroy( () => {
      clearInterval( clock );
      this.assistant.clearPageContext();
    } );

    // New answers or a new summary arrived: refetch what's on screen.
    effect( () => {
      if ( this.store.changes() === 0 ) return;
      untracked( () => void this.loadAll() );
    } );
  }

  ngOnInit (): void {
    void this.loadAll();
    this.api.markViewed( this.survey().id! ).subscribe( {
      next: () => this.store.replace( { ...this.survey(), newSinceViewed: 0 } ),
      error: () => undefined,
    } );
  }

  private async loadAll (): Promise<void> {
    const id = this.survey().id!;
    this.responses = null;
    try {
      const [results, insights] = await Promise.all( [
        firstValueFrom( this.api.getResults( id ) ),
        firstValueFrom( this.api.getInsights( id ) ),
      ] );
      this.results.set( results );
      this.insights.set( insights );
      this.loadFailed.set( false );
      this.assistant.setPageContext( {
        feature: 'pulse',
        page: 'results',
        mode: 'dashboard',
        title: this.survey().title,
        selectedEntityType: 'survey',
        selectedEntityId: id,
        summary: { answers: results.totalResponses, toddSummary: insights.summary, nextMove: insights.nextMove?.text },
      } );
    } catch {
      this.loadFailed.set( true );
    }
  }

  retry (): void {
    void this.loadAll();
  }

  // ── Question cards ───────────────────────────────────────────────────────

  numberOf ( question: QuestionResult ): number {
    return ( this.results()?.questions.indexOf( question ) ?? 0 ) + 1;
  }

  metaFor ( question: QuestionResult ): string {
    const base = plural( question.responseCount, 'answer' );
    return question.questionType === 'checkbox' ? `${base} · pick any` : base;
  }

  histogram ( question: QuestionResult ): { n: number; height: number; color: string; empty: boolean; }[] {
    const counts = question.histogram || new Array( 11 ).fill( 0 );
    const max = Math.max( 1, ...counts );
    return counts.map( ( value, n ) => ( {
      n,
      height: Math.max( 4, ( value / max ) * 72 ),
      color: n >= 9 ? 'var(--blue)' : n >= 7 ? 'var(--t-blue-fg)' : 'var(--muted)',
      empty: value === 0,
    } ) );
  }

  bars ( question: QuestionResult ): Bar[] {
    return ( question.options || [] ).map( ( option ) => ( { ...option, color: this.barColor( option.label ) } ) );
  }

  /** Yes reads green, "not sure" amber, no grey; everything else blue (1f). */
  private barColor ( label: string ): string {
    if ( /^yes\b/i.test( label ) ) return 'var(--t-green-fg)';
    if ( /not sure|maybe|unsure|don't know/i.test( label ) ) return 'var(--t-yellow-fg)';
    if ( /^no\b/i.test( label ) ) return 'var(--muted)';
    return 'var(--blue)';
  }

  tallyRows ( question: QuestionResult ): { label: string; count: number; }[] {
    return Object.entries( question.tally || {} )
      .map( ( [label, count] ) => ( { label, count } ) )
      .sort( ( a, b ) => b.count - a.count )
      .slice( 0, 8 );
  }

  themes ( question: QuestionResult ) {
    return ( this.insights()?.themesByQuestion?.[question.questionId] || [] ).map( ( theme, index ) => ( {
      ...theme,
      tint: THEME_TINTS[index % THEME_TINTS.length],
    } ) );
  }

  toggleTheme ( question: QuestionResult, label: string ): void {
    const current = this.themeFilter()[question.questionId];
    this.themeFilter.set( { ...this.themeFilter(), [question.questionId]: current === label ? null : label } );
  }

  quotes ( question: QuestionResult ) {
    let quotes = question.quotes || [];
    const theme = this.themeFilter()[question.questionId];
    if ( theme ) {
      const ids = new Set( this.themes( question ).find( ( t ) => t.label === theme )?.responseIds || [] );
      quotes = quotes.filter( ( quote ) => ids.has( quote.responseId ) );
    }
    return this.expanded()[question.questionId] ? quotes : quotes.slice( 0, 3 );
  }

  showAll ( question: QuestionResult ): void {
    this.expanded.set( { ...this.expanded(), [question.questionId]: !this.expanded()[question.questionId] } );
  }

  shortDate = shortDate;

  // ── Header actions ───────────────────────────────────────────────────────

  async copyLink (): Promise<void> {
    try {
      await navigator.clipboard.writeText( pulseLink( environment.PLATFORM_URL, this.survey().id! ) );
      this.notifications.show( 'Link copied', 'Paste it anywhere people will see it.', 'success' );
    } catch {
      this.notifications.show( "Couldn't copy", 'Long-press the link instead.', 'error' );
    }
  }

  async downloadCsv (): Promise<void> {
    this.busy.set( 'csv' );
    try {
      const responses = this.responses || await firstValueFrom( this.api.getSurveyResponses( this.survey().id! ) );
      this.responses = responses;
      const blob = new Blob( [buildCsv( this.survey(), responses )], { type: 'text/csv;charset=utf-8' } );
      const url = URL.createObjectURL( blob );
      const link = document.createElement( 'a' );
      link.href = url;
      link.download = `${( this.survey().title || 'pulse' ).replace( /[^\w\- ]+/g, '' ).trim() || 'pulse'}.csv`;
      link.click();
      setTimeout( () => URL.revokeObjectURL( url ), 1000 );
    } catch {
      this.notifications.show( "Couldn't download", 'Try again in a moment.', 'error' );
    } finally {
      this.busy.set( '' );
    }
  }

  // ── Next move ────────────────────────────────────────────────────────────

  can ( action: 'draft_email' | 'add_task' | 'another_idea' ): boolean {
    return !!this.insights()?.nextMove?.actions.includes( action );
  }

  async draftEmail (): Promise<void> {
    this.busy.set( 'email' );
    try {
      this.emailDraft.set( await firstValueFrom( this.api.draftNextMoveEmail( this.survey().id! ) ) );
    } catch ( error ) {
      this.notifications.show( "TODD couldn't draft it", this.messageOf( error, 'Try again in a moment.' ), 'error' );
    } finally {
      this.busy.set( '' );
    }
  }

  async copyEmail (): Promise<void> {
    const draft = this.emailDraft();
    if ( !draft ) return;
    try {
      await navigator.clipboard.writeText( `${draft.subject}\n\n${draft.body}` );
      this.notifications.show( 'Copied', 'The email is on your clipboard.', 'success' );
    } catch {
      this.notifications.show( "Couldn't copy", 'Select the text and copy it instead.', 'error' );
    }
  }

  async addTask (): Promise<void> {
    this.busy.set( 'task' );
    try {
      await firstValueFrom( this.api.addNextMoveTask( this.survey().id! ) );
      this.taskAdded.set( true );
      this.notifications.show( 'Added to your tasks', 'It’s in Moves, due in three days.', 'success' );
    } catch ( error ) {
      this.notifications.show( "Couldn't add it", this.messageOf( error, 'Try again in a moment.' ), 'error' );
    } finally {
      this.busy.set( '' );
    }
  }

  async anotherIdea (): Promise<void> {
    this.busy.set( 'idea' );
    try {
      this.insights.set( await firstValueFrom( this.api.anotherNextMove( this.survey().id! ) ) );
      this.taskAdded.set( false );
    } catch ( error ) {
      this.notifications.show( "TODD couldn't think of another", this.messageOf( error, 'Try again in a moment.' ), 'error' );
    } finally {
      this.busy.set( '' );
    }
  }

  async refreshSummary (): Promise<void> {
    this.busy.set( 'refresh' );
    try {
      this.insights.set( await firstValueFrom( this.api.refreshInsights( this.survey().id! ) ) );
    } catch ( error ) {
      this.notifications.show( "Couldn't update it", this.messageOf( error, 'Try again in a moment.' ), 'error' );
    } finally {
      this.busy.set( '' );
    }
  }

  private messageOf ( error: unknown, fallback: string ): string {
    return ( error as HttpErrorResponse )?.error?.error || fallback;
  }
}
