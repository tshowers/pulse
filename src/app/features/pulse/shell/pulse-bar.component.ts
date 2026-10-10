import { Component, Input, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Survey } from '../../../models/survey.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PulseStep, StepState, stepStates } from '../pulse-state';

/**
 * The bar at the top of every pulse screen (1c-1f): back, the title with a
 * status line, the Write / Share / Results step bar, and the step's own
 * buttons (projected). Results has no link until the pulse has been
 * published once.
 */
@Component( {
  selector: 'app-pulse-bar',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="pb">
      <a class="p-btn p-btn--round pb-back" routerLink="/app" aria-label="Back to Pulses"><app-icon name="back" /></a>
      <div class="pb-title">
        <span class="pb-name">{{ survey().title || 'Untitled pulse' }}</span>
        <span class="pb-sub" [class.is-live]="tone === 'live'">
          @if (tone === 'live' && dot) { <span class="pb-dot"></span> }
          {{ subtitle }}
        </span>
      </div>
      <nav class="pb-steps" aria-label="Steps">
        @for (step of steps(); track step.key) {
          @if (step.state === 'locked') {
            <span class="pb-step is-locked" title="Results open after you publish">
              <span class="pb-step__n">{{ step.n }}</span>{{ step.label }}
            </span>
          } @else {
            <a class="pb-step" [class.is-on]="step.state === 'on'" [class.is-done]="step.state === 'done'"
              [routerLink]="['/survey', survey().id, step.key]" [attr.aria-current]="step.state === 'on' ? 'step' : null">
              <span class="pb-step__n">
                @if (step.state === 'done') { <app-icon name="check" [size]="14" /> } @else { {{ step.n }} }
              </span>{{ step.label }}
            </a>
          }
        }
      </nav>
      <div class="pb-actions"><ng-content /></div>
    </div>
  `,
  styleUrl: './pulse-bar.component.css',
} )
export class PulseBarComponent {
  readonly survey = input.required<Survey>();
  readonly step = input.required<PulseStep>();
  @Input() subtitle = '';
  @Input() tone: 'muted' | 'live' = 'muted';
  @Input() dot = false;

  readonly steps = computed( () => {
    const states = stepStates( this.survey(), this.step() );
    return ( [
      { key: 'write', label: 'Write', n: 1 },
      { key: 'share', label: 'Share', n: 2 },
      { key: 'results', label: 'Results', n: 3 },
    ] as const ).map( ( step ) => ( { ...step, state: states[step.key] as StepState } ) );
  } );
}
