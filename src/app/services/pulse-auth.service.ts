import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of } from 'rxjs';

/**
 * Auth service for the standalone Pulse app. Sign-in itself no longer
 * happens here - it redirects to TODD's hosted login
 * (todd.taliferro.tech/login), the same page network-ios/pulse-ios open
 * via TODDAuthKit's HostedLogin (ASWebAuthenticationSession) and that
 * Network web now redirects to as well, so every TODD client presents the
 * identical sign-in screen instead of each maintaining its own copy of
 * Google/Apple/email-link/phone code that can drift out of sync (this
 * service previously offered Google + email/password only - a narrower,
 * inconsistent set). This service only holds the two things every client
 * still needs locally: completing the redirect back from that page, and
 * tenant/session reads.
 *
 * Mirrors the exact same resolution TODD's own `AuthService` uses
 * (`resolveAssignedTenantId`): `users/{uid}.companyId` if set, else the
 * uid itself is the tenant. Keeping this identical across every TODD
 * client is deliberate - independent reimplementations of the same rule
 * are fine; different *rules* would silently fragment which tenant a user
 * lands in depending which client they signed in from.
 */
@Injectable( { providedIn: 'root' } )
export class PulseAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

  private readonly pendingLoginStorageKey = 'pulse_hosted_login_pending';

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  /** Matches TODD's own AuthService.getUserId() shape - components ported
   * from features/survey/* call this by name, so keeping the signature
   * identical means the rest of a component's logic ports unchanged. */
  getUserId (): Observable<string> {
    if ( !this.userId$ ) {
      this.userId$ = new Observable<string>( ( subscriber ) => {
        const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user?.uid || '' ) );
        return unsubscribe;
      } ).pipe( shareReplay( { bufferSize: 1, refCount: false } ) );
    }
    return this.userId$;
  }

  /** Resolved once per session and shared - every ported component needs
   * this for `tenants/{tenantId}/...` reads, so it's cached here rather
   * than making each component re-resolve it. */
  getTenantId (): Observable<string> {
    if ( !this.tenantId$ ) {
      this.tenantId$ = this.getUserId().pipe(
        switchMap( ( uid ) => ( uid ? this.resolveTenantId( uid ) : of( '' ) ) ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.tenantId$;
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    return this.auth.currentUser?.uid || '';
  }

  /**
   * Leaves the app entirely for TODD's hosted login
   * (todd.taliferro.tech/login?client=pulse-web&state=...), the same page
   * every TODD client signs in through. `state` is a random value stashed
   * alongside `returnUrl` in sessionStorage before leaving, and checked
   * again in AuthCallbackComponent when the page sends the user back - a
   * CSRF guard against a forged callback.
   */
  signIn ( returnUrl?: string ): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem( this.pendingLoginStorageKey, JSON.stringify( { state, returnUrl } ) );
    const client = this.isLocalDevelopmentHost() ? 'pulse-web-local' : 'pulse-web';
    window.location.href = `https://todd.taliferro.tech/login?client=${client}&state=${state}`;
  }

  private isLocalDevelopmentHost (): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Reads back what signIn() stashed before leaving, verifies the state
   * value matches what the hosted login page is handing back, and clears
   * it either way so a stale/reused entry can't validate a later attempt.
   */
  consumePendingLogin ( state: string | null ): { returnUrl?: string } | null {
    const raw = sessionStorage.getItem( this.pendingLoginStorageKey );
    sessionStorage.removeItem( this.pendingLoginStorageKey );
    if ( !raw ) return null;

    try {
      const pending = JSON.parse( raw ) as { state: string; returnUrl?: string };
      if ( !state || pending.state !== state ) return null;
      return { returnUrl: pending.returnUrl };
    } catch {
      return null;
    }
  }

  /** Redeems the custom token AuthCallbackComponent received from the hosted login page. */
  async signInWithCustomToken ( token: string ): Promise<User> {
    const result = await signInWithCustomToken( this.auth, token );
    return result.user;
  }

  async signOut (): Promise<void> {
    await signOut( this.auth );
  }

  /**
   * Same rule as TODD's `users.service.ts`'s `getTenantLoggedInContactInfo`.
   */
  async resolveTenantId ( uid: string ): Promise<string> {
    const snap = await getDoc( doc( getFirestore(), 'users', uid ) );
    const companyId = String( ( snap.data() as any )?.companyId || '' ).trim();
    return companyId || uid;
  }
}
