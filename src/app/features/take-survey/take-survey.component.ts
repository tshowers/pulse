import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { environment } from '../../../environments/environment';

import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { SectionJumpComponent, SectionJumpItem } from '../../shared/section-jump/section-jump.component';
import { LoggerService } from '../../services/logger.service';
import { PulseNotificationService } from '../../services/pulse-notification.service';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { Survey } from '../../models/survey.model';
import {
  SurveyApiService,
  PublicSurveyResponsePayload
} from '../../services/survey-api.service';

/**
 * Trimmed, near-verbatim port of the monorepo's
 * features/survey/take-survey/take-survey.component.ts (803 lines across
 * ts/html/css) - confirmed the cleanest component in the whole module, no
 * ToddAssistantBusService / PageActionsService / EntitlementService
 * coupling at all. Ported first to prove the pipeline at the lowest risk.
 *
 * Cut from the original: the TODD-branding header (logo linking to
 * monorepo's own `/home`, an `environment.VERSION` string this app's
 * environment doesn't define) - not meaningful outside the monorepo shell.
 * Also dropped the unused `DiagnosticComponent` @ViewChild/import and its
 * `toggleDiagnosticInChild()` method - the original never renders
 * `<app-diagnostic>` in its template and never calls that method either,
 * so it was dead code even in the monorepo.
 */
@Component( {
  selector: 'app-take-survey',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BackToTopComponent, SectionJumpComponent],
  templateUrl: './take-survey.component.html',
  styleUrl: './take-survey.component.css'
} )
export class TakeSurveyComponent implements OnInit, OnDestroy {
  companyName: string = environment.COMPANY_NAME;

  tenantId: string | null = null;
  private userSubscription!: Subscription;
  private tenantSubScription!: Subscription;
  surveyCompleted: boolean = false; // Flag to track survey completion
  isMobile: boolean = false;

  private countdownTime: number = 10; // Set the countdown time (in seconds)
  countdownDisplay: number = this.countdownTime;
  countdownInterval: any;
  postId!: string;


  private surveyId!: string;
  currentStep: number = 0;
  totalSteps: number = 5; //
  survey: Survey | null = null; // Holds the survey data
  surveySubscription!: Subscription;
  surveyForm: FormGroup; // Form
  private querySubscription!: Subscription;
  message!: string;
  displayedSteps: { index: number; }[] = [];
  previewMode = false;
  responseAlreadySubmitted = false;
  creatorPreviewMode = false;
  private currentUserId: string | null = null;
  loadErrorMessage = '';

  readonly anchorItems: SectionJumpItem[] = [
    { id: 'ts-questions', label: 'Survey Questions' },
    { id: 'ts-my-answers', label: 'My Answers Preview' },
  ];

  constructor ( private route: ActivatedRoute, private notificationService: PulseNotificationService, private router: Router, private surveyApiService: SurveyApiService, private fb: FormBuilder, private logger: LoggerService, private authService: PulseAuthService ) {

    this.surveyForm = this.fb.group( {
      responses: this.fb.array( [] ) // Array to hold the responses
    } );
  }

  ngOnInit (): void {
    this.setup();
  }

  ngOnDestroy (): void {
    if ( this.userSubscription )
      this.userSubscription.unsubscribe();
    if ( this.tenantSubScription )
      this.tenantSubScription.unsubscribe();
    if ( this.querySubscription )
      this.querySubscription.unsubscribe();
    if ( this.countdownInterval ) {
      clearInterval( this.countdownInterval );
    }
  }

  setup () {
    try {
      this.updateVisibleSteps();
      this.surveyId = this.route.snapshot.paramMap.get( 'id' ) as string;
      this.currentUserId = this.authService.getCurrentUserIdSync();
      this.logger.log( "Survey ID is", this.surveyId );

      this.querySubscription = this.route.queryParams.subscribe( params => {
        const hashedTenantId = params['t'];
        const postId = params['p']; // Get the post ID from the query parameter
        this.previewMode = params['preview'] === '1';

        this.tenantId = hashedTenantId ? this.tryDecodeTenantId( hashedTenantId ) : null;
        this.logger.log( "No tenant ID Check query String, this is converted tenantID", this.tenantId );

        if ( postId ) {
          this.logger.log( "Post ID is", postId );
          this.postId = postId; // Store the post ID if it exists
        }

        this.loadSurvey();
      } );
    } catch ( error ) {
      this.notificationService.show( "Error!", "Unable to process survey", "error" );
      this.logger.error( error );
    }
  }

  updateVisibleSteps (): void {
    const range = 3; // The number of steps to show at a time

    const start = Math.max( 0, this.currentStep - 1 );
    const end = Math.min( this.totalSteps, this.currentStep + range - 1 );

    // Clear previous visible steps
    this.displayedSteps = [];

    // Populate displayed steps based on the range
    for ( let i = start; i < end; i++ ) {
      this.displayedSteps.push( { index: i } );
    }
  }

  nextStep (): void {
    if ( this.currentStep < this.totalSteps - 1 ) {
      const currentResponse = this.responses.at( this.currentStep ); // Get the current response
      if ( this.canAdvanceCurrentStep() || currentResponse?.valid ) {
        // Proceed to the next step if the current response is valid
        if ( this.currentStep < this.totalSteps - 1 ) {
          this.currentStep++;
        }
      } else {
        // Optionally display a message to the user
        this.notificationService.show( "Alert", 'Please answer the current question before proceeding.', 'warning' );
      }
      this.updateVisibleSteps(); // Update visible steps when current step changes
    }
  }



  previousStep (): void {
    if ( this.currentStep > 0 ) {
      this.currentStep--;
      this.updateVisibleSteps(); // Update visible steps when current step changes
    }
  }


  loadSurvey (): void {
    if ( this.previewMode ) {
      this.loadPreviewSurvey();
      return;
    }

    this.surveySubscription = this.surveyApiService.getPublicSurveyById( this.surveyId )
      .subscribe( {
        next: ( surveyData: Survey | null ) => {
          this.loadErrorMessage = '';
          if ( surveyData ) {
            this.survey = surveyData;
            this.totalSteps = this.survey.questions.length;
            this.creatorPreviewMode = !!this.currentUserId && this.survey.ownerId === this.currentUserId;
            this.responseAlreadySubmitted = !this.creatorPreviewMode && this.hasExistingSubmission();
            this.message = this.resolveReadOnlyMessage();
            this.initializeSurveyForm( this.survey );

            if ( this.creatorPreviewMode ) {
              this.notificationService.show( 'Preview Only', 'You created this Pulse, so you can preview it here but cannot submit a response to your own survey.', 'info' );
            } else if ( this.responseAlreadySubmitted ) {
              this.notificationService.show( 'Completion Status', this.message, 'warning' );
            }
          } else {
            this.logger.error( 'Survey not found' );
            this.loadErrorMessage = 'This Pulse link is unavailable right now. Ask the sender to re-open the survey and copy a fresh share link.';
            this.notificationService.show( 'Error', 'Survey not found', 'error' );
          }
        },
        error: ( error ) => {
          this.logger.error( 'Error loading survey:', error );
          this.loadErrorMessage = 'This Pulse could not be opened. Ask the sender to confirm the survey is still published and share a fresh link.';
          this.notificationService.show( 'Error', 'Error loading survey:' + error, 'error' );
        }
      } );
  }

  private loadPreviewSurvey (): void {
    this.surveySubscription = this.surveyApiService.getSurveyById( this.surveyId )
      .subscribe( {
        next: ( surveyData: Survey | null ) => {
          this.loadErrorMessage = '';
          if ( surveyData ) {
            this.survey = surveyData;
            this.totalSteps = this.survey.questions.length;
            this.creatorPreviewMode = false;
            this.responseAlreadySubmitted = false;
            this.message = '';
            this.initializeSurveyForm( this.survey );
          } else {
            this.logger.error( 'Survey not found' );
            this.loadErrorMessage = 'This Pulse preview is unavailable right now.';
            this.notificationService.show( 'Error', 'Survey not found', 'error' );
          }
        },
        error: ( error ) => {
          this.logger.error( 'Error loading preview survey:', error );
          this.loadErrorMessage = 'This Pulse preview could not be opened.';
          this.notificationService.show( 'Error', 'Error loading preview survey:' + error, 'error' );
        }
      } );
  }



  get responses () {
    return this.surveyForm.get( 'responses' ) as FormArray;
  }

  submitSurvey (): void {
    try {
      if ( this.previewMode ) {
        this.notificationService.show( 'Preview Mode', 'This is a preview. Responses are not being submitted.', 'info' );
        return;
      }

      if ( this.creatorPreviewMode ) {
        this.notificationService.show( 'Preview Only', 'Survey owners can preview their Pulse here, but they cannot submit responses to their own survey.', 'info' );
        return;
      }

      if ( this.responseAlreadySubmitted ) {
        this.notificationService.show( 'Already Submitted', this.message || 'This survey has already been completed on this device.', 'warning' );
        return;
      }

      if ( this.surveyForm.valid ) {
        const surveyResponse: PublicSurveyResponsePayload = {
          surveyId: this.surveyId,
          responses: this.surveyForm.value.responses,
          submittedAt: new Date(),
        };

        this.surveyApiService.submitPublicSurveyResponse( this.surveyId, surveyResponse )
          .subscribe( {
            next: () => {
              this.notificationService.show( 'Success', 'Survey response submitted successfully', 'success' );
              this.surveyCompleted = true;
              this.startCountdown();
              localStorage.setItem( `survey_${this.surveyId}_completed`, 'true' );
              if ( this.postId ) {
                localStorage.setItem( `survey_${this.postId}_completed`, 'true' );
              }
            },
            error: ( error ) => {
              const errorCode = error?.error?.code || error?.code;
              const backendMessage = error?.error?.error || error?.error?.message || error?.message;
              const errorMessage = errorCode === 'SURVEY_OWNER_CANNOT_RESPOND'
                ? 'You created this Pulse, so you can preview it but cannot submit a response to it.'
                : backendMessage || 'Error submitting survey response.';
              this.notificationService.show( 'Error', errorMessage, 'error' );
              this.logger.error( 'Error submitting survey response:', error );
            }
          } );
      } else {
        this.logger.log( 'Survey form is invalid. Please answer all questions.' );
        this.notificationService.show( "Error", 'Survey form is invalid. Please answer all questions.', 'error' );
      }

    } catch ( error ) {
      this.notificationService.show( "Error", 'Survey form is invalid. Please answer all questions.', 'error' );
      this.logger.error( error );
    }


  }

  private initializeSurveyForm ( survey: Survey ): void {
    const formArray = this.fb.array( [] );

    survey.questions.forEach( question => {
      formArray.push( this.createResponseControl( question ) );
    } );

    this.surveyForm.setControl( 'responses', formArray );
  }

  private createResponseControl ( question: Survey['questions'][number] ) {
    const validators = question.required === false ? [] : [Validators.required];

    if ( question.questionType === 'checkbox' ) {
      return this.fb.control<string[]>( [], question.required === false ? [] : [this.checkboxSelectionValidator()] );
    }

    return this.fb.control( '', validators );
  }

  private checkboxSelectionValidator (): ValidatorFn {
    return ( control: AbstractControl ) => {
      const value = control.value;
      return Array.isArray( value ) && value.length > 0 ? null : { required: true };
    };
  }

  private hasExistingSubmission (): boolean {
    const surveyCompleted = localStorage.getItem( `survey_${this.surveyId}_completed` );
    const postCompleted = this.postId ? localStorage.getItem( `survey_${this.postId}_completed` ) : null;

    if ( this.postId ) {
      return !!( postCompleted && surveyCompleted );
    }

    return !!surveyCompleted;
  }

  private resolveReadOnlyMessage (): string {
    if ( this.creatorPreviewMode ) {
      return 'You created this Pulse. Preview is available, but self-submission is disabled.';
    }

    if ( this.responseAlreadySubmitted ) {
      return this.postId
        ? 'Survey already completed for this post'
        : 'Survey already completed';
    }

    return '';
  }

  isReadOnlyMode (): boolean {
    return this.previewMode || this.creatorPreviewMode || this.responseAlreadySubmitted;
  }

  canAdvanceCurrentStep (): boolean {
    if ( this.isReadOnlyMode() ) {
      return true;
    }

    return !!this.responses.at( this.currentStep )?.valid;
  }

  toggleCheckboxOption ( questionIndex: number, option: string, checked: boolean ): void {
    const control = this.responses.at( questionIndex );
    const currentSelections = Array.isArray( control.value ) ? [...control.value] : [];
    const nextSelections = checked
      ? Array.from( new Set( [...currentSelections, option] ) )
      : currentSelections.filter( selectedOption => selectedOption !== option );

    control.setValue( nextSelections );
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  isCheckboxSelected ( questionIndex: number, option: string ): boolean {
    const value = this.responses.at( questionIndex )?.value;
    return Array.isArray( value ) ? value.includes( option ) : false;
  }

  formatResponsePreview ( value: unknown ): string {
    if ( Array.isArray( value ) ) {
      return value.join( ', ' );
    }

    return typeof value === 'string' ? value : '';
  }

  hasResponseValue ( value: unknown ): boolean {
    if ( Array.isArray( value ) ) {
      return value.length > 0;
    }

    return !!value;
  }

  hasAnyResponses (): boolean {
    const values = this.responses?.value;

    if ( !Array.isArray( values ) ) {
      return false;
    }

    return values.some( response => this.hasResponseValue( response ) );
  }

  private tryDecodeTenantId ( hashedTenantId: string ): string | null {
    try {
      return atob( decodeURIComponent( hashedTenantId ) );
    } catch ( error ) {
      this.logger.warn( 'Ignoring unreadable Pulse tenant token', error );
      return null;
    }
  }

  getSurveyLink (): string {
    return `${environment.PLATFORM_URL}/take/${this.surveyId}`;
  }
  copyToClipboard ( text: string ) {
    navigator.clipboard.writeText( text ).then( () => {
      this.notificationService.show( "Link Copied", 'Survey link copied to clipboard', 'success' );

    } ).catch( err => {
      this.logger.error( 'Failed to copy link: ', err );
      this.notificationService.show( "Error", 'Failed to copy link: ' + err, 'error' );
    } );
  }

  startCountdown () {
    this.countdownInterval = setInterval( () => {
      this.countdownDisplay -= 1;
      if ( this.countdownDisplay <= 0 ) {
        clearInterval( this.countdownInterval );
        window.close(); // Close the window when the countdown reaches zero
        alert( "The survey has ended. Please close this window." );
      }
    }, 1000 ); // Update the countdown every second
  }

  @HostListener( 'document:keydown', ['$event'] )
  handleKeydown ( event: KeyboardEvent ) {
    if ( event.key === 'Enter' && this.canAdvanceCurrentStep() ) {
      event.preventDefault(); // Prevent default form submission behavior
      this.nextStep(); // Trigger the next step when 'Enter' is pressed
    }
  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

}
