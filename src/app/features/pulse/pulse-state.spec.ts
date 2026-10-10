import { Survey } from '../../models/survey.model';
import {
  blankQuestion,
  isQuestionComplete,
  publishBlockers,
  pulseActions,
  pulseHint,
  pulseMeta,
  pulseStatus,
  stepStates,
  typeMeta,
} from './pulse-state';
import { PULSE_TEMPLATES, templateQuestions } from './pulse-templates';

function survey ( overrides: Partial<Survey> = {} ): Survey {
  return {
    id: 's1',
    title: 'Q4 client check-in',
    description: 'Four quick questions.',
    status: 'draft',
    questions: [
      { id: 'q1', questionText: 'How likely are you to recommend us?', questionType: 'rating', options: [] },
      { id: 'q2', questionText: 'Will you renew?', questionType: 'multiple_choice', options: ['Yes', 'Not sure', 'No'] },
      { id: 'q3', questionText: 'What should we do better?', questionType: 'textarea', options: [] },
    ],
    responseCount: 0,
    ...overrides,
  };
}

/**
 * The one-primary-action table (design 1a). Pulsur's PulseState.swift
 * implements the same table; keep these cases in step with PulseStateTests.
 */
describe( 'pulse-state', () => {
  it( 'maps server status to Live / Draft / Closed', () => {
    expect( pulseStatus( { status: 'published' } ) ).toBe( 'live' );
    expect( pulseStatus( { status: 'archived' } ) ).toBe( 'closed' );
    expect( pulseStatus( { status: 'draft' } ) ).toBe( 'draft' );
    expect( pulseStatus( {} ) ).toBe( 'draft' );
  } );

  it( 'gives each state exactly one primary action', () => {
    expect( pulseActions( survey( { status: 'published' } ) ) ).toEqual( {
      primary: { label: 'See results', route: ['/survey', 's1', 'results'] },
      secondary: { label: 'Copy link', route: null, kind: 'copy' },
    } );
    expect( pulseActions( survey() ).primary.label ).toBe( 'Share' );
    expect( pulseActions( survey() ).secondary?.label ).toBe( 'Edit' );
    expect( pulseActions( survey( { title: '' } ) ) ).toEqual( { primary: { label: 'Keep writing', route: ['/survey', 's1', 'write'] }, secondary: null } );
    expect( pulseActions( survey( { status: 'archived' } ) ).secondary?.label ).toBe( 'Reopen' );
  } );

  it( 'blocks sharing until there is a title and every question is complete', () => {
    expect( publishBlockers( survey() ) ).toEqual( [] );
    expect( publishBlockers( survey( { title: ' ' } ) ) ).toEqual( ['Add a title'] );
    expect( publishBlockers( survey( { questions: [] } ) ) ).toEqual( ['Add a question'] );
    const oneOption = survey();
    oneOption.questions[1].options = ['Yes'];
    expect( publishBlockers( oneOption ) ).toEqual( ['Give question 2 at least two options'] );
    const blank = survey();
    blank.questions.push( blankQuestion() );
    expect( publishBlockers( blank ) ).toEqual( ['Finish question 4'] );
  } );

  it( 'only choice types need options', () => {
    expect( isQuestionComplete( { questionText: 'Rate us', questionType: 'rating', options: [] } ) ).toBeTrue();
    expect( isQuestionComplete( { questionText: 'Pick', questionType: 'checkbox', options: ['A', ' '] } ) ).toBeFalse();
    expect( typeMeta( 'checkbox' ).label ).toBe( 'Pick any' );
    expect( typeMeta( 'dropdown' ).label ).toBe( 'Dropdown' );
  } );

  it( 'locks Results until the pulse has been published once', () => {
    expect( stepStates( survey(), 'write' ) ).toEqual( { write: 'on', share: 'todo', results: 'locked' } );
    expect( stepStates( survey( { status: 'published' } ), 'share' ) ).toEqual( { write: 'done', share: 'on', results: 'todo' } );
    expect( stepStates( survey( { everPublished: true } ), 'write' ).results ).toBe( 'todo' );
    expect( stepStates( survey( { status: 'archived' } ), 'results' ) ).toEqual( { write: 'done', share: 'done', results: 'on' } );
  } );

  it( 'writes the row meta and hint (1a)', () => {
    expect( pulseMeta( survey() ) ).toBe( '3 questions · not shared yet' );
    expect( pulseMeta( survey( { status: 'published', responseCount: 38, publishedAt: '2026-10-02T15:00:00Z' } ) ) ).toBe( '3 questions · 38 answers · live since Oct 2' );
    expect( pulseHint( survey( { questions: [survey().questions[0]] } ) ) ).toBe( 'One question rarely tells you much. Add two more.' );
    expect( pulseHint( survey( { status: 'published', responseCount: 3 } ) ) ).toBe( 'TODD writes a summary after 5 answers. 3 so far.' );
    expect( pulseHint( survey( { status: 'archived', insights: { state: 'ready', answerCount: 52, updatedAt: '2026-08-30T10:00:00Z', summary: 'Most clients preferred monthly billing.', nextMove: null } } ) ) )
      .toBe( 'Most clients preferred monthly billing.' );
  } );

  it( 'gives template questions fresh, unique ids', () => {
    const first = templateQuestions( PULSE_TEMPLATES[0] );
    const second = templateQuestions( PULSE_TEMPLATES[0] );
    expect( first.length ).toBe( 4 );
    expect( new Set( [...first, ...second].map( ( q ) => q.id ) ).size ).toBe( 8 );
    PULSE_TEMPLATES.forEach( ( template ) => {
      expect( publishBlockers( { title: template.title, questions: templateQuestions( template ) } ) ).toEqual( [] );
    } );
  } );
} );
