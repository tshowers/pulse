import { CommonModule } from '@angular/common';
import { Component, inject, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';
import { PulseOnboardingService } from '../../services/pulse-onboarding.service';
import { PulseEntitlementService } from '../../services/pulse-entitlement.service';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { PulsePageActionsService } from '../../services/pulse-page-actions.service';
import { PULSE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { SurveyApiService } from '../../services/survey-api.service';
import { Survey } from '../../models/survey.model';
import { ArcGaugeComponent, ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';
import { BusinessSymptom, SeverityLevel } from '../../models/business-symptom.model';
import { CockpitCommandDeckComponent, CockpitCommandDeckLink } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { PageAction } from '../../models/page-actions.models';
import { StatusLedComponent } from '../../shared/status-led/status-led.component';
import { buildCockpitDiagnosisRows, CockpitDiagnosisRowVm } from '../../utils/cockpit-diagnosis-board.util';

/**
 * Trimmed port of the monorepo's
 * features/survey/survey-home/survey-home.component.ts, renamed from
 * SurveyHomeComponent to PulseHomeComponent since this app's own route -
 * confirmed as the real live /pulse/app route in the monorepo. Same
 * cockpit role as Network's already-ported ContactHomeComponent, whose
 * contact-home.component.html/css is the direct structural template for
 * the cockpit-shell/diagnosis-health-panel/diagnosis-board layout below -
 * Pulse's own monorepo template turned out to already follow that exact
 * same shared cockpit pattern (right down to matching class names), so
 * this port leans on Network's already-proven, self-contained CSS rather
 * than the monorepo's own `@import
 * "shared/page/cockpit-gold-standard-shell.css"` (a dependency chain not
 * worth pulling in for one page).
 *
 * Kept: survey overview stats, the cockpit command deck, the diagnosis
 * board (`cockpit-diagnosis-board.util.ts`, pure computation, ported
 * verbatim), and the arc-gauge readiness meters.
 *
 * Cut: `module-install-config.util.ts` (the multi-module PWA-install
 * registry) - dropped entirely rather than reduced to a single-entry
 * version, because the monorepo's own template never actually renders
 * `installConfig` anywhere (confirmed by reading survey-home.component.html
 * in full: the property is computed in the constructor but never bound in
 * the template) - it was dead code even before this extraction, not a
 * feature being cut. Also dropped `hooks`/`templates`/`benefits`/`steps`,
 * the same way: readonly arrays declared in the original .ts that its own
 * .html never references.
 *
 * `ToddOnboardingService.completeFirstWin` -> `PulseOnboardingService`
 * no-op stub, per the plan.
 */
@Component( {
  selector: 'app-pulse-home',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, ArcGaugeComponent, CockpitCommandDeckComponent, CockpitBrowseModeBannerComponent, StatusLedComponent],
  templateUrl: './pulse-home.component.html',
  styleUrl: './pulse-home.component.css'
} )
export class PulseHomeComponent implements OnInit, OnDestroy, AfterViewInit {
  surveys: Survey[] = [];
  isLoggedIn = false;
  totalSurveyCount = 0;
  publishedCount = 0;
  activeSurveyCount = 0;
  draftSurveyCount = 0;
  dormantPublishedCount = 0;
  totalResponses = 0;
  customerHealthMetersVm: Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> = [];
  customerSymptomsVm: BusinessSymptom[] = [];
  diagnosisRowsVm: CockpitDiagnosisRowVm[] = [];
  customerHealthScoreVm = 0;
  customerHealthStatusVm = 'TODD is standing by. Connect Pulse to light up diagnosis, treatment, relief, and proof.';
  readonly customerHealthCommandDeckLinks: CockpitCommandDeckLink[] = [
    { label: 'Home', icon: 'house', routerLink: '/' },
    { label: 'Create Pulse', icon: 'square-poll-vertical', routerLink: '/survey-edit' },
    { label: 'Pulse List', icon: 'list-check', routerLink: '/survey-list' },
    { label: 'Pricing', icon: 'tag', routerLink: '/pricing' },
  ];

  readonly entitlements$ = inject( PulseEntitlementService ).getEntitlements();
  private signalSubscription!: Subscription;
  private queryParamSubscription?: Subscription;
  private authSubscription = new Subscription();
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';
  guidedMode: 'analyze' | null = null;
  guidedSummary: { title: string; keyFinding: string; nextMove: string; } | null = null;
  userId: string | null = null;
  tenantId: string | null = null;

  constructor (
    private authService: PulseAuthService,
    private assistantSignalService: PulseAssistantSignalService,
    private route: ActivatedRoute,
    private router: Router,
    private onboardingService: PulseOnboardingService,
    private surveyApiService: SurveyApiService,
    private pageActionsService: PulsePageActionsService
  ) { }


  ngOnInit (): void {
    this.trace( 'init' );
    this.authSubscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
        if ( this.userId === 'user not logged in' ) this.userId = null;
        this.trace( 'auth:userId', { userIdPresent: !!this.userId } );
        this.loadPulseSurveys();
        this.refreshDiagnosticsVm();
      } )
    );
    this.authSubscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId || null;
      } )
    );
    this.signalSubscription = this.assistantSignalService.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );
    this.queryParamSubscription = this.route.queryParamMap.subscribe( params => {
      const sessionId = ( params.get( 'session_id' ) || '' ).trim();
      if ( sessionId ) {
        void this.router.navigate( [PULSE_PURCHASE_FLOW.successRoute], {
          queryParams: { session_id: sessionId },
          replaceUrl: true
        } );
        return;
      }

      if ( params.get( 'guided' ) === 'analyze' ) {
        this.guidedMode = 'analyze';
        this.guidedSummary = {
          title: 'Recent customer pulse summary',
          keyFinding: 'Communication clarity is the strongest improvement theme across recent responses.',
          nextMove: 'Follow up with low-score respondents and turn their feedback into one improvement task.'
        };
        this.completeGuidedFirstWin();
        this.clearGuidedParams();
      }
    } );
    this.refreshDiagnosticsVm();
    this.publishPageActions();
  }

  ngOnDestroy (): void {
    this.authSubscription.unsubscribe();
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
    this.queryParamSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'survey-home-cockpit' );
    this.assistantSignalService.clearPageContext();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'survey-home-cockpit',
      context: {
        pageId: 'survey-home-cockpit',
        feature: 'surveys',
        entityType: 'survey',
        mode: 'dashboard'
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'survey-cockpit-create-pulse',
        label: 'Create Pulse',
        icon: 'fa-solid fa-circle-plus',
        kind: 'route',
        route: '/survey-edit',
        order: 10,
        group: 'context'
      },
      {
        id: 'survey-cockpit-pulse-list',
        label: 'Pulse List',
        icon: 'fa-solid fa-list-check',
        kind: 'route',
        route: '/survey-list',
        order: 20,
        group: 'context'
      },
      {
        id: 'survey-cockpit-pricing',
        label: 'Pricing',
        icon: 'fa-solid fa-tags',
        kind: 'route',
        route: '/pricing',
        order: 30,
        group: 'context'
      },
    ];
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  private buildCustomerHealthMeters (): Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> {
    const surveyBase = this.totalSurveyCount || 1;
    const publishedBase = this.publishedCount || 1;
    const activeCoverage = this.isLoggedIn ? Math.round( ( this.activeSurveyCount / surveyBase ) * 100 ) : 0;
    const publishingReadiness = this.isLoggedIn ? Math.round( ( this.publishedCount / surveyBase ) * 100 ) : 0;
    const responseCoverage = this.isLoggedIn
      ? Math.round( ( ( this.publishedCount - this.dormantPublishedCount ) / publishedBase ) * 100 )
      : 0;
    const draftPressure = this.isLoggedIn ? Math.round( ( this.draftSurveyCount / surveyBase ) * 100 ) : 0;

    return [
      {
        id: 'feedback-coverage',
        label: 'Feedback coverage',
        value: activeCoverage,
        tone: this.isLoggedIn ? this.toneFromPercent( activeCoverage, false ) : 'info',
        detail: this.isLoggedIn
          ? `${this.activeSurveyCount} pulse${this.activeSurveyCount === 1 ? '' : 's'} are collecting real customer feedback now.`
          : 'Live feedback coverage appears after sign-in.'
      },
      {
        id: 'listening-cadence',
        label: 'Listening cadence',
        value: publishingReadiness,
        tone: this.isLoggedIn ? this.toneFromPercent( publishingReadiness, false ) : 'info',
        detail: this.isLoggedIn
          ? `${this.publishedCount} pulse${this.publishedCount === 1 ? '' : 's'} are currently published.`
          : 'Publishing cadence appears after sign-in.'
      },
      {
        id: 'response-flow',
        label: 'Response flow',
        value: responseCoverage,
        tone: this.isLoggedIn ? this.toneFromPercent( 100 - responseCoverage, true ) : 'info',
        detail: this.isLoggedIn
          ? `${this.totalResponses} total response${this.totalResponses === 1 ? '' : 's'} are now in the customer-health record.`
          : 'Response flow appears after sign-in.'
      },
      {
        id: 'draft-pressure',
        label: 'Draft pressure',
        value: this.isLoggedIn ? Math.max( 0, 100 - draftPressure ) : 0,
        tone: this.isLoggedIn ? this.toneFromPercent( draftPressure, true ) : 'info',
        detail: this.isLoggedIn
          ? `${this.draftSurveyCount} draft pulse${this.draftSurveyCount === 1 ? '' : 's'} still need to be published or retired.`
          : 'Draft pressure appears after sign-in.'
      }
    ];
  }

  private buildCustomerHealthScore ( meters: Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> ): number {
    if ( meters.length === 0 ) {
      return 0;
    }

    const total = meters.reduce( ( sum, meter ) => sum + meter.value, 0 );
    return Math.round( total / meters.length );
  }

  private buildCustomerHealthAppStatus (): string {
    if ( !this.isLoggedIn ) {
      return 'TODD is standing by. Connect Pulse to light up diagnosis, treatment, relief, and proof.';
    }

    if ( this.totalResponses > 0 ) {
      return `TODD is reading ${this.totalResponses} response${this.totalResponses === 1 ? '' : 's'} and tracking which customer-health questions are producing useful signal.`;
    }

    if ( this.publishedCount > 0 ) {
      return 'TODD is watching published pulses and waiting for the first customer responses to arrive.';
    }

    return 'TODD is ready to help you publish the next pulse so customer-health signal can start flowing.';
  }

  private buildVisibleCustomerSymptoms (): BusinessSymptom[] {
    if ( !this.isLoggedIn ) {
      return this.guestCustomerSymptoms;
    }

    return [
      {
        id: 'customer-feedback-missing',
        title: 'Customer feedback is missing',
        description: 'The team cannot act on customer sentiment when no live responses are arriving.',
        severity: this.totalResponses === 0 ? ( this.publishedCount > 0 ? 'high' : 'critical' ) : 'low',
        reliefStatus: this.totalResponses > 0 ? 'improving' : ( this.publishedCount > 0 ? 'todd-working' : 'needs-relief' ),
        evidence: [
          {
            label: 'Responses collected',
            value: String( this.totalResponses ),
            detail: this.totalResponses > 0
              ? 'Customer answers are now being captured inside Pulse.'
              : 'No customer responses have been recorded yet.'
          }
        ],
        toddActions: [
          {
            label: 'Monitor incoming customer signal',
            detail: this.publishedCount > 0
              ? 'TODD is watching published pulses so the first response signal becomes visible as soon as it arrives.'
              : 'TODD is ready to help publish the next pulse so customer feedback can begin.'
          }
        ],
        progress: {
          summary: this.publishedCount > 0
            ? `${this.publishedCount} published pulse${this.publishedCount === 1 ? '' : 's'} can begin collecting customer signal immediately.`
            : 'No live pulse is published yet, so customer-health signal is still dark.'
        },
        outcome: {
          label: 'Published pulses',
          value: String( this.publishedCount ),
          detail: this.publishedCount > 0
            ? 'Published pulses are the active channels through which customer-health evidence enters TODD.'
            : 'Outcome tracking begins after the first pulse is published.',
          observed: this.publishedCount > 0
        },
        trend: this.totalResponses > 0 ? 'improving' : 'stable',
        module: 'pulse'
      },
      {
        id: 'survey-participation-low',
        title: 'Survey participation is low',
        description: 'Published pulses without responses mean the customer-health question is live, but the signal is still not reaching the business.',
        severity: this.dormantPublishedCount > 0 ? this.severityFromCount( this.dormantPublishedCount ) : 'low',
        reliefStatus: this.dormantPublishedCount > 0 ? 'todd-working' : 'relief-delivered',
        evidence: [
          {
            label: 'Published without response',
            value: String( this.dormantPublishedCount ),
            detail: this.dormantPublishedCount > 0
              ? `${this.dormantPublishedCount} published pulse${this.dormantPublishedCount === 1 ? '' : 's'} have not received a response yet.`
              : 'Every published pulse has recorded at least one response.'
          }
        ],
        toddActions: [
          {
            label: 'Keep feedback loops visible',
            detail: 'TODD keeps the pulse list and dashboards easy to reach so low-participation pulses are visible before the team forgets them.'
          }
        ],
        progress: {
          summary: this.activeSurveyCount > 0
            ? `${this.activeSurveyCount} published pulse${this.activeSurveyCount === 1 ? '' : 's'} are already producing customer signal.`
            : 'No published pulse has produced a response yet.'
        },
        outcome: {
          label: 'Active feedback loops',
          value: String( this.activeSurveyCount ),
          detail: this.activeSurveyCount > 0
            ? 'These pulses are already moving from question to evidence.'
            : 'Outcome tracking will light up after the first response lands.',
          observed: this.activeSurveyCount > 0
        },
        trend: this.activeSurveyCount > 0 ? 'improving' : 'stable',
        module: 'pulse'
      },
      {
        id: 'customer-learning-stuck-in-draft',
        title: 'Customer learning is stuck in draft mode',
        description: 'Draft pulses hold useful questions, but they are not helping the business until they are published and answered.',
        severity: this.draftSurveyCount > 0 ? this.severityFromCount( this.draftSurveyCount ) : 'low',
        reliefStatus: this.draftSurveyCount > 0 ? 'needs-user-decision' : 'watching',
        evidence: [
          {
            label: 'Draft pulses',
            value: String( this.draftSurveyCount ),
            detail: this.draftSurveyCount > 0
              ? `${this.draftSurveyCount} pulse${this.draftSurveyCount === 1 ? '' : 's'} are still in draft mode.`
              : 'There are no draft pulses waiting for a publishing decision.'
          }
        ],
        toddActions: [
          {
            label: 'Prepare the next listening cycle',
            detail: 'TODD keeps draft pulses visible so the next feedback loop can be launched without rebuilding the question set from scratch.'
          }
        ],
        progress: {
          summary: this.publishedCount > 0
            ? `${this.publishedCount} pulse${this.publishedCount === 1 ? '' : 's'} are already live while drafts wait for a decision.`
            : 'Everything is still waiting on the first publish decision.'
        },
        outcome: {
          label: 'Total pulse inventory',
          value: String( this.totalSurveyCount ),
          detail: this.totalSurveyCount > 0
            ? 'Pulse already holds reusable survey work; the next step is deciding which of it should go live.'
            : 'No saved pulse inventory exists yet.',
          observed: this.totalSurveyCount > 0
        },
        trend: this.draftSurveyCount > 0 ? 'stable' : 'improving',
        module: 'pulse',
        requiresUserAction: this.draftSurveyCount > 0,
        userActionLabel: this.draftSurveyCount > 0 ? 'Review drafts' : undefined,
        userActionRoute: this.draftSurveyCount > 0 ? '/survey-list' : null
      }
    ];
  }

  private readonly guestCustomerSymptoms: BusinessSymptom[] = [
    {
      id: 'guest-customer-feedback-missing',
      title: 'Customer feedback is missing',
      description: 'Without live pulses, the team cannot see what customers are saying or where satisfaction is drifting.',
      severity: 'medium',
      reliefStatus: 'insufficient-information',
      evidence: [
        {
          label: 'Responses collected',
          value: '0',
          detail: 'Pulse lights up once a real survey is published and starts receiving responses.'
        }
      ],
      toddActions: [
        {
          label: 'Stand by for customer signal',
          detail: 'TODD will begin tracking customer-health feedback once Pulse is connected to live survey activity.'
        }
      ],
      progress: { summary: 'Preview mode keeps the same customer-health diagnosis board visible, but the instruments stay dark.' },
      outcome: {
        label: 'Published pulses',
        value: '0',
        detail: 'Live proof appears after sign-in and activation.',
        observed: false
      },
      trend: 'unknown',
      module: 'pulse'
    },
    {
      id: 'guest-survey-participation-low',
      title: 'Survey participation is low',
      description: 'Pulse watches whether customer questions are actually earning responses, not just getting published.',
      severity: 'low',
      reliefStatus: 'watching',
      evidence: [
        {
          label: 'Published without response',
          value: '0',
          detail: 'Participation pressure appears once live customer surveys are running.'
        }
      ],
      toddActions: [
        {
          label: 'Monitor response flow',
          detail: 'TODD will watch which pulses are producing signal and which ones are still waiting in silence.'
        }
      ],
      progress: { summary: 'Pulse uses participation as evidence that the customer-health question is reaching the right audience.' },
      outcome: {
        label: 'Active feedback loops',
        value: '0',
        detail: 'Proof turns on when responses start arriving.',
        observed: false
      },
      trend: 'unknown',
      module: 'pulse'
    },
    {
      id: 'guest-customer-learning-stuck',
      title: 'Customer learning is stuck in draft mode',
      description: 'Draft questions do not improve customer health until they go live and start teaching the business something useful.',
      severity: 'low',
      reliefStatus: 'insufficient-information',
      evidence: [
        {
          label: 'Draft pulses',
          value: '0',
          detail: 'Draft pressure appears after Pulse is connected to saved surveys.'
        }
      ],
      toddActions: [
        {
          label: 'Prepare the next listening cycle',
          detail: 'TODD will surface draft and published pulses in one customer-health cockpit once live data is available.'
        }
      ],
      progress: { summary: 'Guests see the same cockpit, but draft and response values stay at zero until sign-in.' },
      outcome: {
        label: 'Total pulse inventory',
        value: '0',
        detail: 'Inventory and proof turn on with live data.',
        observed: false
      },
      trend: 'unknown',
      module: 'pulse'
    }
  ];

  private loadPulseSurveys (): void {
    if ( !this.userId ) {
      this.surveys = [];
      this.trace( 'surveys:guest-mode' );
      this.refreshDiagnosticsVm();
      return;
    }

    this.trace( 'surveys:load:start' );
    this.surveyApiService.listSurveys( {
      pageSize: 100,
      filters: {
        sortBy: 'updatedAt',
        sortDirection: 'desc'
      }
    } ).subscribe( {
      next: result => {
        this.surveys = result.surveys || [];
        this.trace( 'surveys:load:next', { count: this.surveys.length } );
        this.refreshDiagnosticsVm();
      },
      error: () => {
        this.surveys = [];
        this.trace( 'surveys:load:error' );
        this.refreshDiagnosticsVm();
      }
    } );
  }

  trackById ( _index: number, item: { id: string; } ): string {
    return item.id;
  }

  private toneFromPercent ( percent: number, inverse: boolean ): ArcGaugeTone {
    const score = inverse ? 100 - percent : percent;
    if ( score >= 75 ) return 'positive';
    if ( score >= 45 ) return 'attention';
    return 'warn';
  }

  private severityFromCount ( count: number ): SeverityLevel {
    if ( count >= 6 ) return 'critical';
    if ( count >= 3 ) return 'high';
    if ( count >= 1 ) return 'medium';
    return 'low';
  }

  private completeGuidedFirstWin (): void {
    const context = this.getOnboardingContext();
    if ( !context || !this.guidedSummary ) {
      return;
    }

    this.onboardingService.completeFirstWin( context, 'analyze' );
  }

  private clearGuidedParams (): void {
    this.router.navigate( [], {
      relativeTo: this.route,
      queryParams: {
        guided: null,
        firstWin: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    } );
  }

  private getOnboardingContext (): Record<string, unknown> | null {
    const userId = String( this.userId || '' ).trim();
    const tenantId = String( this.tenantId || '' ).trim();

    if ( !userId ) {
      return null;
    }

    return {
      userId,
      tenantId: tenantId || undefined
    };
  }

  private refreshDiagnosticsVm (): void {
    this.isLoggedIn = !!this.userId;
    this.totalSurveyCount = this.surveys.length;
    this.publishedCount = this.surveys.filter( survey => survey.status === 'published' ).length;
    this.activeSurveyCount = this.surveys.filter( survey => survey.status === 'published' && Number( survey.responseCount || 0 ) > 0 ).length;
    this.draftSurveyCount = this.surveys.filter( survey => !survey.status || survey.status === 'draft' ).length;
    this.dormantPublishedCount = this.surveys.filter( survey => survey.status === 'published' && Number( survey.responseCount || 0 ) === 0 ).length;
    this.totalResponses = this.surveys.reduce( ( sum, survey ) => sum + Number( survey.responseCount || 0 ), 0 );

    this.customerHealthMetersVm = this.buildCustomerHealthMeters();
    this.customerHealthScoreVm = this.buildCustomerHealthScore( this.customerHealthMetersVm );
    this.customerHealthStatusVm = this.buildCustomerHealthAppStatus();
    this.customerSymptomsVm = this.buildVisibleCustomerSymptoms();
    this.diagnosisRowsVm = buildCockpitDiagnosisRows( this.customerSymptomsVm );
    this.publishPageContext();
    this.trace( 'vm:refreshed', {
      loggedIn: this.isLoggedIn,
      surveys: this.surveys.length,
      meters: this.customerHealthMetersVm.length,
      symptoms: this.customerSymptomsVm.length
    } );
  }

  private publishPageContext (): void {
    const topDraftSurvey = this.surveys.find( survey => !survey.status || survey.status === 'draft' ) || null;
    const topDormantPublishedSurvey = this.surveys.find( survey => survey.status === 'published' && Number( survey.responseCount || 0 ) === 0 ) || null;
    const topActiveSurvey = this.surveys.find( survey => survey.status === 'published' && Number( survey.responseCount || 0 ) > 0 ) || null;

    this.assistantSignalService.setPageContext( {
      feature: 'surveys',
      page: 'survey-home',
      route: this.router.url || '/app',
      mode: 'dashboard',
      title: 'Customer Health',
      description: 'See where customer signal is missing, what TODD is treating, where relief is visible, and what proof is emerging.',
      allowedActions: [
        'create_pulse',
        'open_pulse_list',
        'open_pulse_pricing'
      ],
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        totalSurveyCount: this.totalSurveyCount,
        publishedCount: this.publishedCount,
        activeSurveyCount: this.activeSurveyCount,
        draftSurveyCount: this.draftSurveyCount,
        dormantPublishedCount: this.dormantPublishedCount,
        totalResponses: this.totalResponses,
        customerHealthScore: this.customerHealthScoreVm,
        guidedMode: this.guidedMode || ''
      },
      dataPreview: {
        appStatus: this.customerHealthStatusVm,
        createPulseRoute: '/survey-edit',
        pulseListRoute: '/survey-list',
        pulsePricingRoute: '/pricing',
        topDraftSurveyId: topDraftSurvey?.id || '',
        topDormantSurveyId: topDormantPublishedSurvey?.id || '',
        topActiveSurveyId: topActiveSurvey?.id || ''
      }
    } );
  }

  private trace ( event: string, detail?: Record<string, unknown> ): void {
    if ( typeof console === 'undefined' ) return;
    console.debug( '[PulseHome]', event, detail || {} );
  }
}
