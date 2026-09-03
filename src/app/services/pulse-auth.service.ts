import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of } from 'rxjs';

/**
 * Trimmed, purpose-built auth service for the standalone Pulse app - copied
 * from web-products/network's NetworkAuthService (same shape, same
 * tenant-resolution rule) rather than re-derived. Pulse serves the same
 * multi-tenant TODD customers as Network, so it needs the same real tenant
 * resolution, not a single-tenant shortcut.
 *
 * Mirrors the exact same resolution TODD's own `AuthService` uses
 * (`resolveAssignedTenantId`): `users/{uid}.companyId` if set, else the uid
 * itself is the tenant. Keeping this identical across every TODD client is
 * deliberate - independent reimplementations of the same rule are fine;
 * different *rules* would silently fragment which tenant a user lands in
 * depending which client they signed in from.
 */
@Injectable( { providedIn: 'root' } )
export class PulseAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

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

  async signInWithGoogle (): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup( this.auth, provider );
    return result.user;
  }

  async signInWithEmail ( email: string, password: string ): Promise<User> {
    const result = await signInWithEmailAndPassword( this.auth, email, password );
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
