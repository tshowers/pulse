import { Component } from '@angular/core';

/**
 * The animated Pulse mark: the tile with a signal running along the
 * heartbeat line. Brought back from the pre-redesign landing hero. With
 * reduced motion it shows the line still.
 */
@Component( {
  selector: 'app-pulse-logo',
  standalone: true,
  template: `
    <div class="pl" role="img" aria-label="Pulse">
      <svg class="pl__svg" viewBox="0 0 304 298" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="pl-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#123d8b" />
            <stop offset="1" stop-color="#061b4e" />
          </linearGradient>
        </defs>
        <rect class="pl__tile" x="5" y="5" width="294" height="278" rx="73" fill="url(#pl-gradient)" />
        <path class="pl__wave pl__wave--base" pathLength="1" d="M42 149 H80 L91 149 L101 121 L111 177 L124 97 L140 193 L153 64 L171 233 L188 101 L202 184 L214 122 L226 149 H262" />
        <path class="pl__wave pl__wave--signal" pathLength="1" d="M42 149 H80 L91 149 L101 121 L111 177 L124 97 L140 193 L153 64 L171 233 L188 101 L202 184 L214 122 L226 149 H262" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pl {
      width: 100%;
      aspect-ratio: 304 / 298;
      border-radius: 24%;
      overflow: hidden;
      filter: drop-shadow(0 24px 48px rgba(6, 27, 78, .28)) drop-shadow(0 0 40px rgba(0, 191, 255, .10));
    }
    .pl__svg { display: block; width: 100%; height: 100%; }
    .pl__tile { stroke: #020b22; stroke-width: 4; }
    .pl__wave { fill: none; stroke: #a7e5ff; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
    .pl__wave--base { opacity: .2; }
    .pl__wave--signal {
      opacity: 0;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: pl-wave-run 3.6s ease-in-out infinite;
      filter: drop-shadow(0 0 5px rgba(167, 229, 255, .7));
    }
    @keyframes pl-wave-run {
      0%, 8% { opacity: 0; stroke-dashoffset: 1; }
      16% { opacity: 1; }
      62%, 78% { opacity: 1; stroke-dashoffset: 0; }
      100% { opacity: 0; stroke-dashoffset: -1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pl__wave--base { opacity: 1; }
      .pl__wave--signal { opacity: 1; stroke-dashoffset: 0; animation: none; filter: none; }
    }
  `],
} )
export class PulseLogoComponent { }
