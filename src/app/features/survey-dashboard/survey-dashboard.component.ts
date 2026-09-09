import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { LoggerService } from '../../services/logger.service';
import { Survey } from '../../models/survey.model';
import { SurveyApiService } from '../../services/survey-api.service';
import { Subscription } from 'rxjs';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { SectionJumpComponent, SectionJumpItem } from '../../shared/section-jump/section-jump.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { PulseNotificationService } from '../../services/pulse-notification.service';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';
import { PulsePageActionsService } from '../../services/pulse-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { PrimaryNavComponent } from '../../shared/primary-nav/primary-nav.component';

interface SurveyResponse {
  id: string;
  surveyId: string;
  submittedAt: string | Date;
  tenantId: string | null;
  responses: any[];
}

interface SurveyMetricCard {
  label: string;
  value: string;
  detail: string;
}

interface SurveySignalItem {
  count: string;
  title: string;
  description: string;
  tone: 'default' | 'good' | 'warn';
}

interface SurveyProgressMetric {
  label: string;
  value: string;
  progress: number;
}

interface SurveyQuestionCard {
  index: number;
  questionText: string;
  questionTypeLabel: string;
  responsesCount: number;
  responseShare: number;
  topAnswerLabel: string;
  topAnswerValue: string;
  textResponses: string[];
  options: Array<{ label: string; value: number; share: number; }>;
}

/**
 * Trimmed, mechanical port of the monorepo's
 * features/survey/survey-dashboard/survey-dashboard.component.ts (510
 * lines) - the dashboard math (rebuildDashboardState, buildOptionCounts,
 * etc.) is pure computation over Survey/SurveyResponse data, so it ports
 * unchanged. Auth/notification/assistant-bus/page-actions swapped for this
 * app's equivalents; dropped the unused DiagnosticComponent @ViewChild
 * (dead in the original, same call made throughout this extraction) and
 * `environment.VERSION`/`environment.topMenu` (undefined in this app's
 * environment, unused in the template).
 *
 * Note: like survey-add/survey-view, this redirects to '/login' when
 * signed out - this extraction's route table has no sign-in page (see the
 * final report's risk flags).
 */
@Component( {
  selector: 'app-survey-dashboard',
  standalone: true,
  imports: [CommonModule, BackToTopComponent, TruncatePipe, SectionJumpComponent, PrimaryNavComponent],
  templateUrl: './survey-dashboard.component.html',
  styleUrl: './survey-dashboard.component.css'
} )
export class SurveyDashboardComponent implements OnInit, OnDestroy {
  surveyId!: string; // Survey ID from the URL
  readonly anchorItems: SectionJumpItem[] = [
    { id: 'sd-overview', label: 'Overview' },
    { id: 'sd-status', label: 'Status' },
    { id: 'sd-queue', label: 'Queue' },
    { id: 'sd-command', label: 'Command' },
    { id: 'sd-responses', label: 'Responses' },
  ];

  survey: Survey | null = null;
  responses: SurveyResponse[] = [];
  subscriptions: Subscription[] = [];
  userSubscription!: Subscription;
  userId!: string;

  isMobile: boolean = false;
  totalQuestions = 0;
  totalResponses = 0;
  completionPercent = 0;
  engagementPercent = 0;
  responseModeLabel = 'Awaiting first response';
  commandFocus = 'No questions configured yet.';
  priorityQuestion: SurveyQuestionCard | null = null;
  metricCards: SurveyMetricCard[] = [];
  signalItems: SurveySignalItem[] = [];
  progressMetrics: SurveyProgressMetric[] = [];
  questionCards: SurveyQuestionCard[] = [];

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private surveyApiService: SurveyApiService,
    private authService: PulseAuthService,
    private logger: LoggerService,
    private notificationService: PulseNotificationService,
    private assistantBus: PulseAssistantSignalService,
    private pageActionsService: PulsePageActionsService
  ) { }

  ngOnInit (): void {
    this.surveyId = this.route.snapshot.paramMap.get( 'surveyId' ) as string;
    this.publishPageContext();
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;

      if ( !this.userId ) {
        this.notificationService.show(
          'Sign in required',
          'Sign in to access survey dashboards.',
          'info'
        );

        this.router.navigate( ['/login'], {
          queryParams: { returnUrl: this.router.url }
        } );

        return;
      }

      this.setUp();
      this.assistantBus.emitAssistantActivity( {
        feature: 'surveys',
        page: 'survey-dashboard',
        route: this.router.url,
        mode: 'dashboard',
        action: 'survey_dashboard_opened',
        summary: {
          surveyId: this.surveyId
        }
      } );
    } );

    window.scrollTo( 0, 0 );
  }
  async setUp (): Promise<void> {
    try {
      const surveySub = this.surveyApiService.getSurveyById( this.surveyId ).subscribe( {
        next: async ( survey: Survey | null ) => {
          this.survey = survey;

          if ( !this.survey ) {
            this.logger.error( 'Survey not found for dashboard', this.surveyId );
            return;
          }

          this.rebuildDashboardState();
          await this.fetchResponses();
        },
        error: ( error ) => {
          this.logger.error( 'Error initializing survey dashboard:', error );
        }
      } );
      this.subscriptions.push( surveySub );
    } catch ( error ) {
      this.logger.error( 'Error initializing survey dashboard:', error );
    }
  }

  async fetchResponses (): Promise<void> {
    try {
      const responseSub = this.surveyApiService.getSurveyResponses( this.surveyId ).subscribe( {
        next: ( responses: SurveyResponse[] ) => {
          this.responses = responses || [];
          this.logger.debug( 'Number of Responses', this.responses.length );
          this.rebuildDashboardState();
        },
        error: ( error ) => {
          this.logger.error( 'Error fetching responses:', error );
        }
      } );
      this.subscriptions.push( responseSub );
    } catch ( error ) {
      this.logger.error( 'Error fetching responses:', error );
    }
  }

  ngOnDestroy (): void {
    this.subscriptions.forEach( sub => sub.unsubscribe() );
    if ( this.userSubscription ) {
      this.userSubscription.unsubscribe();
    }
    this.assistantBus.clearPageContext();
    this.pageActionsService.clearPageActions( 'survey-dashboard' );
  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  private hasAnswer ( value: any ): boolean {
    if ( Array.isArray( value ) ) return value.length > 0;
    if ( typeof value === 'string' ) return value.trim().length > 0;
    return value !== null && value !== undefined;
  }

  private formatQuestionType ( questionType: string ): string {
    return String( questionType || 'question' )
      .replace( /_/g, ' ' )
      .replace( /\b\w/g, char => char.toUpperCase() );
  }

  private buildOptionCounts ( question: any, responses: any[] ): Array<{ label: string; value: number; share: number; }> {
    const counts = new Map<string, number>();
    const options = Array.isArray( question.options ) ? question.options : [];

    options.forEach( ( option: string ) => counts.set( option, 0 ) );

    responses.forEach( response => {
      if ( Array.isArray( response ) ) {
        response.forEach( item => counts.set( String( item ), ( counts.get( String( item ) ) || 0 ) + 1 ) );
        return;
      }

      const key = String( response );
      counts.set( key, ( counts.get( key ) || 0 ) + 1 );
    } );

    const total = responses.length || 1;
    return Array.from( counts.entries() )
      .map( ( [label, value] ) => ( {
        label,
        value,
        share: Math.round( ( value / total ) * 100 )
      } ) )
      .filter( item => item.value > 0 || options.includes( item.label ) )
      .sort( ( a, b ) => b.value - a.value )
      .slice( 0, 4 );
  }

  private rebuildDashboardState (): void {
    this.totalQuestions = this.survey?.questions?.length || 0;
    this.totalResponses = this.responses?.length || 0;

    this.questionCards = ( this.survey?.questions || [] ).map( ( question: any, index: number ) => {
      const rawResponses = this.responses
        .map( response => response.responses?.[index] )
        .filter( response => this.hasAnswer( response ) );

      const textResponses = rawResponses
        .filter( response => typeof response === 'string' )
        .map( response => String( response ).trim() )
        .filter( response => !!response );

      const multipleChoiceCounts = this.buildOptionCounts( question, rawResponses );
      const topOption = multipleChoiceCounts[0];
      const responsesCount = rawResponses.length;

      return {
        index,
        questionText: question.questionText,
        questionTypeLabel: this.formatQuestionType( question.questionType ),
        responsesCount,
        responseShare: this.totalResponses ? Math.round( ( responsesCount / this.totalResponses ) * 100 ) : 0,
        topAnswerLabel: topOption?.label || ( textResponses[0] ? 'Latest response' : 'No signal yet' ),
        topAnswerValue: topOption ? `${topOption.value} selections` : ( textResponses[0] || 'No responses yet' ),
        textResponses: textResponses.slice( 0, 3 ),
        options: multipleChoiceCounts
      };
    } );

    const answeredSlots = ( this.survey?.questions || [] ).reduce( ( total, _question, index ) => {
      return total + this.responses.filter( response => this.hasAnswer( response.responses?.[index] ) ).length;
    }, 0 );

    const totalSlots = this.totalQuestions * this.totalResponses;
    this.completionPercent = totalSlots ? Math.round( ( answeredSlots / totalSlots ) * 100 ) : 0;
    this.engagementPercent = ( this.totalQuestions && this.totalResponses )
      ? Math.min( 100, Math.round( ( this.totalResponses / Math.max( this.totalQuestions, 1 ) ) * 100 ) )
      : 0;

    this.responseModeLabel = !this.totalResponses
      ? 'Awaiting first response'
      : this.totalResponses === 1
        ? 'Single response recorded'
        : 'Response flow active';

    this.priorityQuestion = this.questionCards[0] || null;
    this.commandFocus = !this.priorityQuestion
      ? 'No questions configured yet.'
      : !this.totalResponses
        ? `Share this pulse so "${this.priorityQuestion.questionText}" starts collecting responses.`
        : `Review how people responded to "${this.priorityQuestion.questionText}".`;

    this.metricCards = [
      {
        label: 'Questions',
        value: String( this.totalQuestions ),
        detail: 'included in this pulse'
      },
      {
        label: 'Responses',
        value: String( this.totalResponses ),
        detail: this.totalResponses ? 'submissions recorded' : 'waiting for submissions'
      },
      {
        label: 'Completion',
        value: `${this.completionPercent}%`,
        detail: 'answer coverage'
      },
      {
        label: 'Mode',
        value: this.totalResponses ? 'Live' : 'Quiet',
        detail: this.responseModeLabel
      }
    ];

    const engagedQuestions = this.questionCards.filter( card => card.responsesCount > 0 ).length;
    const openQuestions = this.questionCards.filter( card => card.responsesCount === 0 ).length;
    const textHeavy = this.questionCards.filter( card => card.questionTypeLabel === 'Text' && card.responsesCount > 0 ).length;
    const strongSignals = this.questionCards.filter( card => card.topAnswerLabel && card.responsesCount > 0 ).length;

    this.progressMetrics = [
      {
        label: 'Response flow',
        value: `${this.totalResponses}`,
        progress: this.engagementPercent
      },
      {
        label: 'Coverage',
        value: `${this.completionPercent}%`,
        progress: this.completionPercent
      },
      {
        label: 'Questions engaged',
        value: `${engagedQuestions}`,
        progress: this.totalQuestions ? Math.round( ( engagedQuestions / this.totalQuestions ) * 100 ) : 0
      }
    ];

    this.signalItems = [
      {
        count: String( openQuestions ),
        title: 'Questions waiting',
        description: 'Questions that still do not have any responses.',
        tone: openQuestions ? 'warn' : 'good'
      },
      {
        count: String( textHeavy ),
        title: 'Open feedback',
        description: 'Questions with written feedback ready to review.',
        tone: textHeavy ? 'good' : 'default'
      },
      {
        count: String( strongSignals ),
        title: 'Signal ready',
        description: 'Questions already showing a clear response pattern.',
        tone: strongSignals ? 'good' : 'default'
      }
    ];

    this.publishPageContext();
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'surveys',
      page: 'survey-dashboard',
      route: this.router.url,
      mode: 'dashboard',
      title: this.survey?.title || 'Survey Dashboard',
      description: 'Review pulse response flow, question coverage, and the strongest response signals.',
      allowedActions: [
        'review_responses',
        'open_priority_question',
        'share_survey',
        'edit_survey'
      ],
      selectedEntityType: this.survey ? 'survey' : 'survey_dashboard',
      selectedEntityId: this.survey?.id || this.surveyId || '',
      summary: {
        isAuthenticated: !!this.userId,
        surveyId: this.surveyId || '',
        surveyTitle: this.survey?.title || '',
        surveyStatus: this.survey?.status || 'draft',
        totalQuestions: this.totalQuestions,
        totalResponses: this.totalResponses,
        completionPercent: this.completionPercent,
        engagementPercent: this.engagementPercent,
        responseMode: this.responseModeLabel,
        questionCardsCount: this.questionCards.length,
        signalItemsCount: this.signalItems.length,
        hasPriorityQuestion: !!this.priorityQuestion
      },
      dataPreview: {
        commandFocus: this.commandFocus,
        priorityQuestion: this.priorityQuestion?.questionText || '',
        priorityQuestionType: this.priorityQuestion?.questionTypeLabel || '',
        priorityQuestionResponses: this.priorityQuestion?.responsesCount || 0,
        topAnswerLabel: this.priorityQuestion?.topAnswerLabel || '',
        topAnswerValue: this.priorityQuestion?.topAnswerValue || ''
      }
    } );

    this.publishPageActions();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'survey-dashboard',
      context: {
        pageId: 'survey-dashboard',
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
        id: 'survey-dashboard-open-pulse',
        label: 'Open Pulse',
        icon: 'fa-solid fa-square-poll-horizontal',
        kind: 'route',
        route: this.surveyId ? `/survey/${this.surveyId}` : '/app',
        order: 10,
        group: 'context'
      },
      {
        id: 'survey-dashboard-help',
        label: 'Help',
        icon: 'fa-solid fa-circle-question',
        kind: 'route',
        route: '/help',
        fragment: 'survey-dashboard',
        order: 20,
        group: 'context'
      },
    ];
  }

}
