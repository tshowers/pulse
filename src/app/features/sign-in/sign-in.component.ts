import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PulseAuthService } from '../../services/pulse-auth.service';

/**
 * Sign-in for Pulse - redirects to TODD's hosted login
 * (todd.taliferro.tech/login, the same page network-ios/pulse-ios open
 * via TODDAuthKit's HostedLogin, and that Network web now redirects to as
 * well) instead of rendering its own provider buttons. See
 * PulseAuthService.signIn() for the handoff. Pulse previously had no
 * working sign-in entry point in its UI at all - this route is new.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  isSigningIn = false;

  private returnUrl = '/app';

  constructor (
    private route: ActivatedRoute,
    private authService: PulseAuthService,
  ) { }

  ngOnInit (): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';
    // /login is a compatibility handoff route. Send visitors directly to
    // TODD's shared hosted login instead of making them click twice.
    this.signIn();
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
