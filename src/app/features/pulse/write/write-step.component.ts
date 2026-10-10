import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SurveyQuestion, SurveyQuestionType, ToddSuggestion } from '../../../models/survey.model';
import { PulseAssistantSignalService } from '../../../services/pulse-assistant-signal.service';
import { PulseNotificationService } from '../../../services/pulse-notification.service';
import { SurveyApiService } from '../../../services/survey-api.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PulseBarComponent } from '../shell/pulse-bar.component';
import { PulseStore } from '../pulse.store';
import {
  BUILDER_TYPES,
  QuestionTypeMeta,
  blankQuestion,
  isQuestionComplete,
  newQuestionId,
  publishBlockers,
  pulseStatus,
  timeAgo,
  typeMeta,
  usesOptions,
} from '../pulse-state';
import { QuestionPreviewComponent } from './question-preview.component';

const REVIEW_DELAY_MS = 3000;

/**
 * Step 1, Write (1c). Everything autosaves through PulseStore; there is no
 * Save button. One question is open at a time. TODD reviews the questions a
 * few seconds after the last edit and offers one-tap fixes.
 *
 * A live or closed pulse is read-only here: changing questions people are
 * answering would split the results, so it says to move it back to draft.
 */
@Component( {
  selector: 'app-write-step',
  standalone: true,
  imports: [PulseBarComponent, IconComponent, QuestionPreviewComponent],
  templateUrl: './write-step.component.html',
  styleUrl: './write-step.component.css',
} )
export class WriteStepComponent implements OnInit {
  readonly store = inject( PulseStore );
  private readonly api = inject( SurveyApiService );
  private readonly router = inject( Router );
  private readonly notifications = inject( PulseNotificationService );
  private readonly assistant = inject( PulseAssistantSignalService );
  private readonly destroyRef = inject( DestroyRef );

  readonly builderTypes = BUILDER_TYPES;
  readonly typeMeta = typeMeta;
  readonly usesOptions = usesOptions;

  readonly survey = computed( () => this.store.survey()! );
  readonly questions = computed( () => this.survey().questions || [] );
  readonly readOnly = computed( () => pulseStatus( this.survey() ) !== 'draft' );
  readonly blockers = computed( () => publishBlockers( this.survey() ) );
  readonly selectedId = signal<string | null>( null );
  readonly selectedIndex = computed( () => {
    const index = this.questions().findIndex( ( question ) => question.id === this.selectedId() );
    return index >= 0 ? index : 0;
  } );
  readonly previewQuestion = computed( () => this.questions()[this.selectedIndex()] || null );

  readonly now = signal( new Date() );
  readonly subtitle = computed( () => {
    const status = pulseStatus( this.survey() );
    if ( status === 'live' ) return 'Live · taking answers';
    if ( status === 'closed' ) return 'Closed';
    switch ( this.store.saveState() ) {
      case 'saving': return 'Draft · saving…';
      case 'error': return "Draft · couldn't save";
      case 'conflict': return 'Draft · changed on another device';
      case 'saved': return `Draft · saved ${timeAgo( this.store.savedAt()?.toISOString(), this.now() )}`;
      default: return 'Draft';
    }
  } );

  // TODD's review
  readonly review = signal<ToddSuggestion[]>( [] );
  readonly reviewState = signal<'idle' | 'loading' | 'ready' | 'error'>( 'idle' );
  private readonly dismissed = signal<Set<string>>( new Set() );
  readonly visibleSuggestions = computed( () => this.review().filter( ( s ) => !this.dismissed().has( s.id ) ) );
  private reviewTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReviewedKey = '';

  // Drag to reorder
  readonly dragIndex = signal<number | null>( null );
  readonly dropIndex = signal<number | null>( null );

  constructor () {
    const clock = setInterval( () => this.now.set( new Date() ), 30000 );
    this.destroyRef.onDestroy( () => {
      clearInterval( clock );
      if ( this.reviewTimer ) clearTimeout( this.reviewTimer );
      this.assistant.clearPageContext();
    } );

    // Review a few seconds after the questions settle.
    effect( () => {
      const survey = this.store.survey();
      if ( !survey || this.readOnly() || !survey.questions.some( isQuestionComplete ) ) return;
      const key = JSON.stringify( [survey.title, survey.description, survey.questions.map( ( q ) => [q.id, q.questionText, q.questionType, q.options] )] );
      if ( key === this.lastReviewedKey ) return;
      untracked( () => this.scheduleReview( key ) );
    } );
  }

  ngOnInit (): void {
    const first = this.questions()[0];
    this.selectedId.set( this.questions().find( ( q ) => !isQuestionComplete( q ) )?.id || first?.id || null );
    this.dismissed.set( this.loadDismissed() );
    this.assistant.setPageContext( {
      feature: 'pulse',
      page: 'write',
      mode: 'edit',
      title: this.survey().title,
      selectedEntityType: 'survey',
      selectedEntityId: this.survey().id,
      summary: { questions: this.questions().length },
    } );
  }

  // ── Editing ──────────────────────────────────────────────────────────────

  setTitle ( value: string ): void {
    this.store.patch( ( draft ) => { draft.title = value; } );
  }

  setDescription ( value: string ): void {
    this.store.patch( ( draft ) => { draft.description = value; } );
  }

  select ( id: string | undefined ): void {
    this.selectedId.set( this.selectedId() === id ? null : id || null );
  }

  editQuestion ( id: string | undefined, edit: ( question: SurveyQuestion ) => void ): void {
    this.store.patch( ( draft ) => {
      const question = draft.questions.find( ( q ) => q.id === id );
      if ( question ) edit( question );
    } );
  }

  setQuestionText ( id: string | undefined, value: string ): void {
    this.editQuestion( id, ( q ) => { q.questionText = value; } );
  }

  setType ( id: string | undefined, type: SurveyQuestionType ): void {
    this.editQuestion( id, ( q ) => {
      q.questionType = type;
      if ( usesOptions( type ) && ( q.options || [] ).length < 2 ) {
        q.options = [...( q.options || [] ), '', ''].slice( 0, Math.max( 2, ( q.options || [] ).length ) );
      }
    } );
  }

  /** The type chips: the builder's six, plus a legacy type the question already uses. */
  chipsFor ( question: SurveyQuestion ): QuestionTypeMeta[] {
    const isBuilderType = BUILDER_TYPES.some( ( t ) => t.type === question.questionType );
    return isBuilderType ? BUILDER_TYPES : [...BUILDER_TYPES, typeMeta( question.questionType )];
  }

  setOption ( id: string | undefined, index: number, value: string ): void {
    this.editQuestion( id, ( q ) => { q.options[index] = value; } );
  }

  addOption ( id: string | undefined ): void {
    this.editQuestion( id, ( q ) => { q.options = [...( q.options || [] ), '']; } );
    setTimeout( () => {
      const inputs = document.querySelectorAll<HTMLInputElement>( `[data-options-for="${id}"] input` );
      inputs[inputs.length - 1]?.focus();
    } );
  }

  removeOption ( id: string | undefined, index: number ): void {
    this.editQuestion( id, ( q ) => { q.options = q.options.filter( ( _, i ) => i !== index ); } );
  }

  toggleRequired ( id: string | undefined ): void {
    this.editQuestion( id, ( q ) => { q.required = !q.required; } );
  }

  addQuestion (): void {
    const question = blankQuestion();
    this.store.patch( ( draft ) => { draft.questions = [...draft.questions, question]; } );
    this.selectedId.set( question.id! );
    setTimeout( () => document.querySelector<HTMLInputElement>( `[data-question-input="${question.id}"]` )?.focus() );
  }

  duplicate ( id: string | undefined ): void {
    const copy = { ...structuredClone( this.questions().find( ( q ) => q.id === id )! ), id: newQuestionId() };
    this.store.patch( ( draft ) => {
      const index = draft.questions.findIndex( ( q ) => q.id === id );
      draft.questions.splice( index + 1, 0, copy );
    } );
    this.selectedId.set( copy.id );
  }

  remove ( id: string | undefined ): void {
    const hasAnswers = ( this.survey().responseCount || 0 ) > 0;
    if ( hasAnswers && !confirm( 'Answers to this question will stop showing in Results. Delete it?' ) ) return;
    const index = this.questions().findIndex( ( q ) => q.id === id );
    this.store.patch( ( draft ) => { draft.questions = draft.questions.filter( ( q ) => q.id !== id ); } );
    const next = this.questions()[Math.min( index, this.questions().length - 1 )];
    this.selectedId.set( next?.id || null );
  }

  move ( from: number, to: number ): void {
    if ( to < 0 || to >= this.questions().length || from === to ) return;
    this.store.patch( ( draft ) => {
      const [question] = draft.questions.splice( from, 1 );
      draft.questions.splice( to, 0, question );
    } );
  }

  onDragStart ( event: DragEvent, index: number ): void {
    this.dragIndex.set( index );
    event.dataTransfer?.setData( 'text/plain', String( index ) );
    if ( event.dataTransfer ) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver ( event: DragEvent, index: number ): void {
    if ( this.dragIndex() === null ) return;
    event.preventDefault();
    this.dropIndex.set( index );
  }

  onDrop ( event: DragEvent, index: number ): void {
    event.preventDefault();
    const from = this.dragIndex();
    this.dragIndex.set( null );
    this.dropIndex.set( null );
    if ( from !== null ) this.move( from, index );
  }

  onDragEnd (): void {
    this.dragIndex.set( null );
    this.dropIndex.set( null );
  }

  // ── Header actions ───────────────────────────────────────────────────────

  async tryIt (): Promise<void> {
    const id = this.survey().id!;
    const tab = window.open( '', '_blank' );
    await this.store.flush();
    const url = this.router.serializeUrl( this.router.createUrlTree( ['/take', id], { queryParams: { preview: 1 } } ) );
    if ( tab ) tab.location.href = url; else window.location.href = url;
    this.api.markTried( id ).subscribe( { next: ( survey ) => this.store.replace( { ...this.survey(), triedAt: survey.triedAt } ), error: () => undefined } );
  }

  async next (): Promise<void> {
    if ( this.blockers().length ) return;
    if ( !( await this.store.flush() ) ) {
      this.notifications.show( "Couldn't save", 'Your last change didn’t save. Try again before sharing.', 'error' );
      return;
    }
    await this.router.navigate( ['/survey', this.survey().id, 'share'] );
  }

  async backToDraft (): Promise<void> {
    try {
      const survey = await firstValueFrom( this.api.unpublishSurvey( this.survey().id! ) );
      this.store.replace( { ...this.survey(), ...survey } );
    } catch {
      this.notifications.show( "Couldn't move it to draft", 'Try again in a moment.', 'error' );
    }
  }

  async deletePulse (): Promise<void> {
    const answers = this.survey().responseCount || 0;
    const message = answers ? `Delete this pulse and its ${answers} answers? This can't be undone.` : "Delete this pulse? This can't be undone.";
    if ( !confirm( message ) ) return;
    try {
      await firstValueFrom( this.api.deleteSurvey( this.survey().id! ) );
      await this.router.navigate( ['/app'] );
    } catch {
      this.notifications.show( "Couldn't delete it", 'Try again in a moment.', 'error' );
    }
  }

  // ── TODD's review ────────────────────────────────────────────────────────

  private scheduleReview ( key: string ): void {
    if ( this.reviewTimer ) clearTimeout( this.reviewTimer );
    this.reviewTimer = setTimeout( () => void this.runReview( key ), REVIEW_DELAY_MS );
  }

  private async runReview ( key: string ): Promise<void> {
    const survey = this.store.survey();
    if ( !survey?.id ) return;
    this.lastReviewedKey = key;
    this.reviewState.set( 'loading' );
    try {
      const result = await firstValueFrom( this.api.reviewWithTodd( survey.id, {
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
      } ) );
      this.review.set( result.suggestions || [] );
      this.reviewState.set( 'ready' );
    } catch {
      this.reviewState.set( 'error' );
    }
  }

  apply ( suggestion: ToddSuggestion ): void {
    const fix = suggestion.question;
    if ( suggestion.action === 'remove' ) {
      this.store.patch( ( draft ) => { draft.questions = draft.questions.filter( ( q ) => q.id !== suggestion.questionId ); } );
    } else if ( suggestion.action === 'add' && fix ) {
      const question: SurveyQuestion = { ...blankQuestion( fix.questionType as SurveyQuestionType ), questionText: fix.questionText, options: [...fix.options] };
      this.store.patch( ( draft ) => { draft.questions = [...draft.questions, question]; } );
      this.selectedId.set( question.id! );
    } else if ( fix ) {
      this.editQuestion( suggestion.questionId || undefined, ( q ) => {
        q.questionText = fix.questionText;
        q.questionType = fix.questionType;
        q.options = [...fix.options];
      } );
      this.selectedId.set( suggestion.questionId );
    }
    this.review.update( ( list ) => list.filter( ( s ) => s.id !== suggestion.id ) );
  }

  dismiss ( suggestion: ToddSuggestion ): void {
    const next = new Set( this.dismissed() );
    next.add( suggestion.id );
    this.dismissed.set( next );
    try { localStorage.setItem( this.dismissedKey(), JSON.stringify( [...next].slice( -50 ) ) ); } catch { }
  }

  private dismissedKey (): string {
    return `pulse-review-dismissed-${this.survey().id}`;
  }

  private loadDismissed (): Set<string> {
    try { return new Set( JSON.parse( localStorage.getItem( this.dismissedKey() ) || '[]' ) as string[] ); } catch { return new Set(); }
  }
}
