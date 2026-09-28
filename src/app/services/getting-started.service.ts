import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GettingStartedStep {
  id: 'profile' | 'createSurvey' | 'shareSurvey' | 'firstResponse' | string;
  title: string;
  detail: string;
  done: boolean;
}

export interface GettingStarted {
  steps: GettingStartedStep[];
  completedSteps: number;
  totalSteps: number;
  allDone: boolean;
}

/**
 * Pulse's Getting Started checklist (`GET /api/getting-started/pulse`) -
 * profile, a survey created, published, first response - the same data
 * pulse-ios shows. On the Help page, and opened after sign-in while steps
 * remain. Mirrors Network web's getting-started.service.ts.
 */
@Injectable( { providedIn: 'root' } )
export class GettingStartedService {
  private readonly showAfterSignInKey = 'pulse_getting_started_show_after_sign_in';
  private readonly shownThisSessionKey = 'pulse_getting_started_shown';

  constructor ( private readonly http: HttpClient ) { }

  async load (): Promise<GettingStarted | null> {
    const user = getAuth().currentUser;
    if ( !user ) return null;
    const response = await firstValueFrom( this.http.get<{ data: GettingStarted }>(
      `${environment.backendURL}/getting-started/pulse`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
    ) );
    return response.data;
  }

  get showAfterSignIn (): boolean {
    try { return localStorage.getItem( this.showAfterSignInKey ) !== 'false'; } catch { return true; }
  }

  set showAfterSignIn ( value: boolean ) {
    try { localStorage.setItem( this.showAfterSignInKey, String( value ) ); } catch { }
  }

  /** True at most once per browser session while steps remain. Never throws. */
  async shouldShowAfterSignIn (): Promise<boolean> {
    try {
      if ( !this.showAfterSignIn || sessionStorage.getItem( this.shownThisSessionKey ) ) return false;
      const progress = await this.load();
      if ( !progress || progress.allDone ) return false;
      sessionStorage.setItem( this.shownThisSessionKey, '1' );
      return true;
    } catch {
      return false;
    }
  }

  routeFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return '/profile';
      case 'createSurvey': return '/survey-edit';
      default: return '/survey-list';
    }
  }

  actionFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return step.done ? 'View profile' : 'Complete profile';
      case 'createSurvey': return step.done ? 'Create another' : 'Create a survey';
      case 'shareSurvey': return step.done ? 'View surveys' : 'Publish a survey';
      default: return step.done ? 'See responses' : 'Share your link';
    }
  }
}
