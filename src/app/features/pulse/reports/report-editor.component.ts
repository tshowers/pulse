import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';

import { ReportFinding, ReportTile, StructuredReport } from '../../../models/pulse-report.model';

type ListText = 'questions' | 'heard' | 'projection' | `steps${number}` | `criteria${number}`;

const blankFinding = (): ReportFinding => ( { severity: 'medium', title: '', saw: '', why: '', assumption: '', good: '', when: '', owner: '' } );
const blankTile = (): ReportTile => ( { area: '', rating: 'amber', level: 2, label: 'At risk', note: '' } );

/**
 * Pulse > Reports: the owner edits a structured report field by field
 * (design handoff "Tech Rescue report redesign", 2026-11-09) instead of one
 * Markdown blob. Holds a working copy and emits it on every change; the
 * page saves it, and the server cleans it up (survey/pulseReportStructure.js).
 *
 * Fields that are lists of lines (steps, criteria, questions, the appendix
 * paragraphs, the cost projection) keep their own text while you type, so a
 * new empty line doesn't vanish under the cursor.
 */
@Component( {
  selector: 'app-report-editor',
  standalone: true,
  template: `
    @if (draft(); as d) {
    <div class="re">
      <fieldset class="re-group">
        <legend>Cover</legend>
        <div class="re-row">
          <label class="re-field"><span>Client</span><input [value]="d.client" (input)="set('client', val($event))" /></label>
          <label class="re-field"><span>Project</span><input [value]="d.project" (input)="set('project', val($event))" /></label>
        </div>
      </fieldset>

      <fieldset class="re-group">
        <legend>The verdict</legend>
        <div class="re-row">
          <label class="re-field re-field--narrow"><span>Status</span>
            <select [value]="d.status" (change)="set('status', val($event))">
              <option value="off_track">Off track</option><option value="at_risk">At risk</option><option value="on_track">On track</option>
            </select>
          </label>
          <label class="re-field"><span>Status note</span><input [value]="d.statusNote" (input)="set('statusNote', val($event))" placeholder="Recoverable in 30 days" /></label>
        </div>
        <label class="re-field"><span>Verdict (one sentence)</span><textarea rows="3" [value]="d.verdict" (input)="set('verdict', val($event))"></textarea></label>
        <span class="re-sub">Do these three things this week</span>
        @for (a of d.actions; track $index; let i = $index) {
          <div class="re-item">
            <label class="re-field"><span>Action {{ i + 1 }}</span><input [value]="a.title" (input)="setItem('actions', i, 'title', val($event))" /></label>
            <label class="re-field"><span>Why it helps</span><input [value]="a.detail" (input)="setItem('actions', i, 'detail', val($event))" /></label>
            <button type="button" class="re-x" (click)="remove('actions', i)" aria-label="Remove action">×</button>
          </div>
        }
        @if (d.actions.length < 3) { <button type="button" class="p-btn p-btn--sm" (click)="addAction()">Add an action</button> }
      </fieldset>

      <fieldset class="re-group">
        <legend>Health scorecard</legend>
        @for (t of d.scorecard; track $index; let i = $index) {
          <div class="re-item">
            <div class="re-row">
              <label class="re-field"><span>Area</span><input [value]="t.area" (input)="setItem('scorecard', i, 'area', val($event))" /></label>
              <label class="re-field re-field--narrow"><span>Rating</span>
                <select [value]="t.rating" (change)="setItem('scorecard', i, 'rating', val($event))"><option value="red">Red</option><option value="amber">Amber</option><option value="green">Green</option></select>
              </label>
              <label class="re-field re-field--tiny"><span>Meter (1-5)</span><input type="number" min="1" max="5" [value]="t.level" (input)="setItem('scorecard', i, 'level', num($event) || 1)" /></label>
              <label class="re-field re-field--narrow"><span>Label</span><input [value]="t.label" (input)="setItem('scorecard', i, 'label', val($event))" /></label>
            </div>
            <label class="re-field"><span>Note</span><input [value]="t.note" (input)="setItem('scorecard', i, 'note', val($event))" /></label>
            <button type="button" class="re-x" (click)="remove('scorecard', i)" aria-label="Remove area">×</button>
          </div>
        }
        @if (d.scorecard.length < 6) { <button type="button" class="p-btn p-btn--sm" (click)="addTile()">Add an area</button> }
      </fieldset>

      <fieldset class="re-group">
        <legend>The cost of waiting</legend>
        <label class="re-check"><input type="checkbox" [checked]="!!d.cost" (change)="toggleCost(checked($event))" /> Show this section (only when the client gave spend or delay numbers)</label>
        @if (d.cost; as c) {
          <div class="re-row">
            <label class="re-field"><span>Spent so far ($)</span><input type="number" [value]="c.spent ?? ''" (input)="setCost('spent', num($event))" /></label>
            <label class="re-field"><span>Months behind</span><input type="number" [value]="c.monthsBehind ?? ''" (input)="setCost('monthsBehind', num($event))" /></label>
            <label class="re-field"><span>Each further month ($)</span><input type="number" [value]="c.monthlyCost ?? ''" (input)="setCost('monthlyCost', num($event))" /></label>
          </div>
          <label class="re-field"><span>Headline</span><input [value]="c.headline" (input)="setCost('headline', val($event))" /></label>
          <label class="re-field"><span>Chart, one bar per line ("Today: 180000")</span><textarea rows="5" [value]="raw()['projection']" (input)="setList('projection', val($event))"></textarea></label>
          <label class="re-field"><span>Footnote</span><input [value]="c.footnote" (input)="setCost('footnote', val($event))" /></label>
        }
      </fieldset>

      <fieldset class="re-group">
        <legend>Findings (most severe first)</legend>
        @for (f of d.findings; track $index; let i = $index) {
          <div class="re-item">
            <div class="re-row">
              <label class="re-field re-field--narrow"><span>F{{ i + 1 }} severity</span>
                <select [value]="f.severity" (change)="setItem('findings', i, 'severity', val($event))"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select>
              </label>
              <label class="re-field"><span>Title</span><input [value]="f.title" (input)="setItem('findings', i, 'title', val($event))" /></label>
            </div>
            <div class="re-row">
              <label class="re-field"><span>When</span><input [value]="f.when" (input)="setItem('findings', i, 'when', val($event))" placeholder="Week 1" /></label>
              <label class="re-field"><span>Owner</span><input [value]="f.owner" (input)="setItem('findings', i, 'owner', val($event))" placeholder="Agency builds it · you verify" /></label>
            </div>
            <label class="re-field"><span>What we saw</span><textarea rows="3" [value]="f.saw" (input)="setItem('findings', i, 'saw', val($event))"></textarea></label>
            <label class="re-field"><span>Why it matters</span><textarea rows="3" [value]="f.why" (input)="setItem('findings', i, 'why', val($event))"></textarea></label>
            <label class="re-field"><span>Assumption (optional, shown in italics)</span><textarea rows="2" [value]="f.assumption" (input)="setItem('findings', i, 'assumption', val($event))"></textarea></label>
            <label class="re-field"><span>What good looks like</span><textarea rows="2" [value]="f.good" (input)="setItem('findings', i, 'good', val($event))"></textarea></label>
            <div class="re-moves">
              <button type="button" class="p-btn p-btn--sm" (click)="move('findings', i, -1)" [disabled]="i === 0">Move up</button>
              <button type="button" class="p-btn p-btn--sm" (click)="move('findings', i, 1)" [disabled]="i === d.findings.length - 1">Move down</button>
            </div>
            <button type="button" class="re-x" (click)="remove('findings', i)" aria-label="Remove finding">×</button>
          </div>
        }
        @if (d.findings.length < 8) { <button type="button" class="p-btn p-btn--sm" (click)="addFinding()">Add a finding</button> }
      </fieldset>

      <fieldset class="re-group">
        <legend>30-day recovery plan</legend>
        @for (w of d.plan; track $index; let i = $index) {
          <div class="re-item">
            <div class="re-row">
              <label class="re-field re-field--narrow"><span>Week</span><input [value]="w.week" (input)="setItem('plan', i, 'week', val($event))" /></label>
              <label class="re-field"><span>Title</span><input [value]="w.title" (input)="setItem('plan', i, 'title', val($event))" /></label>
            </div>
            <label class="re-field"><span>Steps, one per line</span><textarea rows="3" [value]="raw()['steps' + i]" (input)="setList('steps' + i, val($event))"></textarea></label>
            <label class="re-field"><span>Milestone</span><input [value]="w.milestone" (input)="setItem('plan', i, 'milestone', val($event))" /></label>
          </div>
        }
      </fieldset>

      <fieldset class="re-group">
        <legend>Keep, fix or replace</legend>
        <label class="re-check"><input type="checkbox" [checked]="!!d.decision" (change)="toggleDecision(checked($event))" /> Show this section (when there's a vendor or agency choice)</label>
        @if (d.decision; as dec) {
          <label class="re-field"><span>Intro</span><input [value]="dec.intro" (input)="setDecisionIntro(val($event))" /></label>
          @for (o of dec.options; track $index; let i = $index) {
            <div class="re-item">
              <div class="re-row">
                <label class="re-field"><span>Option</span><input [value]="o.name" (input)="setOption(i, 'name', val($event))" /></label>
                <label class="re-field re-field--narrow"><span>Color</span>
                  <select [value]="o.tone" (change)="setOption(i, 'tone', val($event))"><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option></select>
                </label>
                <label class="re-field re-field--narrow"><span>Tag</span><input [value]="o.tag" (input)="setOption(i, 'tag', val($event))" /></label>
              </div>
              <label class="re-field"><span>If (one condition per line)</span><textarea rows="3" [value]="raw()['criteria' + i]" (input)="setList('criteria' + i, val($event))"></textarea></label>
            </div>
          }
        }
      </fieldset>

      <fieldset class="re-group">
        <legend>Questions to ask</legend>
        <label class="re-field"><span>One question per line</span><textarea rows="6" [value]="raw()['questions']" (input)="setList('questions', val($event))"></textarea></label>
      </fieldset>

      <fieldset class="re-group">
        <legend>Appendix</legend>
        <label class="re-field"><span>What we heard (a blank line between paragraphs)</span><textarea rows="8" [value]="raw()['heard']" (input)="setList('heard', val($event))"></textarea></label>
        <label class="re-field"><span>Scope and method</span><textarea rows="3" [value]="d.scope" (input)="set('scope', val($event))"></textarea></label>
      </fieldset>
    </div>
    }
  `,
  styles: [`
    .re { display: flex; flex-direction: column; gap: 16px; }
    .re-group { border: 1px solid var(--surface2); border-radius: 16px; padding: 16px; margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .re-group legend { padding: 0 6px; font-weight: 700; font-size: 15px; }
    .re-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .re-row > .re-field { flex: 1 1 180px; }
    .re-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .re-field--narrow { flex: 0 1 150px !important; }
    .re-field--tiny { flex: 0 1 100px !important; }
    .re-field span { font-size: 12px; font-weight: 700; color: var(--muted); }
    .re-field input, .re-field select, .re-field textarea { font: 15px/1.45 var(--font); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--surface2); background: var(--bg); color: var(--text); box-sizing: border-box; width: 100%; }
    .re-field textarea { resize: vertical; }
    .re-sub { font-size: 13px; font-weight: 700; margin-top: 6px; }
    .re-item { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 12px 40px 12px 12px; border-radius: 12px; background: var(--surface); }
    .re-x { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: var(--surface2); color: var(--text); cursor: pointer; font-size: 16px; line-height: 1; }
    .re-moves { display: flex; gap: 6px; }
    .re-check { display: flex; gap: 8px; align-items: center; font-size: 14px; color: var(--muted); }
    .p-btn--sm { align-self: flex-start; }
  `],
} )
export class ReportEditorComponent implements OnChanges {
  /** The saved report; a new value (another report picked, or saved) resets the copy. */
  @Input( { required: true } ) report!: StructuredReport;
  @Output() readonly reportChange = new EventEmitter<StructuredReport>();

  readonly draft = signal<StructuredReport | null>( null );
  readonly raw = signal<Record<string, string>>( {} );

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes['report'] || !this.report ) return;
    // Our own emits come back as the same object; only a different report resets.
    if ( this.draft() && JSON.stringify( this.report ) === JSON.stringify( this.draft() ) ) return;
    const copy: StructuredReport = structuredClone( this.report );
    while ( copy.plan.length < 4 ) copy.plan.push( { week: `Week ${copy.plan.length + 1}`, title: '', steps: [], milestone: '' } );
    this.draft.set( copy );
    const raw: Record<string, string> = {
      questions: copy.questions.join( '\n' ),
      heard: copy.heard.join( '\n\n' ),
      projection: ( copy.cost?.projection || [] ).map( ( point ) => `${point.label}: ${point.value}` ).join( '\n' ),
    };
    copy.plan.forEach( ( week, i ) => raw[`steps${i}`] = week.steps.join( '\n' ) );
    ( copy.decision?.options || [] ).forEach( ( option, i ) => raw[`criteria${i}`] = option.criteria.join( '\n' ) );
    this.raw.set( raw );
  }

  val ( event: Event ): string {
    return ( event.target as HTMLInputElement ).value;
  }

  num ( event: Event ): number | null {
    const value = ( event.target as HTMLInputElement ).value.trim();
    return value === '' || Number.isNaN( Number( value ) ) ? null : Number( value );
  }

  checked ( event: Event ): boolean {
    return ( event.target as HTMLInputElement ).checked;
  }

  private update ( change: ( draft: StructuredReport ) => void ): void {
    const current = this.draft();
    if ( !current ) return;
    const next: StructuredReport = structuredClone( current );
    change( next );
    this.draft.set( next );
    this.reportChange.emit( next );
  }

  set ( key: 'client' | 'project' | 'status' | 'statusNote' | 'verdict' | 'scope', value: string ): void {
    this.update( ( d ) => ( d as any )[key] = value );
  }

  setItem ( list: 'actions' | 'scorecard' | 'findings' | 'plan', index: number, key: string, value: unknown ): void {
    this.update( ( d ) => ( ( d[list] as any[] )[index] as any )[key] = value );
  }

  remove ( list: 'actions' | 'scorecard' | 'findings', index: number ): void {
    this.update( ( d ) => ( d[list] as any[] ).splice( index, 1 ) );
  }

  move ( list: 'findings', index: number, by: number ): void {
    this.update( ( d ) => {
      const items = d[list];
      const [item] = items.splice( index, 1 );
      items.splice( index + by, 0, item );
    } );
  }

  addAction (): void { this.update( ( d ) => d.actions.push( { title: '', detail: '' } ) ); }
  addTile (): void { this.update( ( d ) => d.scorecard.push( blankTile() ) ); }
  addFinding (): void { this.update( ( d ) => d.findings.push( blankFinding() ) ); }

  toggleCost ( on: boolean ): void {
    this.update( ( d ) => d.cost = on ? { spent: null, monthsBehind: null, monthlyCost: null, projection: [], headline: '', footnote: 'Based on your own estimates.' } : null );
    if ( on ) this.raw.update( ( raw ) => ( { ...raw, projection: '' } ) );
  }

  setCost ( key: 'spent' | 'monthsBehind' | 'monthlyCost' | 'headline' | 'footnote', value: unknown ): void {
    this.update( ( d ) => { if ( d.cost ) ( d.cost as any )[key] = value; } );
  }

  toggleDecision ( on: boolean ): void {
    this.update( ( d ) => d.decision = on ? { intro: '', options: [
      { name: 'Keep', tone: 'green', tag: 'Best case', criteria: [] },
      { name: 'Fix', tone: 'amber', tag: 'Likely', criteria: [] },
      { name: 'Replace', tone: 'red', tag: 'Last resort', criteria: [] },
    ] } : null );
    if ( on ) this.raw.update( ( raw ) => ( { ...raw, criteria0: '', criteria1: '', criteria2: '' } ) );
  }

  setDecisionIntro ( value: string ): void {
    this.update( ( d ) => { if ( d.decision ) d.decision.intro = value; } );
  }

  setOption ( index: number, key: 'name' | 'tone' | 'tag', value: string ): void {
    this.update( ( d ) => { if ( d.decision?.options[index] ) ( d.decision.options[index] as any )[key] = value; } );
  }

  /** A list-of-lines field: keep the text as typed, store the parsed list. */
  setList ( key: ListText | string, text: string ): void {
    this.raw.update( ( raw ) => ( { ...raw, [key]: text } ) );
    const lines = text.split( '\n' ).map( ( line ) => line.trim() ).filter( Boolean );
    this.update( ( d ) => {
      if ( key === 'questions' ) d.questions = lines;
      else if ( key === 'heard' ) d.heard = text.split( /\n\s*\n/ ).map( ( p ) => p.trim() ).filter( Boolean );
      else if ( key === 'projection' && d.cost ) {
        d.cost.projection = lines.map( ( line ) => {
          const match = line.match( /^(.+?)\s*[:=]\s*\$?([\d,.]+)\s*([kKmM]?)$/ );
          if ( !match ) return null;
          const base = Number( match[2].replace( /,/g, '' ) );
          const scale = /k/i.test( match[3] ) ? 1_000 : /m/i.test( match[3] ) ? 1_000_000 : 1;
          return Number.isFinite( base ) ? { label: match[1].trim(), value: base * scale } : null;
        } ).filter( ( point ): point is { label: string; value: number; } => !!point );
      } else if ( key.startsWith( 'steps' ) ) {
        const week = d.plan[Number( key.slice( 5 ) )];
        if ( week ) week.steps = lines;
      } else if ( key.startsWith( 'criteria' ) ) {
        const option = d.decision?.options[Number( key.slice( 8 ) )];
        if ( option ) option.criteria = lines;
      }
    } );
  }
}
