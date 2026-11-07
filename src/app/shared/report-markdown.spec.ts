import { renderReportMarkdown } from './report-markdown';

describe( 'renderReportMarkdown', () => {
  it( 'renders headings, lists, paragraphs and bold', () => {
    const html = renderReportMarkdown( '## Findings\n\n### Backups\n\nYou have **no** tested backup.\n\n- one\n- two\n\n1. first\n2. second' );
    expect( html ).toBe( '<h2>Findings</h2><h3>Backups</h3><p>You have <strong>no</strong> tested backup.</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>' );
  } );

  it( 'escapes any markup in the report', () => {
    expect( renderReportMarkdown( '<img src=x onerror=alert(1)>' ) ).toBe( '<p>&lt;img src=x onerror=alert(1)&gt;</p>' );
  } );
} );
