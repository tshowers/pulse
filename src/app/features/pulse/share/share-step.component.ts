import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';

import { environment } from '../../../../environments/environment';
import { SurveyCloseRule } from '../../../models/survey.model';
import { PulseNotificationService } from '../../../services/pulse-notification.service';
import { SurveyApiService } from '../../../services/survey-api.service';
import { WriteAccessService, WriteAccessState } from '../../../services/write-access.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PulseBarComponent } from '../shell/pulse-bar.component';
import { PulseStore } from '../pulse.store';
import { plural, publishBlockers, pulseLink, pulseStatus, shortDate } from '../pulse-state';

const DEFAULT_CLOSE_COUNT = 50;

/**
 * Step 2, Share. Before publishing (1d): a quick check, when to stop taking
 * answers, names or anonymous, and Publish. After (1e): the link is the
 * whole screen, plus answers so far, TODD's note and Close / Back to draft.
 *
 * Writing is free; publishing is paid. Without the plan the button reads
 * "Choose a plan to publish" and goes to /pricing.
 */
@Component( {
  selector: 'app-share-step',
  standalone: true,
  imports: [PulseBarComponent, IconComponent, RouterLink],
  templateUrl: './share-step.component.html',
  styleUrl: './share-step.component.css',
} )
export class ShareStepComponent implements OnInit {
  readonly store = inject( PulseStore );
  private readonly api = inject( SurveyApiService );
  private readonly router = inject( Router );
  private readonly notifications = inject( PulseNotificationService );
  private readonly writeAccess = inject( WriteAccessService );

  readonly survey = computed( () => this.store.survey()! );
  readonly status = computed( () => pulseStatus( this.survey() ) );
  readonly blockers = computed( () => publishBlockers( this.survey() ) );
  readonly link = computed( () => pulseLink( environment.PLATFORM_URL, this.survey().id || '' ) );
  readonly linkLabel = computed( () => this.link().replace( /^https?:\/\//, '' ) );
  readonly closeRule = computed<SurveyCloseRule>( () => this.survey().closeRule || { type: 'manual', value: null } );
  readonly collectIdentity = computed( () => this.survey().collectIdentity === true );
  readonly count = computed( () => this.survey().responseCount || 0 );

  readonly access = signal<WriteAccessState | 'loading'>( 'loading' );
  readonly publishing = signal( false );
  readonly publishError = signal( '' );
  readonly busy = signal<'close' | 'draft' | ''>( '' );
  readonly qr = signal<string>( '' );
  readonly today = new Date().toISOString().slice( 0, 10 );

  readonly checks = computed( () => {
    const survey = this.survey();
    const questions = survey.questions.length;
    return [
      { done: this.blockers().length === 0, text: this.blockers().length === 0 ? `${plural( questions, 'question' )}, each with a type and answers` : this.blockers()[0], action: 'Edit', route: 'write' },
      { done: !!survey.title.trim() && !!survey.description.trim(), text: survey.description.trim() ? 'Title and intro are written' : 'Add a one-line intro so people know why you\'re asking', action: 'Edit', route: 'write' },
      { done: !!survey.triedAt, text: survey.triedAt ? 'You tried it as a respondent' : 'Try it the way people will see it', action: survey.triedAt ? 'Try again' : 'Try it', route: null },
    ];
  } );

  readonly settingsLine = computed( () => {
    const rule = this.closeRule();
    const until = rule.type === 'date' && rule.value ? `until ${shortDate( String( rule.value ) )}` :
      rule.type === 'count' && rule.value ? `until ${rule.value} answers` : 'until you close it';
    return `Taking answers ${until} · ${this.collectIdentity() ? 'asks for name and email' : 'anonymous'}`;
  } );

  constructor () {
    const stop = this.store.startPolling();
    inject( DestroyRef ).onDestroy( stop );
  }

  ngOnInit (): void {
    this.writeAccess.state( 'pulse' ).subscribe( ( state ) => this.access.set( state ) );
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  setCloseType ( type: SurveyCloseRule['type'] ): void {
    const value = type === 'count' ? DEFAULT_CLOSE_COUNT : type === 'date' ? this.defaultCloseDate() : null;
    this.store.patch( ( draft ) => { draft.closeRule = { type, value }; } );
  }

  setCloseCount ( raw: string ): void {
    const value = Math.max( 1, Math.min( 100000, Math.floor( Number( raw ) || DEFAULT_CLOSE_COUNT ) ) );
    this.store.patch( ( draft ) => { draft.closeRule = { type: 'count', value }; } );
  }

  setCloseDate ( raw: string ): void {
    if ( !raw ) return;
    // End of that day, local time.
    const value = new Date( `${raw}T23:59:00` ).toISOString();
    this.store.patch( ( draft ) => { draft.closeRule = { type: 'date', value }; } );
  }

  closeDateInput (): string {
    const value = this.closeRule().value;
    if ( this.closeRule().type !== 'date' || !value ) return '';
    const date = new Date( String( value ) );
    return `${date.getFullYear()}-${String( date.getMonth() + 1 ).padStart( 2, '0' )}-${String( date.getDate() ).padStart( 2, '0' )}`;
  }

  setIdentity ( value: boolean ): void {
    this.store.patch( ( draft ) => { draft.collectIdentity = value; } );
  }

  private defaultCloseDate (): string {
    const date = new Date();
    date.setDate( date.getDate() + 14 );
    date.setHours( 23, 59, 0, 0 );
    return date.toISOString();
  }

  // ── Publish and after ────────────────────────────────────────────────────

  async publish (): Promise<void> {
    if ( this.access() !== 'canWrite' ) {
      await this.router.navigate( ['/pricing'], { queryParams: { returnUrl: this.router.url } } );
      return;
    }
    this.publishing.set( true );
    this.publishError.set( '' );
    try {
      await this.store.flush();
      const survey = await firstValueFrom( this.api.publishSurvey( this.survey().id!, {
        closeRule: this.closeRule(),
        collectIdentity: this.collectIdentity(),
      } ) );
      this.store.replace( { ...this.survey(), ...survey } );
      window.scrollTo( { top: 0, behavior: 'smooth' } );
    } catch ( error ) {
      const body = ( error as HttpErrorResponse )?.error || {};
      if ( body.code === 'PAID_PLAN_REQUIRED' ) {
        this.access.set( 'browsing' );
        this.publishError.set( 'Publishing needs a Pulse plan. Writing and editing stay free.' );
      } else {
        this.publishError.set( body.error || "Couldn't publish. Check your connection and try again." );
      }
    } finally {
      this.publishing.set( false );
    }
  }

  async copyLink (): Promise<void> {
    try {
      await navigator.clipboard.writeText( this.link() );
      this.notifications.show( 'Link copied', 'Paste it anywhere people will see it.', 'success' );
    } catch {
      this.notifications.show( "Couldn't copy", 'Long-press the link instead.', 'error' );
    }
  }

  emailHref (): string {
    const subject = encodeURIComponent( this.survey().title || 'A quick question' );
    const body = encodeURIComponent( `${this.survey().description || 'Could you answer a few quick questions?'}\n\n${this.link()}` );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  smsHref (): string {
    return `sms:?&body=${encodeURIComponent( `${this.survey().title}: ${this.link()}` )}`;
  }

  async showQr (): Promise<void> {
    try {
      this.qr.set( await QRCode.toDataURL( this.link(), { margin: 1, width: 640, color: { dark: '#0f1115', light: '#ffffff' } } ) );
    } catch {
      this.notifications.show( "Couldn't make the QR code", 'Copy the link instead.', 'error' );
    }
  }

  tryIt (): void {
    window.open( this.router.serializeUrl( this.router.createUrlTree( ['/take', this.survey().id], { queryParams: { preview: 1 } } ) ), '_blank' );
    this.api.markTried( this.survey().id! ).subscribe( {
      next: ( survey ) => this.store.replace( { ...this.survey(), triedAt: survey.triedAt } ),
      error: () => undefined,
    } );
  }

  async closeNow (): Promise<void> {
    if ( !confirm( 'Stop taking answers? You can reopen it later.' ) ) return;
    await this.run( 'close', () => this.api.closeSurvey( this.survey().id! ) );
  }

  async backToDraft (): Promise<void> {
    if ( !confirm( 'Move it back to draft? The link stops working until you publish again. Answers you have are kept.' ) ) return;
    const ok = await this.run( 'draft', () => this.api.unpublishSurvey( this.survey().id! ) );
    if ( ok ) await this.router.navigate( ['/survey', this.survey().id, 'write'] );
  }

  private async run ( kind: 'close' | 'draft', call: () => ReturnType<SurveyApiService['closeSurvey']> ): Promise<boolean> {
    this.busy.set( kind );
    try {
      const survey = await firstValueFrom( call() );
      this.store.replace( { ...this.survey(), ...survey } );
      return true;
    } catch {
      this.notifications.show( "That didn't work", 'Try again in a moment.', 'error' );
      return false;
    } finally {
      this.busy.set( '' );
    }
  }
}
