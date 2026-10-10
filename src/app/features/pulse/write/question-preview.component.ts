import { Component, computed, input } from '@angular/core';

import { SurveyQuestion } from '../../../models/survey.model';
import { typeMeta } from '../pulse-state';

/** "What people see" (1c, right column): the selected question as a respondent gets it. */
@Component( {
  selector: 'app-question-preview',
  standalone: true,
  template: `
    <div class="qp">
      <span class="qp-progress"><span [style.width.%]="progress()"></span></span>
      <span class="qp-text" [class.is-empty]="!question().questionText.trim()">{{ question().questionText.trim() || 'Your question goes here' }}</span>
      @switch (kind()) {
        @case ('rating') {
          <div class="qp-scale">@for (n of scale; track n) { <span>{{ n }}</span> }</div>
          <div class="qp-ends"><span>Not likely</span><span>Very likely</span></div>
        }
        @case ('choice') {
          <div class="qp-options">
            @for (option of options(); track $index) {
              <span class="qp-option"><span class="qp-mark" [class.is-box]="question().questionType === 'checkbox'"></span>{{ option || 'Option ' + ($index + 1) }}</span>
            }
          </div>
        }
        @case ('yes_no') {
          <div class="qp-options">
            <span class="qp-option"><span class="qp-mark"></span>Yes</span>
            <span class="qp-option"><span class="qp-mark"></span>No</span>
          </div>
        }
        @case ('long') { <span class="qp-field qp-field--long">Type your answer</span> }
        @default { <span class="qp-field">{{ placeholder() }}</span> }
      }
    </div>
  `,
  styles: [`
    .qp { background: var(--bg); border-radius: 22px; padding: 22px 20px; display: flex; flex-direction: column; gap: 16px; }
    .qp-progress { height: 6px; border-radius: 999px; background: var(--surface2); display: block; overflow: hidden; }
    .qp-progress span { display: block; height: 100%; background: var(--blue); border-radius: 999px; }
    .qp-text { font-size: 19px; font-weight: 700; line-height: 1.35; letter-spacing: -0.01em; overflow-wrap: anywhere; }
    .qp-text.is-empty { color: var(--muted); }
    .qp-scale { display: flex; gap: 4px; }
    .qp-scale span { flex: 1; min-width: 0; height: 30px; border-radius: 999px; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .qp-ends { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
    .qp-options { display: flex; flex-direction: column; gap: 8px; }
    .qp-option { min-height: 40px; padding: 8px 14px; box-sizing: border-box; border-radius: 999px; background: var(--surface); display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
    .qp-mark { flex: none; width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--muted); }
    .qp-mark.is-box { border-radius: 5px; }
    .qp-field { height: 40px; border-radius: 999px; background: var(--surface); display: flex; align-items: center; padding: 0 16px; font-size: 14px; color: var(--muted); }
    .qp-field--long { height: 88px; border-radius: 18px; align-items: flex-start; padding-top: 12px; }
  `],
} )
export class QuestionPreviewComponent {
  readonly question = input.required<SurveyQuestion>();
  readonly index = input( 0 );
  readonly total = input( 1 );

  readonly scale = Array.from( { length: 11 }, ( _, n ) => n );

  readonly progress = computed( () => ( ( this.index() + 1 ) / Math.max( 1, this.total() ) ) * 100 );

  readonly kind = computed( () => {
    const type = this.question().questionType;
    if ( type === 'rating' ) return 'rating';
    if ( type === 'yes_no' ) return 'yes_no';
    if ( typeMeta( type ).usesOptions ) return 'choice';
    if ( type === 'textarea' ) return 'long';
    return 'short';
  } );

  readonly options = computed( () => {
    const options = this.question().options || [];
    return options.length ? options : ['', ''];
  } );

  readonly placeholder = computed( () => {
    switch ( this.question().questionType ) {
      case 'email': return 'name@example.com';
      case 'number': return '0';
      case 'date': return 'Pick a date';
      default: return 'Type your answer';
    }
  } );
}
