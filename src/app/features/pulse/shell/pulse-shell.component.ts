import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { firstValueFrom, filter, take } from 'rxjs';

import { PulseAuthService } from '../../../services/pulse-auth.service';
import { PulseStore } from '../pulse.store';

/**
 * /survey/:id - loads the pulse once for its three steps (write, share,
 * results) and provides the PulseStore they share. Signed out, it goes to
 * sign-in and comes back here.
 */
@Component( {
  selector: 'app-pulse-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  providers: [PulseStore],
  template: `
    @if (store.loading() && !store.survey()) {
      <div class="p-page shell-state" aria-busy="true"><span class="shell-spinner"></span></div>
    } @else if (store.loadError()) {
      <div class="p-page shell-state">
        <h1>{{ store.loadError() === 'not_found' ? "We couldn't find that pulse." : "This pulse didn't load." }}</h1>
        <p>{{ store.loadError() === 'not_found' ? 'It may have been deleted, or the link is from another account.' : 'Check your connection and try again.' }}</p>
        <div class="shell-actions">
          @if (store.loadError() !== 'not_found') { <button type="button" class="p-btn p-btn--primary" (click)="retry()">Try again</button> }
          <a class="p-btn" routerLink="/app">Back to Pulses</a>
        </div>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    .shell-state { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding-top: 64px; }
    .shell-state h1 { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
    .shell-state p { margin: 0; color: var(--muted); font-size: 17px; }
    .shell-actions { display: flex; gap: 8px; margin-top: 8px; }
    .shell-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface2); border-top-color: var(--blue); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
} )
export class PulseShellComponent implements OnInit {
  readonly store = inject( PulseStore );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly auth = inject( PulseAuthService );

  constructor () {
    effect( () => {
      if ( this.store.loadError() === 'signed_out' ) {
        void this.router.navigate( ['/login'], { queryParams: { returnUrl: this.router.url } } );
      }
    } );
  }

  async ngOnInit (): Promise<void> {
    const signedIn = await firstValueFrom( this.auth.isLoggedIn().pipe( take( 1 ) ) );
    if ( !signedIn ) {
      await this.router.navigate( ['/login'], { queryParams: { returnUrl: this.router.url } } );
      return;
    }
    // Survey calls carry the tenant header; wait until it's resolved.
    await firstValueFrom( this.auth.getTenantId().pipe( filter( ( id ) => !!id ), take( 1 ) ) );
    await this.store.load( this.route.snapshot.paramMap.get( 'id' ) || '' );
  }

  retry (): void {
    void this.store.load( this.route.snapshot.paramMap.get( 'id' ) || '' );
  }
}

/**
 * /survey/:id with no step: open the step the pulse is on. Old links to the
 * command view land here, as do sign-up drafts saved after sign-in.
 */
@Component( {
  selector: 'app-pulse-step-redirect',
  standalone: true,
  template: '',
} )
export class PulseStepRedirectComponent {
  private readonly store = inject( PulseStore );
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );

  constructor () {
    effect( () => {
      const survey = this.store.survey();
      if ( !survey ) return;
      const step = survey.status === 'published' ? 'share' : survey.status === 'archived' ? 'results' : 'write';
      void this.router.navigate( [step], { relativeTo: this.route, replaceUrl: true } );
    } );
  }
}
