import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { Subscription } from 'rxjs';
import { PulseSurveyStateService } from '../../services/pulse-survey-state.service';
import { LoggerService } from '../../services/logger.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { TipService } from '../../services/tip.service';
import { PulseNotificationService } from '../../services/pulse-notification.service';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';
import { Survey, SurveyQuestion } from '../../models/survey.model';
import { SurveyApiService } from '../../services/survey-api.service';
import { SoundService } from '../../services/sound.service';
import { PulsePageActionsService } from '../../services/pulse-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { PrimaryNavComponent } from '../../shared/primary-nav/primary-nav.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

/**
 * Trimmed port of the monorepo's
 * features/survey/survey-add/survey-add.component.ts (534 lines) -
 * WITHOUT AI-assist, per the plan's explicit v2-deferral decision. Dropped
 * `OpenAIService`, `generateSurvey()`, the `survey-add-generate` page
 * action, and the `generate_survey` engagement-action case - the original
 * template never rendered an AI-assist button directly (that action only
 * ever surfaced through the page-actions bar, which is a no-op stub here
 * anyway), so nothing else needed to change to remove the feature.
 *
 * Also dropped the dead DiagnosticComponent @ViewChild (never rendered in
 * the template, same call made throughout this extraction) and
 * `environment.VERSION`/`environment.topMenu` (undefined/unused here).
 * Auth/notification/assistant-bus/page-actions swapped for this app's
 * equivalents. Reactive-form survey builder (title/description/questions,
 * option add/remove, live preview) is otherwise unchanged.
 */
@Component( {
  selector: 'app-survey-add',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ToddTipComponent, BackToTopComponent, ClickSoundDirective, PrimaryNavComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './survey-add.component.html',
  styleUrl: './survey-add.component.css'
} )
export class SurveyAddComponent implements OnInit, OnDestroy {
  private engagementActionSubscription!: Subscription;
  private firebaseSubscription!: Subscription;

  surveyForm: FormGroup;
  private userSubscription!: Subscription;
  private userId!: string;
  editSurvey: Survey | null = null;
  isLoading: boolean = false;
  isMobile: boolean = false;
  companyName: string = environment.COMPANY_NAME;
  public uid!: string;

  private minLengthArrayValidator ( min: number ): ValidatorFn {
    return ( control: AbstractControl ): ValidationErrors | null => {
      const value = control.value;
      return Array.isArray( value ) && value.length >= min
        ? null
        : { minItems: { required: min, actual: Array.isArray( value ) ? value.length : 0 } };
    };
  }

  private optionsRequiredForMultipleChoiceValidator (): ValidatorFn {
    return ( control: AbstractControl ): ValidationErrors | null => {
      const questionGroup = control as FormGroup;
      const questionType = questionGroup.get( 'questionType' )?.value;
      const options = questionGroup.get( 'options' ) as FormArray | null;

      if ( !this.requiresOptions( questionType ) ) {
        return null;
      }

      const optionValues = ( options?.controls || [] )
        .map( optionControl => optionControl.value )
        .filter( option => typeof option === 'string' && option.trim().length > 0 );

      return optionValues.length > 0
        ? null
        : { multipleChoiceOptionsRequired: true };
    };
  }

  requiresOptions ( questionType: string | null | undefined ): boolean {
    return questionType === 'multiple_choice' || questionType === 'checkbox';
  }

  private hasAtLeastOneQuestion (): boolean {
    return this.questions.length > 0;
  }

  private getQuestionValidationMessage ( questionControl: FormGroup ): string {
    if ( questionControl.get( 'questionText' )?.invalid ) {
      return 'Each question must include question text.';
    }

    if ( questionControl.get( 'questionType' )?.invalid ) {
      return 'Each question must include a question type.';
    }

    if ( questionControl.errors?.['multipleChoiceOptionsRequired'] ) {
      return 'Multiple choice and checkbox questions must include at least one option.';
    }

    return 'Please complete all required question fields.';
  }

  private markQuestionsTouched (): void {
    this.questions.controls.forEach( questionControl => {
      questionControl.markAllAsTouched();
      const options = ( questionControl.get( 'options' ) as FormArray | null );
      options?.controls.forEach( optionControl => optionControl.markAsTouched() );
      questionControl.updateValueAndValidity();
    } );
  }

  private isQuestionsArrayValid (): boolean {
    this.questions.updateValueAndValidity();

    if ( !this.hasAtLeastOneQuestion() ) {
      this.questions.setErrors( { minItems: true } );
      return false;
    }

    const hasInvalidQuestion = this.questions.controls.some( questionControl => {
      questionControl.updateValueAndValidity();
      return questionControl.invalid;
    } );

    if ( hasInvalidQuestion ) {
      return false;
    }

    this.questions.setErrors( null );
    return true;
  }

  private validateSurveyBeforeSubmit (): boolean {
    this.surveyForm.markAllAsTouched();
    this.markQuestionsTouched();

    if ( !this.hasAtLeastOneQuestion() ) {
      this.questions.setErrors( { minItems: true } );
      this.notificationService.show( 'Question Required', 'Add at least one question before creating a Pulse.', 'warning' );
      this.publishPageContext();
      return false;
    }

    if ( !this.isQuestionsArrayValid() || this.surveyForm.invalid ) {
      const firstInvalidQuestion = this.questions.controls.find( questionControl => questionControl.invalid ) as FormGroup | undefined;
      const message = firstInvalidQuestion
        ? this.getQuestionValidationMessage( firstInvalidQuestion )
        : 'Please complete the required Pulse fields before saving.';

      this.notificationService.show( 'Form Incomplete', message, 'warning' );
      this.publishPageContext();
      return false;
    }

    return true;
  }

  surveyTipText: string = '';

  private hasAuthenticatedUser (): boolean {
    return !!this.uid && !!this.userId;
  }

  private showPulseCrudLoginNotice (): void {
    window.scrollTo( 0, 0 );
    this.notificationService.show(
      'Pulse requires sign-in',
      'You can explore Pulse freely. Sign in to create, view saved surveys, edit, or delete.',
      'warning'
    );
  }

  constructor ( private authService: PulseAuthService, private router: Router,
    private tipService: TipService,
    private notificationService: PulseNotificationService,
    private surveyApiService: SurveyApiService,
    private fb: FormBuilder,
    private surveyService: PulseSurveyStateService,
    private soundService: SoundService,
    private logger: LoggerService,
    private assistantBus: PulseAssistantSignalService,
    private pageActionsService: PulsePageActionsService ) {
    this.surveyForm = this.fb.group( {
      title: ['', [Validators.required]],
      description: ['', [Validators.required]],
      questions: this.fb.array( [], this.minLengthArrayValidator( 1 ) )
    } );
  }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;
      this.publishPageContext();
    } );

    this.editSurvey = this.surveyService.getSelectedSurvey() as Survey | null;
    this.checkEditSurvey();
    this.publishPageContext();
    this.bindEngagementActions();
    this.surveyTipText = this.tipService.getRandomTipText( 'surveys', 'survey' );

    this.firebaseSubscription = this.authService.getUser().subscribe( firebaseUser => {
      if ( firebaseUser ) {
        this.uid = firebaseUser.uid;
      } else {
        this.uid = '';
      }
      this.publishPageContext();
    } );

  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.firebaseSubscription ) this.firebaseSubscription.unsubscribe();
    if ( this.engagementActionSubscription ) this.engagementActionSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'survey-add' );
    this.assistantBus.clearPageContext();

  }

  toggleSelection () {
    this.soundService.playSound( "toggleOn" );
  }

  private publishPageContext (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'survey-add',
      context: {
        pageId: 'survey-add',
        feature: 'survey',
        entityType: 'survey',
        entityId: this.editSurvey?.id || '',
        mode: this.editSurvey?.id ? 'edit' : 'create',
        extra: {
          isAuthenticated: this.hasAuthenticatedUser(),
          interactionMode: this.hasAuthenticatedUser() ? 'member' : 'guest',
          questionCount: this.questions.length,
          isEditing: !!this.editSurvey?.id,
          hasUnsavedInput: this.hasUnsavedPulseInput(),
          hasTitle: !!this.surveyForm.get( 'title' )?.value,
          hasDescription: !!this.surveyForm.get( 'description' )?.value
        }
      },
      actions: this.buildPageActions()
    } );

    this.assistantBus.setPageContext( {
      feature: 'surveys',
      page: 'survey-add',
      route: this.router.url,
      mode: this.editSurvey?.id ? 'edit' : 'create',
      title: this.editSurvey?.id ? 'Edit Pulse' : 'Create Pulse',
      description: 'Build or edit a survey with questions and answer types.',
      allowedActions: [
        'save_survey',
        'add_question',
        'remove_question',
        'add_option',
        'remove_option'
      ],
      selectedEntityType: 'survey',
      selectedEntityId: this.editSurvey?.id || '',
      summary: {
        isAuthenticated: this.hasAuthenticatedUser(),
        interactionMode: this.hasAuthenticatedUser() ? 'member' : 'guest',
        hasTitle: !!this.surveyForm.get( 'title' )?.value,
        hasDescription: !!this.surveyForm.get( 'description' )?.value,
        questionCount: this.questions.length,
        isEditing: !!this.editSurvey?.id,
        hasUnsavedInput: this.hasUnsavedPulseInput()
      },
      dataPreview: {
        title: this.surveyForm.get( 'title' )?.value || '',
        description: this.surveyForm.get( 'description' )?.value || ''
      }
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'survey-add-question',
        label: 'Add Question',
        icon: 'fa-solid fa-circle-plus',
        title: 'Add another question to this Pulse.',
        kind: 'callback',
        group: 'context',
        order: 20,
        disabled: () => this.isLoading,
        handler: () => this.addQuestion()
      },
      {
        id: 'survey-add-save',
        label: this.editSurvey?.id ? 'Update Pulse' : 'Create Pulse',
        icon: 'fa-solid fa-floppy-disk',
        title: this.editSurvey?.id ? 'Update this Pulse.' : 'Create this Pulse.',
        kind: 'callback',
        group: 'context',
        order: 30,
        disabled: () => this.isLoading,
        handler: () => this.submitSurvey()
      },
      {
        id: 'survey-add-login',
        label: 'Sign In to Save',
        icon: 'fa-solid fa-right-to-bracket',
        title: 'Sign in to save this Pulse.',
        kind: 'callback',
        group: 'context',
        order: 40,
        visible: () => !this.uid && this.hasUnsavedPulseInput(),
        handler: () => this.goToLoginForPulse()
      },
      {
        id: 'survey-add-help',
        label: 'Help',
        icon: 'fa-solid fa-question',
        kind: 'route',
        group: 'context',
        order: 50,
        route: '/help',
        fragment: 'survey-add'
      },
    ];
  }

  private emitAssistantActivity ( action: string, meta?: Record<string, any> ): void {
    this.assistantBus.emitAssistantActivity( {
      feature: 'surveys',
      page: 'survey-add',
      route: this.router.url,
      mode: this.editSurvey?.id ? 'edit' : 'create',
      action,
      summary: {
        isAuthenticated: this.hasAuthenticatedUser(),
        interactionMode: this.hasAuthenticatedUser() ? 'member' : 'guest',
        hasTitle: !!this.surveyForm.get( 'title' )?.value,
        hasDescription: !!this.surveyForm.get( 'description' )?.value,
        questionCount: this.questions.length,
        isEditing: !!this.editSurvey?.id,
        hasUnsavedInput: this.hasUnsavedPulseInput()
      },
      meta
    } );
  }

  private bindEngagementActions (): void {
    this.engagementActionSubscription = this.assistantBus.engagementActionRequest$.subscribe( request => {
      if ( !request || this.router.url.split( '?' )[0] !== '/survey-add' ) {
        return;
      }
      // No engagement actions handled here - AI-assist ('generate_survey')
      // is deferred to v2, and it was the only action this page listened
      // for.
    } );
  }

  checkEditSurvey (): void {
    if ( this.editSurvey ) {
      this.logger.debug( "Survey to edit found", this.editSurvey );
      // We are in edit mode, load the survey data into the form
      this.setSurveyData( this.editSurvey );
      this.surveyService.clearSelectedSurvey();
    }
  }

  setSurveyData ( survey: Survey ): void {
    if ( !survey || !survey.questions || !Array.isArray( survey.questions ) ) {
      console.error( 'Invalid survey data or questions array is missing' );
      return;
    }

    ( this.surveyForm.get( 'questions' ) as FormArray ).clear();

    // Patch title and description
    this.surveyForm.patchValue( {
      title: survey.title || '',
      description: survey.description || ''
    } );

    const questionsFormArray = this.surveyForm.get( 'questions' ) as FormArray;
    survey.questions.forEach( ( question: SurveyQuestion ) => {
      questionsFormArray.push( this.createQuestionForm( question ) );
    } );
    this.publishPageContext();
  }

  private createQuestionForm ( question?: Partial<SurveyQuestion> ): FormGroup {
    const options = this.fb.array( [] );

    if ( question?.options && Array.isArray( question.options ) ) {
      question.options.forEach( ( option: string ) => {
        options.push( this.fb.control( option, Validators.required ) );
      } );
    }

    return this.fb.group( {
      questionText: [question?.questionText || '', Validators.required],
      questionType: [question?.questionType || 'text', Validators.required],
      options
    }, {
      validators: [this.optionsRequiredForMultipleChoiceValidator()]
    } );
  }

  // Function to dynamically add a question
  addQuestion () {
    const questions = this.surveyForm.get( 'questions' ) as FormArray;
    questions.push( this.createQuestionForm() );
    questions.updateValueAndValidity();
    this.publishPageContext();
    this.emitAssistantActivity( 'question_added', {
      questionIndex: questions.length - 1
    } );
  }

  // Function to remove a question
  removeQuestion ( index: number ) {
    const questions = this.surveyForm.get( 'questions' ) as FormArray;
    questions.removeAt( index );
    questions.updateValueAndValidity();
    this.publishPageContext();
  }

  submitSurvey () {
    this.publishPageContext();
    this.emitAssistantActivity( 'survey_save_attempt' );
    if ( !this.hasAuthenticatedUser() ) {
      this.showPulseCrudLoginNotice();
      return;
    }
    if ( !this.validateSurveyBeforeSubmit() ) {
      this.logger.error( 'Form is invalid' );
      return;
    }

    const surveyData = this.buildSurveyPayload();

    if ( this.editSurvey && this.editSurvey.id ) {
      this.updateSurvey( surveyData );
    }
    else {
      this.addSurvey( surveyData );
    }
  }

  private buildSurveyPayload (): Survey {
    const formValue = this.surveyForm.value;
    const now = new Date().toISOString();

    return {
      ...this.editSurvey,
      title: formValue.title,
      description: formValue.description,
      questions: ( formValue.questions || [] ) as SurveyQuestion[],
      ownerId: this.userId,
      updatedAt: now,
      lastUpdated: now,
      ...( this.editSurvey?.createdAt ? {} : { createdAt: now } ),
      ...( this.editSurvey?.dateAdded ? {} : { dateAdded: now } )
    };
  }

  private applySavedSurveyState ( savedSurvey: Survey ): void {
    if ( !savedSurvey ) {
      return;
    }

    this.editSurvey = savedSurvey;
    this.setSurveyData( savedSurvey );
    this.surveyForm.markAsPristine();
    this.surveyForm.markAsUntouched();
    this.questions.controls.forEach( questionControl => {
      questionControl.markAsPristine();
      questionControl.markAsUntouched();
      const options = questionControl.get( 'options' ) as FormArray | null;
      options?.controls.forEach( optionControl => {
        optionControl.markAsPristine();
        optionControl.markAsUntouched();
      } );
    } );
  }

  addSurvey ( surveyData: Survey ) {
    if ( !this.hasAuthenticatedUser() ) {
      this.showPulseCrudLoginNotice();
      return;
    }

    const createPayload: Survey = {
      ...surveyData,
      status: surveyData.status || 'draft',
      visibility: surveyData.visibility || 'private'
    };

    this.surveyApiService.createSurvey( createPayload ).subscribe( {
      next: ( createdSurvey: Survey ) => {
        this.logger.log( 'Survey added', createdSurvey );
        this.applySavedSurveyState( createdSurvey );
        this.notificationService.show( 'Survey Added', 'Pulse saved. You can keep editing or update it anytime.', 'success' );
        this.publishPageContext();
        this.emitAssistantActivity( 'survey_saved', {
          surveyId: createdSurvey?.id || '',
          saveMode: 'create'
        } );
        if ( createdSurvey?.id ) {
          this.router.navigate( ['/survey', createdSurvey.id] );
        }
      },
      error: ( error ) => {
        this.logger.error( 'Error adding survey:', error );
        this.notificationService.show( 'Error', 'Error adding survey: ' + ( error?.error?.message || error?.message || 'Unknown error' ), 'error' );
        this.publishPageContext();
      }
    } );
  }

  updateSurvey ( surveyData: Survey ) {
    if ( !this.hasAuthenticatedUser() ) {
      this.showPulseCrudLoginNotice();
      return;
    }

    if ( !this.editSurvey?.id ) {
      this.logger.error( 'Cannot update survey without an id' );
      return;
    }

    this.surveyApiService.updateSurvey( this.editSurvey.id, surveyData ).subscribe( {
      next: ( updatedSurvey: Survey ) => {
        this.logger.log( 'Survey Updated', updatedSurvey );
        this.applySavedSurveyState( updatedSurvey );
        this.surveyService.clearSelectedSurvey();
        this.notificationService.show( 'Survey Updated', 'Pulse updated. Your changes are still on screen.', 'success' );
        this.publishPageContext();
        this.emitAssistantActivity( 'survey_saved', {
          surveyId: updatedSurvey?.id || '',
          saveMode: 'update'
        } );
        if ( updatedSurvey?.id ) {
          this.router.navigate( ['/survey', updatedSurvey.id] );
        }
      },
      error: ( error ) => {
        this.logger.error( 'Error updating survey:', error );
        this.notificationService.show( 'Error', 'Error updating survey: ' + ( error?.error?.message || error?.message || 'Unknown error' ), 'error' );
        this.surveyService.clearSelectedSurvey();
        this.publishPageContext();
      }
    } );
  }

  // Getter to make it easier to access the questions FormArray in the template
  get questions () {
    return this.surveyForm.get( 'questions' ) as FormArray;
  }

  // Function to dynamically add an option for a multiple-choice question
  addOption ( questionIndex: number ) {
    const options = this.getOptions( questionIndex );
    options.push( this.fb.control( '', Validators.required ) );
    const question = this.questions.at( questionIndex ) as FormGroup;
    question.updateValueAndValidity();
    this.publishPageContext();
  }

  // Function to remove a multiple-choice option
  removeOption ( questionIndex: number, optionIndex: number ) {
    const options = this.getOptions( questionIndex );
    options.removeAt( optionIndex );
    const question = this.questions.at( questionIndex ) as FormGroup;
    question.updateValueAndValidity();
    this.publishPageContext();
  }

  // Helper function to get the options FormArray for a specific question
  getOptions ( questionIndex: number ): FormArray {
    const questions = this.surveyForm.get( 'questions' ) as FormArray;
    const question = questions.at( questionIndex ) as FormGroup;

    // Ensure the 'options' array is initialized before trying to access it
    if ( !question.get( 'options' ) ) {
      question.setControl( 'options', this.fb.array( [] ) );
    }
    question.updateValueAndValidity();
    return question.get( 'options' ) as FormArray;
  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  hasUnsavedPulseInput (): boolean {
    const title = this.surveyForm.get( 'title' )?.value;
    const description = this.surveyForm.get( 'description' )?.value;
    const hasTitle = !!( title && title.toString().trim() );
    const hasDescription = !!( description && description.toString().trim() );
    const hasQuestions = Array.isArray( this.questions?.controls ) && this.questions.controls.length > 0;

    return hasTitle || hasDescription || hasQuestions;
  }

  goToLoginForPulse (): void {
    this.router.navigate( ['/login'], {
      queryParams: { returnUrl: this.router.url }
    } );
  }
}
