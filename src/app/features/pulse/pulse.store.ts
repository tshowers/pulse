import { DestroyRef, Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Survey } from '../../models/survey.model';
import { SurveyApiService } from '../../services/survey-api.service';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const SAVE_DEBOUNCE_MS = 1000;
const POLL_MS = 15000;

/** Fields only the server changes; a poll may refresh them mid-edit. */
const SERVER_FIELDS: ( keyof Survey )[] = [
  'status', 'visibility', 'responseCount', 'newSinceViewed', 'everPublished', 'publishedAt', 'closedAt',
  'triedAt', 'lastResponseAt', 'lastViewedAt', 'insights',
];

/**
 * One open pulse, shared by the Write, Share and Results steps
 * (PulseShellComponent provides it).
 *
 * - Autosave: every edit goes through patch(); a save starts 1s after the
 *   last edit and saves run one at a time, so the last edit always wins.
 *   Each save sends the revision it was based on, and a 409 (the same pulse
 *   saved on another device first) stops autosave and asks for a reload
 *   rather than overwriting.
 * - Live: while a step asks for it and the tab is visible, the pulse is
 *   re-read every 15s; `changes` ticks when answers, TODD's summary or the
 *   status moved, so Results can refetch.
 */
@Injectable()
export class PulseStore {
  private readonly api = inject( SurveyApiService );
  private readonly zone = inject( NgZone );

  readonly survey = signal<Survey | null>( null );
  readonly loading = signal( true );
  readonly loadError = signal<'not_found' | 'signed_out' | 'failed' | ''>( '' );
  readonly saveState = signal<SaveState>( 'idle' );
  readonly savedAt = signal<Date | null>( null );
  /** Ticks whenever a poll brings new answers, a new summary or a status change. */
  readonly changes = signal( 0 );

  readonly id = computed( () => this.survey()?.id || '' );

  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollers = 0;

  constructor () {
    inject( DestroyRef ).onDestroy( () => {
      this.stopTimers();
      void this.flush();
    } );
  }

  async load ( id: string ): Promise<void> {
    this.loading.set( true );
    this.loadError.set( '' );
    try {
      const survey = await firstValueFrom( this.api.getSurveyById( id ) );
      if ( !survey ) {
        this.loadError.set( 'not_found' );
      } else {
        this.survey.set( survey );
      }
    } catch ( error ) {
      const status = ( error as HttpErrorResponse )?.status;
      this.loadError.set( status === 404 ? 'not_found' : status === 401 ? 'signed_out' : 'failed' );
    } finally {
      this.loading.set( false );
    }
  }

  /** Apply an edit locally and schedule a save. */
  patch ( edit: ( draft: Survey ) => void ): void {
    const current = this.survey();
    if ( !current || this.saveState() === 'conflict' ) return;
    const draft: Survey = structuredClone( current );
    edit( draft );
    this.survey.set( draft );
    this.dirty = true;
    this.scheduleSave();
  }

  /** A server response that should replace local state (publish, close, reload). */
  replace ( survey: Survey ): void {
    this.survey.set( survey );
  }

  /** Save now if anything is waiting (before leaving Write, before Share). */
  async flush (): Promise<boolean> {
    if ( this.saveTimer ) {
      clearTimeout( this.saveTimer );
      this.saveTimer = null;
    }
    if ( this.saving ) await this.saving;
    if ( this.dirty ) await this.save();
    return this.saveState() !== 'error' && this.saveState() !== 'conflict';
  }

  retrySave (): void {
    if ( this.saveState() === 'error' ) {
      this.dirty = true;
      void this.flush();
    }
  }

  async reload (): Promise<void> {
    const id = this.id();
    this.dirty = false;
    this.saveState.set( 'idle' );
    if ( id ) await this.load( id );
  }

  private scheduleSave (): void {
    if ( this.saveTimer ) clearTimeout( this.saveTimer );
    this.saveTimer = setTimeout( () => {
      this.saveTimer = null;
      void this.save();
    }, SAVE_DEBOUNCE_MS );
  }

  private async save (): Promise<void> {
    if ( this.saving ) {
      await this.saving;
      if ( !this.dirty ) return;
    }
    const survey = this.survey();
    if ( !survey?.id || !this.dirty ) return;

    this.dirty = false;
    this.saveState.set( 'saving' );
    const body: Survey = {
      title: survey.title,
      description: survey.description,
      questions: survey.questions.map( ( question, index ) => ( { ...question, order: index } ) ),
      closeRule: survey.closeRule,
      collectIdentity: survey.collectIdentity,
      revision: survey.revision,
    };

    this.saving = ( async () => {
      try {
        const saved = await firstValueFrom( this.api.updateSurvey( survey.id!, body ) );
        // Keep any edits made while this save was in flight; take the
        // server's revision and timestamps.
        const latest = this.survey();
        if ( latest ) this.survey.set( { ...latest, revision: saved.revision, updatedAt: saved.updatedAt } );
        this.saveState.set( this.dirty ? 'saving' : 'saved' );
        this.savedAt.set( new Date() );
      } catch ( error ) {
        const status = ( error as HttpErrorResponse )?.status;
        this.saveState.set( status === 409 ? 'conflict' : 'error' );
        if ( status !== 409 ) this.dirty = true;
      } finally {
        this.saving = null;
      }
    } )();
    await this.saving;
    if ( this.dirty && this.saveState() === 'saving' ) await this.save();
  }

  // ── Live updates ───────────────────────────────────────────────────────

  /** Call from a step that shows live data; returns the stop function. */
  startPolling (): () => void {
    this.pollers += 1;
    if ( !this.pollTimer && typeof window !== 'undefined' ) {
      this.zone.runOutsideAngular( () => {
        this.pollTimer = setInterval( () => this.zone.run( () => void this.poll() ), POLL_MS );
      } );
    }
    let stopped = false;
    return () => {
      if ( stopped ) return;
      stopped = true;
      this.pollers -= 1;
      if ( this.pollers <= 0 && this.pollTimer ) {
        clearInterval( this.pollTimer );
        this.pollTimer = null;
      }
    };
  }

  async poll (): Promise<void> {
    const current = this.survey();
    if ( !current?.id || ( typeof document !== 'undefined' && document.visibilityState === 'hidden' ) ) return;
    try {
      const fresh = await firstValueFrom( this.api.getSurveyById( current.id ) );
      if ( !fresh ) return;
      const latest = this.survey() || current;
      const moved = fresh.responseCount !== latest.responseCount ||
        fresh.status !== latest.status ||
        fresh.insights?.updatedAt !== latest.insights?.updatedAt ||
        fresh.insights?.state !== latest.insights?.state ||
        fresh.insights?.nextMove?.id !== latest.insights?.nextMove?.id;
      if ( this.dirty || this.saving ) {
        const merged = { ...latest } as Record<string, unknown>;
        SERVER_FIELDS.forEach( ( field ) => { merged[field] = ( fresh as unknown as Record<string, unknown> )[field]; } );
        this.survey.set( merged as unknown as Survey );
      } else {
        this.survey.set( fresh );
      }
      if ( moved ) this.changes.update( ( n ) => n + 1 );
    } catch {
      // A missed poll is fine; the next one catches up.
    }
  }

  private stopTimers (): void {
    if ( this.saveTimer ) clearTimeout( this.saveTimer );
    if ( this.pollTimer ) clearInterval( this.pollTimer );
    this.pollTimer = null;
  }
}
