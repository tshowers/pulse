import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { PulseSignupDraft, PulseSignupDraftService, SURVEY_TEMPLATES, SurveyTemplate, WizardQuestionType } from '../../services/pulse-signup-draft.service';

type StepKey = 'purpose' | 'title' | 'question' | 'preview' | 'firstName' | 'lastName' | 'company' | 'signUp';

interface Step { key: StepKey; section: number; questionIndex?: number; }

/**
 * Pre-sign-in wizard - the web twin of pulse-ios's PreAuthSurveyBuilderView
 * (see ONBOARDING-PROFILE-BILLING-PLAYBOOK.md). One thing per screen under
 * a 4-segment progress bar whose first segment ("Start") is already done:
 * build a first survey, then name and company, then sign in. The draft is
 * saved after sign-in by PulseSignupDraftService.submitIfPending() in
 * AuthCallbackComponent. Returning users skip to /login.
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'answerInput' ) answerInput?: ElementRef<HTMLInputElement>;

  readonly sections = ['Start', 'Your survey', 'About you', 'Sign up'];
  readonly templates = SURVEY_TEMPLATES;
  readonly maxQuestions = 3;
  readonly questionTypes: Array<{ value: WizardQuestionType; label: string }> = [
    { value: 'multiple_choice', label: 'Multiple choice' },
    { value: 'rating', label: 'Rating' },
    { value: 'yes_no', label: 'Yes / No' },
  ];

  draft!: PulseSignupDraft;
  stepIndex = 0;
  isSigningIn = false;

  constructor (
    private readonly title: Title,
    private readonly authService: PulseAuthService,
    private readonly drafts: PulseSignupDraftService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started — Pulse | Taliferro Tech' );
    this.draft = this.drafts.load();
  }

  /** Steps depend on how many questions the survey has. */
  get steps (): Step[] {
    const questions = Math.max( 1, this.draft.survey.questions.length );
    return [
      { key: 'purpose', section: 1 },
      { key: 'title', section: 1 },
      ...Array.from( { length: questions }, ( _, i ) => ( { key: 'question' as StepKey, section: 1, questionIndex: i } ) ),
      { key: 'preview', section: 1 },
      { key: 'firstName', section: 2 },
      { key: 'lastName', section: 2 },
      { key: 'company', section: 2 },
      { key: 'signUp', section: 3 },
    ];
  }

  get step (): Step {
    return this.steps[Math.min( this.stepIndex, this.steps.length - 1 )];
  }

  get currentQuestion () {
    return this.draft.survey.questions[this.step.questionIndex ?? 0];
  }

  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'title': return !!this.draft.survey.title.trim() && !!( this.draft.survey.description || '' ).trim();
      case 'question': {
        const q = this.currentQuestion;
        if ( !q?.questionText.trim() ) return false;
        return q.questionType !== 'multiple_choice' || q.options.filter( ( o ) => o.trim() ).length >= 2;
      }
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      default: return true;
    }
  }

  chooseTemplate ( template: SurveyTemplate ): void {
    this.draft = this.drafts.fromTemplate( template, this.draft );
    this.persist();
  }

  setQuestionType ( type: WizardQuestionType ): void {
    const q = this.currentQuestion;
    q.questionType = type;
    if ( type === 'multiple_choice' && q.options.length < 2 ) q.options = ['Option 1', 'Option 2'];
    if ( type !== 'multiple_choice' ) q.options = [];
    this.persist();
  }

  addOption (): void {
    this.currentQuestion.options.push( '' );
    this.persist();
  }

  removeOption ( index: number ): void {
    this.currentQuestion.options.splice( index, 1 );
    this.persist();
  }

  trackIndex ( index: number ): number {
    return index;
  }

  addQuestion (): void {
    this.draft.survey.questions.push( { questionText: '', questionType: 'multiple_choice', options: ['Option 1', 'Option 2'] } );
    this.persist();
    this.stepIndex = this.steps.findIndex( ( s ) => s.key === 'question' && s.questionIndex === this.draft.survey.questions.length - 1 );
    this.focus();
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signUp' ) {
      this.draft.readyToSubmit = true;
    }
    this.persist();
    this.focus();
  }

  skip (): void {
    this.stepIndex++;
    if ( this.step.key === 'signUp' ) this.draft.readyToSubmit = true;
    this.persist();
  }

  back (): void {
    if ( this.stepIndex > 0 ) this.stepIndex--;
    this.focus();
  }

  persist (): void {
    this.drafts.save( this.draft );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( '/app' );
  }

  typeLabel ( type: string ): string {
    return this.questionTypes.find( ( t ) => t.value === type )?.label || type;
  }

  private focus (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }
}
