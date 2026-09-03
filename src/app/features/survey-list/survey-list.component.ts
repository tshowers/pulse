import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PulseSurveyStateService } from '../../services/pulse-survey-state.service';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { TipService } from '../../services/tip.service';
import { PulseNotificationService } from '../../services/pulse-notification.service';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';
import { Survey } from '../../models/survey.model';
import { SurveyApiService } from '../../services/survey-api.service';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

import { SoundService } from '../../services/sound.service';
import { PulsePageActionsService } from '../../services/pulse-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { ToddStatusTone, mapToddStatusTone } from '../../utils/todd-status-indicator.util';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

/**
 * Trimmed, near-verbatim port of the monorepo's
 * features/survey/survey-list/survey-list.component.ts (239 lines) - an
 * order of magnitude smaller than Network's list.component.ts (2,465
 * lines) and carries none of its AI-search/multi-view/CSV baggage, so this
 * is the genuine exception to the "big list = rewrite" rule the plan calls
 * out. Auth/notification/assistant-bus/page-actions swapped for this app's
 * equivalents; the diagnostic-panel @ViewChild (dead in the original -
 * never rendered in the template) was dropped, same call made on
 * take-survey.component.ts.
 */
@Component( {
  selector: 'app-survey-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TruncatePipe, ToddTipComponent, PreloaderComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent],
  templateUrl: './survey-list.component.html',
  styleUrl: './survey-list.component.css'
} )
export class SurveyListComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;

  private userSubscription!: Subscription;
  private firebaseSubscription!: Subscription;

  public userId!: string;
  public surveys: Survey[] = [];
  public sortedColumn: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';
  public uid!: string;

  isLoading = false;
  isEmbedded = false;

  surveyTipText: string = '';

  constructor (
    private authService: PulseAuthService,
    private tipService: TipService,
    private notificationService: PulseNotificationService,
    private surveyApiService: SurveyApiService,
    private router: Router,
    private surveyService: PulseSurveyStateService,
    private assistantBus: PulseAssistantSignalService,
    private soundService: SoundService,
    private pageActionsService: PulsePageActionsService,
    private route: ActivatedRoute
  ) { }

  get publishedCount (): number {
    return this.surveys.filter( s => s.status === 'published' ).length;
  }

  get activeCount (): number {
    return this.surveys.filter( s => s.status === 'published' && ( s.responseCount || 0 ) > 0 ).length;
  }

  get draftCount (): number {
    return this.surveys.filter( s => !s.status || s.status === 'draft' ).length;
  }

  get totalResponses (): number {
    return this.surveys.reduce( ( sum, s ) => sum + ( s.responseCount || 0 ), 0 );
  }

  getSurveyHealthLight ( survey: Survey ): 'green' | 'amber' | 'grey' {
    if ( survey.status === 'published' && ( survey.responseCount || 0 ) > 0 ) return 'green';
    if ( survey.status === 'published' ) return 'amber';
    return 'grey';
  }

  getSurveyHealthPulse ( survey: Survey ): boolean {
    return survey.status === 'published' && ( survey.responseCount || 0 ) > 0;
  }

  getSurveyStatusTone ( status: string | null | undefined ): ToddStatusTone {
    if ( !status || status === 'draft' ) {
      return 'waiting';
    }

    if ( status === 'archived' ) {
      return 'off';
    }

    return mapToddStatusTone( status );
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'surveys',
      page: 'survey-list',
      route: this.router.url,
      mode: 'list',
      title: 'Pulse List',
      description: 'Browse saved surveys, review status, and open survey actions.',
      allowedActions: [
        'open_survey',
        'edit_survey',
        'sort_surveys',
        'open_survey_dashboard'
      ],
      selectedEntityType: 'survey',
      selectedEntityId: '',
      summary: {
        isAuthenticated: !!this.userId && this.userId !== 'user not logged in',
        interactionMode: !!this.userId && this.userId !== 'user not logged in' ? 'member' : 'guest',
        surveyCount: this.surveys.length,
        sortedColumn: this.sortedColumn || '',
        sortDirection: this.sortDirection || 'asc',
        hasSurveys: this.surveys.length > 0
      },
      dataPreview: {
        sortedColumn: this.sortedColumn || '',
        sortDirection: this.sortDirection || 'asc'
      }
    } );

    this.publishPageActions();
  }

  ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';

    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;

      if ( !this.userId || this.userId === 'user not logged in' ) {
        this.surveys = [];
        this.publishPageContext();
        return;
      }

      this.loadSurveys();
      this.publishPageContext();
    } );

    this.firebaseSubscription = this.authService.getUser().subscribe( firebaseUser => {
      if ( firebaseUser ) {
        this.uid = firebaseUser.uid;
      } else {
        this.uid = '';
      }
      this.publishPageContext();
    } );

    this.surveyService.clearSelectedSurvey();
    window.scrollTo( 0, 0 );
    this.surveyTipText = this.tipService.getRandomTipText( 'surveys', 'survey-list' );
  }

  private showPulseCrudLoginNotice (): void {
    this.notificationService.show(
      'Pulse requires sign-in',
      'You can explore Pulse freely. Sign in to create, view saved surveys, edit, or delete.',
      'warning'
    );
  }

  toggleSelection () {
    this.soundService.playSound( "toggleOn" );
  }

  loadSurveys (): void {
    this.isLoading = true;

    this.surveyApiService.listSurveys( {
      pageSize: 100,
      filters: {
        sortBy: 'updatedAt',
        sortDirection: 'desc'
      }
    } ).subscribe( {
      next: ( result ) => {
        this.surveys = result.surveys || [];
        this.isLoading = false;
        this.publishPageContext();
      },
      error: ( error ) => {
        this.isLoading = false;
        this.notificationService.show( 'Error', 'Error loading surveys', 'error' );
        console.error( 'Error loading surveys:', error );
        this.publishPageContext();
      }
    } );
  }

  async deleteSurvey ( surveyId: string ): Promise<void> {
    if ( !this.userId || this.userId === 'user not logged in' ) {
      this.showPulseCrudLoginNotice();
      return;
    }

    const survey = this.surveys.find( item => item.id === surveyId );
    const surveyLabel = survey?.title?.trim() || 'this Pulse';
    const confirmed = window.confirm( `Delete "${surveyLabel}" permanently?` );

    if ( !confirmed ) {
      return;
    }

    try {
      this.isLoading = true;
      await firstValueFrom( this.surveyApiService.deleteSurvey( surveyId ) );
      this.surveys = this.surveys.filter( item => item.id !== surveyId );
      this.notificationService.show( 'Pulse Deleted', `"${surveyLabel}" was deleted.`, 'success' );
      this.publishPageContext();
    } catch ( error: any ) {
      const message = error?.error?.error || error?.error?.message || error?.message || 'Unable to delete this Pulse right now.';
      this.notificationService.show( 'Delete failed', message, 'error' );
      console.error( 'Error deleting survey:', error );
    } finally {
      this.isLoading = false;
    }
  }

  chartSurvey ( id: string ): void {
    this.publishPageContext();
    this.router.navigate( ['/survey-dashboard', id] );
  }

  getSurveyLifecycleLabel ( survey: Survey ): string {
    if ( survey.status === 'published' ) {
      return 'Manage Pulse';
    }

    if ( survey.status === 'archived' ) {
      return 'Review Archive';
    }

    return 'Manage Draft';
  }

  getSurveyLifecycleHint ( survey: Survey ): string {
    if ( survey.status === 'published' ) {
      return 'Open sharing, preview, and results.';
    }

    if ( survey.status === 'archived' ) {
      return 'Open details and review past activity.';
    }

    return 'Open this draft to publish and share it.';
  }

  sortColumn ( column: string ): void {
    if ( this.sortedColumn === column ) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortedColumn = column;
      this.sortDirection = 'asc';
    }

    this.surveys.sort( ( a: Survey, b: Survey ) => {
      const valA = ( a as Record<string, any> )[column];
      const valB = ( b as Record<string, any> )[column];

      if ( valA < valB ) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if ( valA > valB ) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    } );
    this.publishPageContext();
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.firebaseSubscription ) this.firebaseSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'survey-list' );
  }

  onSelect ( survey: Survey ) {
    this.publishPageContext();
    this.router.navigate( ['/survey', survey.id] );
  }

  editSurvey ( survey: Survey ) {
    this.publishPageContext();

    if ( !this.userId || this.userId === 'user not logged in' ) {
      this.showPulseCrudLoginNotice();
      return;
    }

    this.surveyService.setSelectedSurvey( survey );
    this.router.navigate( ['/survey-edit'] );
  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'survey-list',
      context: {
        pageId: 'survey-list',
        feature: 'surveys',
        entityType: 'survey' },
      actions: this.buildPageActions() } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'survey-list-create',
        label: this.uid ? 'Create Pulse' : 'Sign In to Create',
        icon: this.uid ? 'fa-solid fa-square-poll-horizontal' : 'fa-solid fa-right-to-bracket',
        kind: 'callback',
        handler: () => {
          this.soundService.playSound('click');
          if ( this.uid ) {
            this.onClickRoute( '/survey-edit' );
            return;
          }
          this.showPulseCrudLoginNotice();
        },
        order: 10,
        group: 'context' },
      {
        id: 'survey-list-help',
        label: 'Help',
        icon: 'fa-solid fa-circle-question',
        kind: 'route',
        route: '/help',
        fragment: 'survey-list',
        order: 20,
        group: 'context' },
    ];
  }
}
