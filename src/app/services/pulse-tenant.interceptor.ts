import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { PulseAuthService } from './pulse-auth.service';

/**
 * This app never had a tenant/user identity interceptor - every backend
 * survey request (SurveyApiService) went out with no Authorization,
 * X-Tenant-Id, or X-User-Id header at all, so the backend's
 * getUserContext() (surveys.controller.js) always resolved tenantId/userId
 * to null and every request was silently scoped to nobody, regardless of
 * who was actually signed in. Waits on the resolved tenant (rather than
 * reading a sync cache like the monorepo's tenant.interceptor.ts does) so
 * there's no race between this firing and PulseAuthService.getTenantId()'s
 * Firestore lookup finishing.
 */
function isBackendApiRequest ( url: string ): boolean {
  return url.startsWith( environment.backendURL );
}

export const pulseTenantInterceptor: HttpInterceptorFn = ( req, next ) => {
  if ( !isBackendApiRequest( req.url ) ) {
    return next( req );
  }

  const authService = inject( PulseAuthService );

  return authService.getTenantId().pipe(
    take( 1 ),
    switchMap( tenantId => {
      const userId = authService.getCurrentUserIdSync();
      if ( !tenantId || !userId ) {
        return next( req );
      }

      const cloned = req.clone( {
        setHeaders: {
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      } );
      return next( cloned );
    } )
  );
};
