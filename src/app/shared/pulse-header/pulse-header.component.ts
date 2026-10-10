import { isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, Output, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeMode, currentTheme, toggleTheme } from '@taliferro/ui/platform/theme';

import { IconComponent } from '../icon/icon.component';
import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

interface HeaderTab { label: string; route: string; also?: string[]; exact?: boolean; }

const SIGNED_IN_TABS: HeaderTab[] = [
  { label: 'Pulses', route: '/app', also: ['/survey'] },
  { label: 'Help', route: '/help' },
];

const SIGNED_OUT_TABS: HeaderTab[] = [
  { label: 'Home', route: '/', exact: true },
  { label: 'About', route: '/about' },
  { label: 'Help', route: '/help' },
];

/**
 * The Pulse header (design_handoff_todd_pulse, "Information architecture"):
 * TODD Pulse logo; Pulses and Help when signed in, Home, About and Help when
 * not; New pulse on Pulses home and Help; the theme pill and the Menu pill
 * (taliferro-ui/styles/app-header.css). One Menu button per screen.
 */
@Component( {
  selector: 'app-pulse-header',
  standalone: true,
  imports: [RouterLink, PlatformMenuComponent, IconComponent],
  templateUrl: './pulse-header.component.html',
  styleUrl: './pulse-header.component.css',
} )
export class PulseHeaderComponent {
  @Input() isLoggedIn = false;
  @Input() isAdmin = false;
  @Input() userName = '';
  @Input() userEmail = '';
  @Output() readonly signOut = new EventEmitter<void>();

  private readonly router = inject( Router );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly theme = signal<ThemeMode>( 'light' );
  readonly path = signal( '' );

  constructor () {
    if ( this.isBrowser ) this.theme.set( currentTheme() );
    this.path.set( this.router.url.split( /[?#]/ )[0] );
    this.router.events.pipe( filter( ( e ) => e instanceof NavigationEnd ) )
      .subscribe( ( e ) => this.path.set( ( e as NavigationEnd ).urlAfterRedirects.split( /[?#]/ )[0] ) );
  }

  get tabs (): HeaderTab[] {
    return this.isLoggedIn ? SIGNED_IN_TABS : SIGNED_OUT_TABS;
  }

  isActive ( tab: HeaderTab ): boolean {
    const path = this.path();
    if ( tab.exact ) return path === tab.route;
    return path === tab.route || path.startsWith( `${tab.route}/` ) || ( tab.also || [] ).some( ( prefix ) => path.startsWith( prefix ) );
  }

  /** New pulse sits on the two signed-in pages that aren't a pulse (1a, 2c). */
  get showNewPulse (): boolean {
    return this.isLoggedIn && ['/app', '/help'].includes( this.path() );
  }

  toggleTheme (): void {
    this.theme.set( toggleTheme() );
    window.dispatchEvent( new CustomEvent( 'platform-theme-change', { detail: { theme: this.theme() } } ) );
  }
}
