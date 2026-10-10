import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { filter } from 'rxjs';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

import { environment } from '../environments/environment';
import { PulseAuthService } from './services/pulse-auth.service';
import { ToastComponent } from './shared/toast/toast.component';
import { PulseHeaderComponent } from './shared/pulse-header/pulse-header.component';
import { PulseAssistantLauncherComponent } from './shared/page/assistant-box/pulse-assistant-launcher.component';
import packageJson from '../../package.json';
import { WriteAccessPromptComponent } from './shared/write-access/write-access-prompt.component';

@Component({
  selector: 'app-root',
  imports: [WriteAccessPromptComponent, RouterOutlet, ToastComponent, PulseHeaderComponent, PulseAssistantLauncherComponent, AsyncPipe, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly authService = inject( PulseAuthService );
  private readonly router = inject( Router );
  private readonly updates = inject( SwUpdate );
  private isReloadingForUpdate = false;
  private isRecoveringFromChunkError = false;
  private pendingUpdateVersion = '';
  readonly updateNoticeStorageKey = 'pulse-updated-version';
  readonly chunkRecoveryStorageKey = 'pulse-chunk-recovery-attempted';
  updateNotice = '';
  chunkRecoveryNeedsManualRefresh = false;
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );
  readonly isEmbedded = typeof window !== 'undefined'
    && new URLSearchParams( window.location.search ).get( 'embedded' ) === 'true';

  title = 'pulse';

  /** Routes with `data: { chrome: 'none' }` (the respondent's link, sign-in
   * handoffs) draw no header, so the page is the whole window. */
  showHeader = true;

  async signOut (): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl( '/' );
  }

  ngOnInit (): void {
    this.router.events.pipe( filter( event => event instanceof NavigationEnd ) ).subscribe( () => {
      this.showHeader = this.deepestRoute( this.router.routerState.snapshot.root ).data['chrome'] !== 'none';
    } );
    this.showUpdateNoticeAfterReload();
    if ( !environment.production ) return;
    window.addEventListener( 'error', this.handleWindowError, true );
    window.addEventListener( 'unhandledrejection', this.handleUnhandledRejection );
    this.updates.versionUpdates.subscribe( event => {
      if ( event.type === 'VERSION_READY' ) this.handleReadyUpdate( this.versionFromEvent( event ) || 'the latest version' );
    } );
    this.router.events.pipe( filter( event => event instanceof NavigationEnd ) ).subscribe( () => {
      if ( this.pendingUpdateVersion && !this.isEditingPulse() ) {
        const version = this.pendingUpdateVersion;
        this.pendingUpdateVersion = '';
        void this.activateAndReload( version );
      }
    } );
    void this.checkDeployedVersion();
    window.setInterval( () => void this.checkDeployedVersion(), 60_000 );
  }

  private readonly handleWindowError = ( event: ErrorEvent ): void => {
    const details = `${event.message || ''} ${event.filename || ''}`.toLowerCase();
    if ( this.isChunkLoadFailure( details ) ) void this.recoverFromChunkFailure();
  };

  private readonly handleUnhandledRejection = ( event: PromiseRejectionEvent ): void => {
    const reason = event.reason as { message?: string } | string | undefined;
    const details = typeof reason === 'string' ? reason : String( reason?.message || reason || '' );
    if ( this.isChunkLoadFailure( details.toLowerCase() ) ) void this.recoverFromChunkFailure();
  };

  private isChunkLoadFailure ( details: string ): boolean {
    return details.includes( 'failed to fetch dynamically imported module' ) || details.includes( 'loading chunk' ) || details.includes( 'expected a javascript module script' ) || details.includes( 'mime type of "text/html"' );
  }

  private async recoverFromChunkFailure (): Promise<void> {
    if ( this.isRecoveringFromChunkError ) return;
    this.isRecoveringFromChunkError = true;
    let alreadyAttempted = false;
    try {
      alreadyAttempted = sessionStorage.getItem( this.chunkRecoveryStorageKey ) === '1';
      if ( !alreadyAttempted ) sessionStorage.setItem( this.chunkRecoveryStorageKey, '1' );
    } catch { }
    if ( alreadyAttempted ) {
      this.updateNotice = 'Pulse needs a refresh to finish loading.';
      this.chunkRecoveryNeedsManualRefresh = true;
      this.isRecoveringFromChunkError = false;
      return;
    }
    this.updateNotice = 'Pulse was updated. Refreshing now…';
    try {
      if ( this.updates.isEnabled ) { await this.updates.checkForUpdate(); await this.updates.activateUpdate(); }
    } catch ( error ) { console.warn( '[PulseChunkRecovery] service worker refresh failed; reloading anyway', error ); }
    window.location.reload();
  }

  refreshAfterChunkError (): void {
    try { sessionStorage.removeItem( this.chunkRecoveryStorageKey ); } catch { }
    window.location.reload();
  }

  dismissUpdateNotice (): void { this.updateNotice = ''; }

  private showUpdateNoticeAfterReload (): void {
    try {
      const version = localStorage.getItem( this.updateNoticeStorageKey );
      if ( !version ) return;
      localStorage.removeItem( this.updateNoticeStorageKey );
      this.updateNotice = `Pulse has been updated to ${version}.`;
    } catch { }
  }

  private async checkDeployedVersion (): Promise<void> {
    try {
      const response = await fetch( `/assets/version.json?t=${Date.now()}`, { cache: 'no-store' } );
      if ( !response.ok ) return;
      const payload = await response.json() as { version?: string };
      const deployed = String( payload.version || '' ).trim();
      const current = String( packageJson.version || '' ).trim();
      if ( deployed && current && deployed !== current ) {
        if ( this.isEditingPulse() ) {
          this.pendingUpdateVersion = deployed;
          this.updateNotice = `Pulse has been updated to ${deployed}. It will refresh when you leave this screen.`;
          return;
        }
        await this.activateAndReload( deployed );
      }
    } catch ( error ) { console.warn( '[PulseVersionCheck] unable to check deployed version', error ); }
  }

  private handleReadyUpdate ( version: string ): void {
    if ( this.isEditingPulse() ) {
      this.pendingUpdateVersion = version;
      this.updateNotice = `Pulse has been updated to ${version}. It will refresh when you leave this screen.`;
      return;
    }
    void this.activateAndReload( version );
  }

  private deepestRoute ( route: ActivatedRouteSnapshot ): ActivatedRouteSnapshot {
    let current = route;
    while ( current.firstChild ) current = current.firstChild;
    return current;
  }

  /** On the Write step an update waits until they leave, so autosave isn't cut off. */
  private isEditingPulse (): boolean {
    const path = this.router.url.split( '?' )[0];
    return path.startsWith( '/survey-edit' ) || /^\/survey\/[^/]+\/write/.test( path );
  }

  private async activateAndReload ( version: string ): Promise<void> {
    if ( this.isReloadingForUpdate ) return;
    this.isReloadingForUpdate = true;
    try { localStorage.setItem( this.updateNoticeStorageKey, version ); } catch { }
    if ( this.updates.isEnabled ) {
      try { await this.updates.checkForUpdate(); await this.updates.activateUpdate(); }
      catch ( error ) { console.warn( '[PulseVersionCheck] service worker activation failed; reloading anyway', error ); }
    }
    window.location.reload();
  }

  private versionFromEvent ( event: VersionReadyEvent ): string {
    const appData = event.latestVersion.appData as { version?: string } | undefined;
    return String( appData?.version || '' ).trim();
  }
}
