import { buildCsv, csvField } from './results-csv';

describe( 'results-csv', () => {
  it( 'quotes commas, quotes and new lines, and defuses spreadsheet formulas', () => {
    expect( csvField( 'plain' ) ).toBe( 'plain' );
    expect( csvField( 'a, b' ) ).toBe( '"a, b"' );
    expect( csvField( 'say "hi"' ) ).toBe( '"say ""hi"""' );
    expect( csvField( '=HYPERLINK("x")' ) ).toBe( '"\'=HYPERLINK(""x"")"' );
    expect( csvField( ['Hosting', 'Web app'] ) ).toBe( 'Hosting; Web app' );
    expect( csvField( 9 ) ).toBe( '9' );
  } );

  it( 'writes one column per question, by question id, with names only when collected', () => {
    const survey = {
      title: 'Q4',
      description: '',
      questions: [
        { id: 'q1', questionText: 'Score', questionType: 'rating', options: [] },
        { id: 'q2', questionText: 'Why?', questionType: 'textarea', options: [] },
      ],
    };
    const csv = buildCsv( survey, [
      { id: 'r1', surveyId: 's', tenantId: 't', submittedAt: '2026-10-09T10:00:00.000Z', responses: [], answers: { q2: 'Faster replies', q1: 9 }, respondent: { name: 'Ann', email: 'ann@example.com' } },
      { id: 'r2', surveyId: 's', tenantId: 't', submittedAt: '2026-10-08T10:00:00.000Z', responses: [], answers: { q1: 7 } },
    ] );
    const lines = csv.replace( /^﻿/, '' ).trim().split( '\r\n' );
    expect( lines[0] ).toBe( 'Submitted,Name,Email,Score,Why?' );
    expect( lines[1] ).toBe( '2026-10-09T10:00:00.000Z,Ann,ann@example.com,9,Faster replies' );
    expect( lines[2] ).toBe( '2026-10-08T10:00:00.000Z,,,7,' );
  } );
} );
