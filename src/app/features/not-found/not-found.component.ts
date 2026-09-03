import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Ported verbatim from web-products/network's NotFoundComponent - fully
 * self-contained, no service dependencies. Not called out in the plan's
 * per-component list, but added anyway as the wildcard route's target so
 * an unmatched URL shows something instead of silently failing to
 * navigate, matching Network's own established convention.
 */
@Component( {
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
} )
export class NotFoundComponent { }
