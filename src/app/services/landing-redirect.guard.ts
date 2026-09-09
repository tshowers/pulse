import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { PulseAuthService } from './pulse-auth.service';

export const landingRedirectGuard: CanActivateFn = () => {
  const authService = inject( PulseAuthService );
  const router = inject( Router );

  return authService.isLoggedIn().pipe(
    take( 1 ),
    map( isLoggedIn => isLoggedIn ? router.createUrlTree( ['/app'] ) : true ),
  );
};
