import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Survey } from '../../../models/survey.model';
import { PulseAssistantSignalService } from '../../../services/pulse-assistant-signal.service';
import { PulseAuthService } from '../../../services/pulse-auth.service';
import { PulseNotificationService } from '../../../services/pulse-notification.service';
import { SurveyApiService } from '../../../services/survey-api.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { NewPulseComponent } from '../new/new-pulse.component';
import {
  PulseAction,
  PulseStatus,
  STATUS_LABEL,
  STATUS_TINT,
  greeting,
  pulseActions,
  pulseHint,
  pulseLink,
  pulseMeta,
  pulseStatus,
} from '../pulse-state';

type Filter = 'all' | PulseStatus;

const LATER_KEY = 'pulse-next-move-later';
const LATER_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 60000;

interface Row {
  survey: Survey;
  status: PulseStatus;
  label: string;
  tint: string | null;
  meta: string;
  hint: string;
  newCount: number;
  primary: PulseAction;
  secondary: PulseAction | null;
}

/**
 * Pulses home (1a): TODD's latest next move across live pulses, then every
 * pulse with the one action it needs. With no pulses yet, New pulse (1b) is
 * the page. Replaces the Customer Health board and the old pulse list.
 */
@Component( {
  selector: 'app-pulses-home',
  standalone: true,
  imports: [RouterLink, IconComponent, NewPulseComponent],
  templateUrl: './pulses-home.component.html',
  styleUrl: './pulses-home.component.css',
} )
export class PulsesHomeComponent implements OnInit, OnDestroy {
  private readonly api = inject( SurveyApiService );
  private readonly auth = inject( PulseAuthService );
  private readonly router = inject( Router );
  private readonly notifications = inject( PulseNotificationService );
  private readonly assistant = inject( PulseAssistantSignalService );

  readonly surveys = signal<Survey[] | null>( null );
  readonly loadFailed = signal( false );
  readonly filter = signal<Filter>( 'all' );
  readonly firstName = signal( '' );
  readonly later = signal<Record<string, number>>( this.loadLater() );
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly hello = computed( () => greeting( this.firstName() ) );

  readonly rows = computed<Row[]>( () => ( this.surveys() || [] ).map( ( survey ) => {
    const status = pulseStatus( survey );
    const { primary, secondary } = pulseActions( survey );
    return {
      survey,
      status,
      label: STATUS_LABEL[status],
      tint: STATUS_TINT[status],
      meta: pulseMeta( survey ),
      hint: pulseHint( survey ),
      newCount: status === 'live' ? survey.newSinceViewed || 0 : 0,
      primary,
      secondary,
    };
  } ) );

  readonly counts = computed( () => {
    const rows = this.rows();
    return {
      all: rows.length,
      live: rows.filter( ( r ) => r.status === 'live' ).length,
      draft: rows.filter( ( r ) => r.status === 'draft' ).length,
      closed: rows.filter( ( r ) => r.status === 'closed' ).length,
    };
  } );

  readonly filters: { key: Filter; label: string; }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'draft', label: 'Drafts' },
    { key: 'closed', label: 'Closed' },
  ];

  readonly visibleRows = computed( () => {
    const order: Record<PulseStatus, number> = { live: 0, draft: 1, closed: 2 };
    const rows = this.filter() === 'all' ? this.rows() : this.rows().filter( ( r ) => r.status === this.filter() );
    return [...rows].sort( ( a, b ) => order[a.status] - order[b.status] ||
      String( b.survey.lastResponseAt || b.survey.updatedAt || '' ).localeCompare( String( a.survey.lastResponseAt || a.survey.updatedAt || '' ) ) );
  } );

  /** The newest next move from a live pulse that wasn't put off with Later. */
  readonly nextMove = computed( () => {
    const now = Date.now();
    const candidates = ( this.surveys() || [] )
      .filter( ( s ) => s.status === 'published' && s.insights?.nextMove && !( this.later()[s.insights.nextMove.id] > now ) )
      .sort( ( a, b ) => String( b.insights?.updatedAt || '' ).localeCompare( String( a.insights?.updatedAt || '' ) ) );
    const survey = candidates[0];
    return survey ? { survey, text: survey.insights!.nextMove!.text, moveId: survey.insights!.nextMove!.id } : null;
  } );

  async ngOnInit (): Promise<void> {
    const signedIn = await firstValueFrom( this.auth.isLoggedIn().pipe( take( 1 ) ) );
    if ( !signedIn ) {
      await this.router.navigate( ['/'], { replaceUrl: true } );
      return;
    }
    this.auth.getUser().pipe( take( 1 ) ).subscribe( ( user ) => this.firstName.set( ( user?.displayName || '' ).split( ' ' )[0] ) );
    await firstValueFrom( this.auth.getTenantId().pipe( filter( ( id ) => !!id ), take( 1 ) ) );
    await this.load();
    this.refreshTimer = setInterval( () => {
      if ( document.visibilityState === 'visible' ) void this.load();
    }, REFRESH_MS );
  }

  ngOnDestroy (): void {
    if ( this.refreshTimer ) clearInterval( this.refreshTimer );
    this.assistant.clearPageContext();
  }

  async load (): Promise<void> {
    try {
      const result = await firstValueFrom( this.api.listSurveys( { pageSize: 100, filters: { sortBy: 'updatedAt', sortDirection: 'desc' } } ) );
      this.surveys.set( result.surveys || [] );
      this.loadFailed.set( false );
      this.assistant.setPageContext( {
        feature: 'pulse',
        page: 'home',
        mode: 'list',
        summary: this.counts(),
        dataPreview: { pulses: this.rows().slice( 0, 10 ).map( ( r ) => ( { title: r.survey.title, status: r.label, answers: r.survey.responseCount || 0 } ) ) },
      } );
    } catch {
      this.loadFailed.set( true );
      if ( !this.surveys() ) this.surveys.set( null );
    }
  }

  putOff ( moveId: string ): void {
    const next = { ...this.later(), [moveId]: Date.now() + LATER_MS };
    Object.keys( next ).forEach( ( key ) => { if ( next[key] < Date.now() ) delete next[key]; } );
    this.later.set( next );
    try { localStorage.setItem( LATER_KEY, JSON.stringify( next ) ); } catch { }
  }

  private loadLater (): Record<string, number> {
    try { return JSON.parse( localStorage.getItem( LATER_KEY ) || '{}' ) as Record<string, number>; } catch { return {}; }
  }

  async act ( row: Row, action: PulseAction ): Promise<void> {
    if ( action.kind === 'copy' ) {
      try {
        await navigator.clipboard.writeText( pulseLink( environment.PLATFORM_URL, row.survey.id! ) );
        this.notifications.show( 'Link copied', 'Paste it anywhere people will see it.', 'success' );
      } catch {
        this.notifications.show( "Couldn't copy", 'Long-press the link instead.', 'error' );
      }
      return;
    }
    if ( action.route ) await this.router.navigate( action.route );
  }
}
