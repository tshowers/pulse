import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicSurvey, SurveyQuestion } from '../../models/survey.model';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { SurveyApiService } from '../../services/survey-api.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { typeMeta } from '../pulse/pulse-state';

type Phase = 'loading' | 'unavailable' | 'closed' | 'answer' | 'identity' | 'sending' | 'done' | 'already';
type Answer = string | number | string[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What someone sees after opening a pulse link (1g/1h on a phone, 2d/2e on a
 * computer): one question at a time, big targets, no account. Enter goes
 * next, Shift+Enter or ← goes back, number keys pick a score or an option.
 * When the owner asked for names, name and email come last.
 *
 * Preview (?preview=1) and the owner opening their own link both run the
 * whole flow with a "Preview · answers aren't saved" pill and save nothing.
 * One response per device (localStorage), as before.
 */
@Component( {
  selector: 'app-take-survey',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './take-survey.component.html',
  styleUrl: './take-survey.component.css',
} )
export class TakeSurveyComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly api = inject( SurveyApiService );
  private readonly auth = inject( PulseAuthService );

  readonly survey = signal<PublicSurvey | null>( null );
  readonly phase = signal<Phase>( 'loading' );
  readonly index = signal( 0 );
  readonly answers = signal<Record<string, Answer>>( {} );
  readonly name = signal( '' );
  readonly email = signal( '' );
  readonly error = signal( '' );
  readonly preview = signal( false );

  private surveyId = '';
  private postId = '';
  private digitBuffer = '';
  private digitTimer: ReturnType<typeof setTimeout> | null = null;

  readonly questions = computed( () => this.survey()?.questions || [] );
  readonly question = computed<SurveyQuestion | null>( () => this.questions()[this.index()] || null );
  readonly total = computed( () => this.questions().length + ( this.survey()?.collectIdentity ? 1 : 0 ) );
  readonly step = computed( () => this.phase() === 'identity' ? this.questions().length + 1 : this.index() + 1 );
  readonly progress = computed( () => ( this.step() / Math.max( 1, this.total() ) ) * 100 );
  readonly sender = computed( () => this.survey()?.ownerDisplay?.name || ( this.preview() ? 'Your business' : 'TODD Pulse' ) );
  readonly initials = computed( () => this.sender().split( /\s+/ ).filter( Boolean ).slice( 0, 2 ).map( ( w ) => w[0] ).join( '' ).toUpperCase() || 'P' );
  readonly duration = computed( () => {
    const minutes = Math.max( 1, Math.round( this.questions().length * 15 / 60 ) );
    return minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
  } );
  readonly isLast = computed( () => this.index() === this.questions().length - 1 );
  readonly kind = computed( () => {
    const type = this.question()?.questionType || 'text';
    if ( type === 'rating' ) return 'rating';
    if ( type === 'yes_no' ) return 'yes_no';
    if ( type === 'checkbox' ) return 'checkbox';
    if ( typeMeta( type ).usesOptions ) return 'choice';
    if ( type === 'textarea' ) return 'long';
    return 'short';
  } );
  readonly options = computed( () => {
    const question = this.question();
    if ( !question ) return [];
    if ( question.questionType === 'yes_no' ) return ['Yes', 'No'];
    return ( question.options || [] ).filter( ( option ) => option?.trim() );
  } );
  readonly value = computed( () => {
    const question = this.question();
    return question ? this.answers()[question.id || ''] : undefined;
  } );
  readonly canAdvance = computed( () => {
    const question = this.question();
    if ( !question ) return false;
    return !question.required || this.hasValue( this.value() );
  } );
  readonly identityValid = computed( () => !!this.name().trim() && EMAIL_PATTERN.test( this.email().trim() ) );
  readonly sent = computed( () => this.questions()
    .map( ( question ) => ( { question, value: this.answers()[question.id || ''] } ) )
    .filter( ( entry ) => this.hasValue( entry.value ) )
    .map( ( entry ) => ( { label: entry.question.questionText, value: this.display( entry.question, entry.value! ) } ) ) );

  readonly scale = Array.from( { length: 11 }, ( _, n ) => n );

  async ngOnInit (): Promise<void> {
    this.surveyId = this.route.snapshot.paramMap.get( 'id' ) || '';
    this.postId = this.route.snapshot.queryParamMap.get( 'p' ) || '';
    const previewRequested = this.route.snapshot.queryParamMap.get( 'preview' ) === '1';

    try {
      let survey: PublicSurvey | null;
      if ( previewRequested ) {
        survey = await firstValueFrom( this.api.getSurveyById( this.surveyId ) );
        this.preview.set( true );
      } else {
        survey = await firstValueFrom( this.api.getPublicSurveyById( this.surveyId ) );
        const uid = await this.currentUid();
        if ( survey && uid && survey.ownerId === uid ) this.preview.set( true );
      }
      if ( !survey ) {
        this.phase.set( 'unavailable' );
        return;
      }
      this.survey.set( survey );
      if ( !this.preview() && survey.status !== 'published' ) {
        this.phase.set( 'closed' );
      } else if ( !this.preview() && this.alreadyAnswered() ) {
        this.phase.set( 'already' );
      } else if ( !survey.questions?.length ) {
        this.phase.set( 'unavailable' );
      } else {
        this.phase.set( 'answer' );
      }
    } catch {
      this.phase.set( 'unavailable' );
    }
  }

  private async currentUid (): Promise<string> {
    try {
      const user = await firstValueFrom( this.auth.getUser() );
      return user?.uid || '';
    } catch {
      return '';
    }
  }

  // ── Answering ────────────────────────────────────────────────────────────

  set ( value: Answer ): void {
    const question = this.question();
    if ( !question ) return;
    this.answers.set( { ...this.answers(), [question.id || '']: value } );
  }

  toggle ( option: string ): void {
    const current = Array.isArray( this.value() ) ? this.value() as string[] : [];
    this.set( current.includes( option ) ? current.filter( ( o ) => o !== option ) : [...current, option] );
  }

  isChecked ( option: string ): boolean {
    const value = this.value();
    return Array.isArray( value ) ? value.includes( option ) : value === option;
  }

  pick ( option: string ): void {
    if ( this.kind() === 'checkbox' ) this.toggle( option ); else this.set( option );
  }

  next (): void {
    if ( this.phase() === 'identity' ) {
      void this.send();
      return;
    }
    if ( this.phase() !== 'answer' || !this.canAdvance() ) return;
    if ( !this.isLast() ) {
      this.index.update( ( i ) => i + 1 );
      this.focusAnswer();
    } else if ( this.survey()?.collectIdentity ) {
      this.phase.set( 'identity' );
      setTimeout( () => document.getElementById( 'ts-name' )?.focus() );
    } else {
      void this.send();
    }
  }

  back (): void {
    if ( this.phase() === 'identity' ) {
      this.phase.set( 'answer' );
      return;
    }
    if ( this.index() > 0 ) {
      this.index.update( ( i ) => i - 1 );
      this.focusAnswer();
    }
  }

  private focusAnswer (): void {
    setTimeout( () => document.querySelector<HTMLElement>( '.ts-answer input, .ts-answer textarea' )?.focus() );
  }

  async send (): Promise<void> {
    if ( this.phase() === 'identity' && !this.identityValid() ) {
      this.error.set( 'Add your name and a working email.' );
      return;
    }
    if ( this.preview() ) {
      this.phase.set( 'done' );
      return;
    }
    this.phase.set( 'sending' );
    this.error.set( '' );
    try {
      await firstValueFrom( this.api.submitPublicSurveyResponse( this.surveyId, {
        surveyId: this.surveyId,
        answers: this.answers(),
        ...( this.survey()?.collectIdentity ? { respondent: { name: this.name().trim(), email: this.email().trim() } } : {} ),
        submittedAt: new Date(),
      } ) );
      this.rememberAnswered();
      this.phase.set( 'done' );
    } catch ( error ) {
      const code = ( error as HttpErrorResponse )?.error?.code;
      if ( code === 'SURVEY_CLOSED' ) {
        this.phase.set( 'closed' );
        return;
      }
      this.phase.set( this.survey()?.collectIdentity ? 'identity' : 'answer' );
      this.error.set( code === 'SURVEY_OWNER_CANNOT_RESPOND'
        ? "You made this pulse, so you can try it but can't answer it."
        : ( error as HttpErrorResponse )?.error?.error || "Your answers didn't send. Check your connection and try again." );
    }
  }

  // ── One answer per device ────────────────────────────────────────────────

  private alreadyAnswered (): boolean {
    try {
      const survey = localStorage.getItem( `survey_${this.surveyId}_completed` );
      if ( this.postId ) return !!( survey && localStorage.getItem( `survey_${this.postId}_completed` ) );
      return !!survey;
    } catch {
      return false;
    }
  }

  private rememberAnswered (): void {
    try {
      localStorage.setItem( `survey_${this.surveyId}_completed`, 'true' );
      if ( this.postId ) localStorage.setItem( `survey_${this.postId}_completed`, 'true' );
    } catch { }
  }

  // ── Keyboard (2d) ────────────────────────────────────────────────────────

  @HostListener( 'document:keydown', ['$event'] )
  onKey ( event: KeyboardEvent ): void {
    if ( !['answer', 'identity'].includes( this.phase() ) || event.metaKey && event.key !== 'Enter' || event.ctrlKey && event.key !== 'Enter' || event.altKey ) return;
    const target = event.target as HTMLElement | null;
    const typing = !!target && ( target.tagName === 'TEXTAREA' || ( target.tagName === 'INPUT' && ( target as HTMLInputElement ).type !== 'radio' && ( target as HTMLInputElement ).type !== 'checkbox' ) );

    if ( event.key === 'Enter' ) {
      if ( target?.tagName === 'TEXTAREA' && !( event.metaKey || event.ctrlKey ) ) return;
      if ( target?.tagName === 'BUTTON' || target?.tagName === 'A' ) return;
      event.preventDefault();
      if ( event.shiftKey ) this.back(); else this.next();
      return;
    }
    if ( typing ) return;
    if ( event.key === 'ArrowLeft' ) {
      event.preventDefault();
      this.back();
      return;
    }
    if ( /^[0-9]$/.test( event.key ) && this.phase() === 'answer' ) {
      event.preventDefault();
      this.digit( event.key );
    }
  }

  /** 0-9 picks a score (1 then 0 quickly picks 10); 1-n picks an option. */
  private digit ( key: string ): void {
    if ( this.kind() === 'rating' ) {
      if ( this.digitBuffer === '1' && key === '0' ) {
        this.set( 10 );
        this.digitBuffer = '';
        return;
      }
      this.set( Number( key ) );
      this.digitBuffer = key;
      if ( this.digitTimer ) clearTimeout( this.digitTimer );
      this.digitTimer = setTimeout( () => { this.digitBuffer = ''; }, 600 );
      return;
    }
    const option = this.options()[Number( key ) - 1];
    if ( option && ['choice', 'checkbox', 'yes_no'].includes( this.kind() ) ) this.pick( option );
  }

  // ── Display ──────────────────────────────────────────────────────────────

  private hasValue ( value: Answer | undefined ): boolean {
    if ( Array.isArray( value ) ) return value.length > 0;
    return value !== undefined && value !== null && String( value ).trim() !== '';
  }

  private display ( question: SurveyQuestion, value: Answer ): string {
    if ( Array.isArray( value ) ) return value.join( ', ' );
    if ( question.questionType === 'rating' ) return `${value} out of 10`;
    return String( value );
  }

  inputType (): string {
    switch ( this.question()?.questionType ) {
      case 'email': return 'email';
      case 'number': return 'number';
      case 'date': return 'date';
      default: return 'text';
    }
  }

  textValue (): string {
    const value = this.value();
    return typeof value === 'string' || typeof value === 'number' ? String( value ) : '';
  }
}
