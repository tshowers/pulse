import { Component } from '@angular/core';
import { TabBarComponent, TabBarItem } from '../tab-bar/tab-bar.component';

/**
 * Ported from network's app-primary-nav. survey-add, survey-list, and
 * survey-view each had their own way back to the dashboard (or none at
 * all), with no consistent way to move between them. pulse-home already
 * has this exact link set wired into its cockpit-command-deck via
 * app-tab-bar; this makes the same bar (and the same underlying
 * component) available to every other pulse-owner page.
 *
 * Points "Home" at /app, not pulse-home's own choice of '/' - pulse-home
 * IS the dashboard, so '/' there is a real "leave the app" exit to
 * marketing. Every other page here is one level below the dashboard, so
 * "Home" should return to it, not eject to marketing.
 */
@Component( {
  selector: 'app-primary-nav',
  standalone: true,
  imports: [TabBarComponent],
  templateUrl: './primary-nav.component.html',
  styleUrl: './primary-nav.component.css',
} )
export class PrimaryNavComponent {
  readonly tabs: TabBarItem[] = [
    { id: 'home', label: 'Home', icon: 'house', routerLink: '/app' },
    { id: 'create', label: 'Create Pulse', icon: 'square-poll-vertical', routerLink: '/survey-edit' },
    { id: 'list', label: 'Pulse List', icon: 'list-check', routerLink: '/survey-list' },
    { id: 'pricing', label: 'Pricing', icon: 'tag', routerLink: '/pricing' },
  ];
}
