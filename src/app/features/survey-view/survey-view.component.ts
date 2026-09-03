import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { environment } from '../../../environments/environment';

import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { SectionJumpComponent, SectionJumpItem } from '../../shared/section-jump/section-jump.component';
import { LoggerService } from '../../services/logger.service';
import { PulseNotificationService } from '../../services/pulse-notification.service';
import { Survey } from '../../models/survey.model';
import {
  SurveyApiService,
  SurveyResponsePayload
} from '../../services/survey-api.service';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { PulseSurveyStateService } from '../../services/pulse-survey-state.service';
import { PulsePageActionsService } from '../../services/pulse-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { ToddStatusTone, mapToddStatusTone } from '../../utils/todd-status-indicator.util';
import { PulseEntitlementService } from '../../services/pulse-entitlement.service';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';

/**
 * Trimmed port of the monorepo's
 * features/survey/survey-view/survey-view.component.ts (835 lines) - the
 * real paywall gate to verify end-to-end (`PulseEntitlementService.pulse`,
 * `hasPaidSurveyAccess()`'s legacy localStorage/sessionStorage fallback,
 * checkout via `createSurveyCheckout`/`confirmSurveyCheckout`). Auth/
 * notification/assistant-bus/page-actions swapped for this app's
 * equivalents; route strings updated for this app's shortened route table
 * (`/pulse/pricing` -> `/pricing`, `take-survey/:id` -> `take/:id`,
 * `/survey-view/:id` -> `/survey/:id`). Dropped the unused
 * DiagnosticComponent @ViewChild (dead in the original, same call made
 * throughout this extraction) and the TODD-branding header block
 * (logo/`/home` link/`environment.VERSION`), same trim as take-survey.
 *
 * Like survey-dashboard/survey-add, redirects to '/login' when signed out
 * - see the final report's risk flags for the missing sign-in page.
 */
@Component( {
  selector: 'app-survey-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BackToTopComponent, PreloaderComponent, SectionJumpComponent],
  templateUrl: './survey-view.component.html',
  styleUrl: './survey-view.component.css'
} )
export class SurveyViewComponent implements OnInit, OnDestroy {

  private userId!: string;
  tenantId!: string | null;
  private userSubscription!: Subscription;
  private tenantSubScription!: Subscription;
  private entitlementsSubscription?: Subscription;
  private engagementActionSubscription?: Subscription;
  surveyCompleted: boolean = false; // Flag to track survey completion
  isMobile: boolean = false;
  isLoading: boolean = false;

  private countdownTime: number = 10; // Set the countdown time (in seconds)
  countdownDisplay: number = this.countdownTime;
  countdownInterval: any;

  readonly anchorItems: SectionJumpItem[] = [
    { id: 'sv-command', label: 'Command' },
    { id: 'sv-questions', label: 'Questions' },
    { id: 'sv-live-preview', label: 'Live Preview' },
  ];
  companyName: string = environment.COMPANY_NAME;

  private surveyId!: string;
  currentStep: number = 0;
  totalSteps: number = 5; //
  survey: Survey | null = null; // Holds the survey data
  surveySubscription!: Subscription;
  surveyForm: FormGroup; // Form
  private querySubscription!: Subscription;
  message!: string;
  internal: boolean = false;
  displayedSteps: { index: number; }[] = [];
  private pulseEntitled: boolean = false;

  constructor ( private route: ActivatedRoute,
    private notificationService: PulseNotificationService,
    private router: Router,
    private authService: PulseAuthService,
    private surveyApiService: SurveyApiService,
    private surveyService: PulseSurveyStateService,
    private entitlementService: PulseEntitlementService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private pageActionsService: PulsePageActionsService,
    private assistantBus: PulseAssistantSignalService ) {

    this.surveyForm = this.fb.group( {
      responses: this.fb.array( [] ) // Array to hold the responses
    } );
  }

  ngOnInit (): void {
    this.tenantSubScription = this.authService.getTenantId().subscribe( tenantId => {
      this.tenantId = tenantId;
      this.logger.log( 'Tenant is', this.tenantId );

      this.userSubscription = this.authService.getUserId().subscribe( userId => {
        this.userId = userId;
        this.logger.log( 'User is', this.userId );

        if ( !this.userId ) {
          this.notificationService.show(
            'Sign in required',
            'Sign in to access saved surveys.',
            'info'
          );

          this.router.navigate( ['/login'], {
            queryParams: { returnUrl: this.router.url }
          } );

          return;
        }

        this.entitlementsSubscription?.unsubscribe();
        this.entitlementsSubscription = this.entitlementService.getEntitlements().subscribe( entitlements => {
          const nextPulseEntitled = !!entitlements.pulse;
          if ( this.pulseEntitled !== nextPulseEntitled ) {
            this.pulseEntitled = nextPulseEntitled;
            this.publishPageActions();
            this.publishPageContext();
          }
        } );

        this.setup();
        this.confirmSurveyCheckoutIfNeeded();
      } );
    } );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription )
      this.userSubscription.unsubscribe();
    if ( this.tenantSubScription )
      this.tenantSubScription.unsubscribe();
    if ( this.querySubscription )
      this.querySubscription.unsubscribe();
    this.entitlementsSubscription?.unsubscribe();
    this.engagementActionSubscription?.unsubscribe();
    if ( this.countdownInterval ) {
      clearInterval( this.countdownInterval );
    }
    this.pageActionsService.clearPageActions( 'survey-view' );
    this.assistantBus.clearPageContext();
  }

  hasAnyResponses (): boolean {
    const values = this.responses?.value;

    if ( !Array.isArray( values ) ) {
      return false;
    }

    return values.some( response => this.hasResponseValue( response ) );
  }

  get pulseLifecycleHeading (): string {
    if ( this.survey?.status === 'published' ) {
      return 'Pulse is live and share-ready';
    }

    return 'Pulse is still in draft';
  }

  get pulseLifecycleCopy (): string {
    if ( this.survey?.status === 'published' ) {
      return 'You can preview the live survey, copy the share link, and watch responses arrive in the results cockpit.';
    }

    if ( this.hasPaidSurveyAccess() ) {
      return 'Preview the experience, then publish when you are ready to share it publicly.';
    }

    return 'Preview the draft now. Publishing and public sharing unlock when Pulse publishing is active for your account.';
  }

  get pulseLinkAvailabilityLabel (): string {
    if ( this.survey?.status === 'published' ) {
      return 'Live share link ready';
    }

    if ( this.hasPaidSurveyAccess() ) {
      return 'Publish to activate share link';
    }

    return 'Upgrade required for sharing';
  }

  get pulseResultsLabel (): string {
    const responseCount = Number( this.survey?.responseCount || 0 );
    return `${responseCount} response${responseCount === 1 ? '' : 's'} collected`;
  }

  getPulseStatusTone ( status: string | null | undefined ): ToddStatusTone {
    const normalized = String( status || '' ).trim().toLowerCase();

    if ( !normalized || normalized === 'draft' ) {
      return 'waiting';
    }

    if ( normalized === 'archived' || normalized === 'private' ) {
      return 'off';
    }

    if ( normalized.includes( 'upgrade required' ) ) {
      return 'blocked';
    }

    if ( normalized.includes( 'publish to activate' ) ) {
      return 'waiting';
    }

    if ( normalized.includes( 'ready' ) || normalized === 'published' || normalized === 'public' ) {
      return 'on';
    }

    return mapToddStatusTone( normalized );
  }

  setup () {
    this.updateVisibleSteps();
    this.surveyId = this.route.snapshot.paramMap.get( 'id' ) as string;
    this.logger.log( "Survey ID is", this.surveyId );

    this.logger.log( 'tenantID so must be internal' );
    this.internal = true;
    this.publishPageActions();
    this.bindEngagementActions();
    this.publishPageContext();
    this.loadSurvey();

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
    this.isLoading = true;

    this.surveySubscription = this.surveyApiService.getSurveyById( this.surveyId )
      .subscribe( {
        next: ( surveyData: Survey | null ) => {
          this.isLoading = false;

          if ( surveyData ) {
            this.survey = surveyData;
            this.totalSteps = this.survey.questions.length;
            this.publishPageActions();
            this.publishPageContext();
            this.message = '';
            this.initializeSurveyForm( this.survey );
          } else {
            this.logger.error( 'Survey not found' );
            this.notificationService.show( 'Error', 'Survey not found', 'error' );
          }
        },
        error: ( error ) => {
          this.isLoading = false;
          this.logger.error( 'Error loading survey:', error );
          this.notificationService.show( 'Error', 'Error loading survey:' + error, 'error' );
          this.publishPageContext();
        }
      } );
  }

  get responses () {
    return this.surveyForm.get( 'responses' ) as FormArray;
  }

  submitSurvey (): void {
    try {
      if ( this.surveyForm.valid ) {
        const surveyResponse: SurveyResponsePayload = {
          surveyId: this.surveyId,
          tenantId: this.tenantId,  // Use tenantId instead of userId since users are anonymous
          responses: this.surveyForm.value.responses, // User's responses to the questions
          submittedAt: new Date()
        };

        this.surveyApiService.submitSurveyResponse( this.surveyId, surveyResponse ).subscribe( {
          next: () => {
            this.notificationService.show( 'Success', 'Survey response submitted successfully', 'success' );
            this.surveyCompleted = true;
            this.publishPageContext();
            this.startCountdown();
            if ( !this.internal ) {
              localStorage.setItem( `survey_${this.surveyId}_completed`, 'true' );
            }
          },
          error: ( error ) => {
            this.notificationService.show( 'Error', 'Error submitting survey response:' + error, 'error' );
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

  canAdvanceCurrentStep (): boolean {
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

  getSurveyLink (): string {
    return `${environment.PLATFORM_URL}/take/${this.surveyId}`;
  }

  publishSurvey (): void {
    if ( !this.hasPaidSurveyAccess() ) {
      this.handleSurveyUpgradeRequired();
      return;
    }

    this.surveyApiService.publishSurvey( this.surveyId ).subscribe( {
      next: ( result ) => {
        if ( this.survey ) {
          this.survey = {
            ...this.survey,
            status: result.status || 'published',
            visibility: result.visibility || 'public'
          };
        }
        this.publishPageActions();
        this.publishPageContext();

        this.notificationService.show( 'Published', 'Pulse published successfully.', 'success' );
      },
      error: ( error ) => {
        this.logger.error( 'Error publishing survey:', error );
        this.notificationService.show( 'Error', 'Error publishing survey: ' + error, 'error' );
      }
    } );
  }

  hasPaidSurveyAccess (): boolean {
    const localValue = localStorage.getItem( 'surveyPaidAccess' );
    const sessionValue = sessionStorage.getItem( 'surveyPaidAccess' );
    return this.pulseEntitled || localValue === 'true' || sessionValue === 'true';
  }

  getCurrentUserEmail (): string | null {
    const auth: any = this.authService as any;

    if ( auth && typeof auth.getUser === 'function' ) {
      const user = auth.getUser();
      if ( user && user.email ) {
        return user.email;
      }
    }

    if ( auth && auth.currentUser && auth.currentUser.email ) {
      return auth.currentUser.email;
    }

    const localValue = localStorage.getItem( 'userEmail' );
    if ( localValue && localValue.trim() ) {
      return localValue.trim();
    }

    const sessionValue = sessionStorage.getItem( 'userEmail' );
    if ( sessionValue && sessionValue.trim() ) {
      return sessionValue.trim();
    }

    return null;
  }

  confirmSurveyCheckoutIfNeeded (): void {
    const sessionId = this.route.snapshot.queryParamMap.get( 'session_id' );

    if ( !sessionId ) {
      return;
    }

    this.surveyApiService.confirmSurveyCheckout( sessionId ).subscribe( {
      next: () => {
        this.pulseEntitled = true;
        localStorage.setItem( 'surveyPaidAccess', 'true' );
        sessionStorage.setItem( 'surveyPaidAccess', 'true' );
        this.entitlementService.resetCache();
        this.notificationService.show(
          'Subscription active',
          'Survey publishing is now active.',
          'success'
        );

        this.router.navigate( [], {
          relativeTo: this.route,
          queryParams: { session_id: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        } );
      },
      error: ( error ) => {
        this.logger.error( 'Error confirming survey checkout:', error );
        this.notificationService.show(
          'Error',
          'Unable to confirm survey subscription.',
          'error'
        );
      }
    } );
  }

  handleSurveyUpgradeRequired (): void {
    const email = this.getCurrentUserEmail();

    if ( !this.tenantId || !email ) {
      this.notificationService.show(
        'Publish requires payment',
        'Pay to publish your survey. Pulse creation is free, but publishing requires a paid plan.',
        'info'
      );

      this.router.navigate( ['/pricing'], {
        queryParams: { returnUrl: this.router.url, feature: 'survey-publish' }
      } );

      return;
    }

    this.surveyApiService.createSurveyCheckout( {
      tenantId: this.tenantId,
      email
    } ).subscribe( {
      next: ( result ) => {
        if ( result && result.checkoutUrl ) {
          window.location.href = result.checkoutUrl;
          return;
        }

        this.notificationService.show(
          'Error',
          'Unable to start survey checkout.',
          'error'
        );
      },
      error: ( error ) => {
        this.logger.error( 'Error starting survey checkout:', error );
        this.notificationService.show(
          'Publish requires payment',
          'Pay to publish your survey. We could not start checkout right now.',
          'error'
        );
      }
    } );
  }

  publishSurveyAndCopyLink ( text: string ): void {
    this.surveyApiService.publishSurvey( this.surveyId ).subscribe( {
      next: ( result ) => {
        if ( this.survey ) {
          this.survey = {
            ...this.survey,
            status: result.status || 'published',
            visibility: result.visibility || 'public'
          };
        }
        this.publishPageActions();
        this.publishPageContext();

        navigator.clipboard.writeText( text ).then( () => {
          this.notificationService.show( 'Published', 'Survey published and link copied to clipboard', 'success' );
        } ).catch( err => {
          this.logger.error( 'Failed to copy link: ', err );
          this.notificationService.show( 'Error', 'Failed to copy link: ' + err, 'error' );
        } );
      },
      error: ( error ) => {
        this.logger.error( 'Error publishing survey:', error );
        this.notificationService.show( 'Error', 'Error publishing survey: ' + error, 'error' );
      }
    } );
  }

  unpublishSurvey (): void {
    this.surveyApiService.unpublishSurvey( this.surveyId ).subscribe( {
      next: ( result ) => {
        if ( this.survey ) {
          this.survey = {
            ...this.survey,
            status: result.status || 'draft',
            visibility: result.visibility || 'private'
          };
        }
        this.publishPageActions();
        this.publishPageContext();

        this.notificationService.show( 'Survey Unpublished', 'Survey moved back to draft', 'success' );
      },
      error: ( error ) => {
        this.logger.error( 'Error unpublishing survey:', error );
        this.notificationService.show( 'Error', 'Error unpublishing survey: ' + error, 'error' );
      }
    } );
  }

  copyToClipboard ( text: string ) {
    if ( !this.hasPaidSurveyAccess() ) {
      this.handleSurveyUpgradeRequired();
      return;
    }

    if ( this.survey?.status !== 'published' ) {
      this.publishSurveyAndCopyLink( text );
      return;
    }

    navigator.clipboard.writeText( text ).then( () => {
      this.notificationService.show( 'Link Copied', 'Survey link copied to clipboard', 'success' );

    } ).catch( err => {
      this.logger.error( 'Failed to copy link: ', err );
      this.notificationService.show( 'Error', 'Failed to copy link: ' + err, 'error' );
    } );
  }

  previewPublicSurvey (): void {
    window.open( `${environment.PLATFORM_URL}/take/${this.surveyId}?preview=1`, '_blank', 'noopener' );
  }

  openLiveSurvey (): void {
    if ( this.survey?.status !== 'published' ) {
      this.notificationService.show(
        'Publish required',
        'Publish this Pulse before opening the live survey link.',
        'info'
      );
      return;
    }

    window.open( this.getSurveyLink(), '_blank', 'noopener' );
  }

  openResults (): void {
    this.router.navigate( ['/survey-dashboard', this.surveyId] );
  }

  backToEdit (): void {
    if ( this.survey ) {
      this.surveyService.setSelectedSurvey( this.survey );
    }

    this.router.navigate( ['/survey-edit'] );
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

  @HostListener( 'document:keydown.enter', ['$event'] )
  handleKeydown ( event: KeyboardEvent | Event ) {
    const keyboardEvent = event as KeyboardEvent;

    if ( keyboardEvent.key === 'Enter' && this.responses.at( this.currentStep ).valid ) {
      keyboardEvent.preventDefault();
      this.nextStep();
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

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'surveys',
      page: 'survey-view',
      route: this.router.url,
      mode: 'view',
      title: this.survey?.title || 'Pulse View',
      description: 'Publish, preview, share, and monitor a Pulse before routing people into results review.',
      allowedActions: [
        'publish_pulse',
        'unpublish_pulse',
        'copy_share_link',
        'preview_pulse',
        'open_pulse_results',
        'edit_pulse'
      ],
      selectedEntityType: 'survey',
      selectedEntityId: this.survey?.id || this.surveyId || '',
      summary: {
        isAuthenticated: !!this.userId,
        interactionMode: !!this.userId ? 'member' : 'guest',
        surveyId: this.surveyId || '',
        surveyStatus: this.survey?.status || 'draft',
        responseCount: Number( this.survey?.responseCount || 0 ),
        totalQuestions: this.survey?.questions?.length || 0,
        currentStep: this.currentStep,
        totalSteps: this.totalSteps,
        pulseEntitled: this.hasPaidSurveyAccess(),
        surveyCompleted: this.surveyCompleted,
        hasAnyResponses: this.hasAnyResponses()
      },
      dataPreview: {
        lifecycleHeading: this.pulseLifecycleHeading,
        lifecycleCopy: this.pulseLifecycleCopy,
        linkAvailabilityLabel: this.pulseLinkAvailabilityLabel,
        resultsLabel: this.pulseResultsLabel,
        shareLink: this.getSurveyLink()
      }
    } );
  }

  private bindEngagementActions (): void {
    this.engagementActionSubscription = this.assistantBus.engagementActionRequest$.subscribe( request => {
      if ( !request || this.router.url.split( '?' )[0] !== `/survey/${this.surveyId}` ) {
        return;
      }

      switch ( request.action ) {
        case 'publish_pulse':
          this.publishSurvey();
          break;
        case 'unpublish_pulse':
          this.unpublishSurvey();
          break;
        case 'copy_share_link':
          this.copyToClipboard( this.getSurveyLink() );
          break;
        case 'open_pulse_results':
          this.openResults();
          break;
        case 'edit_pulse':
          this.backToEdit();
          break;
        default:
          break;
      }
    } );
  }

  private publishPageActions (): void {
    if ( !this.internal ) {
      this.pageActionsService.clearPageActions( 'survey-view' );
      return;
    }

    this.pageActionsService.setPageActions( {
      pageId: 'survey-view',
      context: {
        pageId: 'survey-view',
        feature: 'surveys',
        entityType: 'survey',
        entityId: this.survey?.id || this.surveyId
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'survey-view-edit',
        label: 'Back to Edit',
        icon: 'fa-solid fa-pen-to-square',
        kind: 'callback',
        handler: () => this.backToEdit(),
        order: 10,
        group: 'context'
      },
      {
        id: 'survey-view-publish',
        label: this.survey?.status === 'published' ? 'Move to Draft' : 'Publish Pulse',
        icon: this.survey?.status === 'published' ? 'fa-solid fa-box-archive' : 'fa-solid fa-bullhorn',
        kind: 'callback',
        handler: () => this.survey?.status === 'published' ? this.unpublishSurvey() : this.publishSurvey(),
        order: 20,
        group: 'context'
      },
      {
        id: 'survey-view-copy-link',
        label: 'Copy Share Link',
        icon: 'fa-solid fa-link',
        kind: 'callback',
        handler: () => this.copyToClipboard( this.getSurveyLink() ),
        order: 30,
        group: 'context'
      },
      {
        id: 'survey-view-preview',
        label: 'Preview Pulse',
        icon: 'fa-solid fa-eye',
        kind: 'callback',
        handler: () => this.previewPublicSurvey(),
        order: 40,
        group: 'context'
      },
      {
        id: 'survey-view-results',
        label: 'Open Results',
        icon: 'fa-solid fa-chart-column',
        kind: 'callback',
        handler: () => this.openResults(),
        order: 50,
        group: 'context'
      },
      {
        id: 'survey-view-live',
        label: 'Open Live Survey',
        icon: 'fa-solid fa-up-right-from-square',
        kind: 'callback',
        handler: () => this.openLiveSurvey(),
        visible: () => this.survey?.status === 'published',
        order: 60,
        group: 'context'
      },
      {
        id: 'survey-view-help',
        label: 'Help',
        icon: 'fa-solid fa-circle-question',
        kind: 'route',
        route: '/help',
        fragment: 'survey-view',
        order: 70,
        group: 'context'
      },
    ];
  }
}
