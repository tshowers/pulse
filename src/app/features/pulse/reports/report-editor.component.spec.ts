import { StructuredReport } from '../../../models/pulse-report.model';
import { ReportEditorComponent } from './report-editor.component';

const REPORT: StructuredReport = {
  client: 'Acme', project: 'P', status: 'at_risk', statusNote: '', verdict: 'V', actions: [], scorecard: [],
  cost: { spent: 180000, monthsBehind: 3, monthlyCost: 15000, projection: [{ label: 'Today', value: 180000 }], headline: '', footnote: '' },
  findings: [], plan: [{ week: 'Week 1', title: 'Stop', steps: ['a'], milestone: '' }], decision: null,
  questions: ['One?'], heard: ['First.', 'Second.'], scope: '',
};

function editor (): { editor: ReportEditorComponent; emitted: StructuredReport[]; } {
  const component = new ReportEditorComponent();
  const emitted: StructuredReport[] = [];
  component.reportChange.subscribe( ( r ) => emitted.push( r ) );
  component.report = REPORT;
  component.ngOnChanges( { report: { currentValue: REPORT, previousValue: undefined, firstChange: true, isFirstChange: () => true } } );
  return { editor: component, emitted };
}

describe( 'the report editor', () => {
  it( 'starts from the report, with four plan weeks and its lists as text', () => {
    const { editor: e } = editor();
    expect( e.draft()!.plan.length ).toBe( 4 );
    expect( e.raw()['heard'] ).toBe( 'First.\n\nSecond.' );
    expect( e.raw()['projection'] ).toBe( 'Today: 180000' );
  } );

  it( 'keeps a line being typed in the text, and stores the parsed list', () => {
    const { editor: e, emitted } = editor();
    e.setList( 'questions', 'One?\nTwo?\n' );
    expect( e.raw()['questions'] ).toBe( 'One?\nTwo?\n' );
    expect( emitted.at( -1 )!.questions ).toEqual( ['One?', 'Two?'] );
  } );

  it( 'reads the chart lines, including $ and K', () => {
    const { editor: e, emitted } = editor();
    e.setList( 'projection', 'Today: 180000\nDec: $195K\nhalf typed' );
    expect( emitted.at( -1 )!.cost!.projection ).toEqual( [{ label: 'Today', value: 180000 }, { label: 'Dec', value: 195000 }] );
  } );

  it( 'turns a section off and on', () => {
    const { editor: e, emitted } = editor();
    e.toggleCost( false );
    expect( emitted.at( -1 )!.cost ).toBeNull();
    e.toggleDecision( true );
    expect( emitted.at( -1 )!.decision!.options.map( ( o ) => o.name ) ).toEqual( ['Keep', 'Fix', 'Replace'] );
  } );

  it( 'moves a finding without touching the saved report', () => {
    const { editor: e, emitted } = editor();
    e.addFinding();
    e.setItem( 'findings', 0, 'title', 'First' );
    e.addFinding();
    e.setItem( 'findings', 1, 'title', 'Second' );
    e.move( 'findings', 1, -1 );
    expect( emitted.at( -1 )!.findings.map( ( f ) => f.title ) ).toEqual( ['Second', 'First'] );
    expect( REPORT.findings ).toEqual( [] );
  } );
} );
