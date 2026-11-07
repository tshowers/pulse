/**
 * Renders the small Markdown subset paid Pulse reports use ("## "/"### "
 * headings, paragraphs, "- " bullets, "1. " steps, **bold**) to HTML.
 * Everything is escaped first, so a report can never inject markup; the
 * output is safe to bind with [innerHTML].
 */
function escapeHtml ( value: string ): string {
  return value.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
}

function inline ( text: string ): string {
  return escapeHtml( text ).replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' );
}

export function renderReportMarkdown ( markdown: string ): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if ( paragraph.length ) out.push( `<p>${inline( paragraph.join( ' ' ) )}</p>` );
    paragraph = [];
  };
  const closeList = () => {
    if ( list ) out.push( `</${list}>` );
    list = null;
  };

  for ( const raw of String( markdown || '' ).split( /\r?\n/ ) ) {
    const line = raw.trim();
    const heading = /^(#{2,4})\s+(.*)$/.exec( line );
    const bullet = /^[-*]\s+(.*)$/.exec( line );
    const step = /^\d+[.)]\s+(.*)$/.exec( line );
    if ( !line ) {
      flushParagraph();
      closeList();
    } else if ( heading ) {
      flushParagraph();
      closeList();
      const level = heading[1].length === 2 ? 'h2' : 'h3';
      out.push( `<${level}>${inline( heading[2] )}</${level}>` );
    } else if ( bullet || step ) {
      flushParagraph();
      const kind = bullet ? 'ul' : 'ol';
      if ( list !== kind ) {
        closeList();
        out.push( `<${kind}>` );
        list = kind;
      }
      out.push( `<li>${inline( ( bullet || step )![1] )}</li>` );
    } else {
      closeList();
      paragraph.push( line );
    }
  }
  flushParagraph();
  closeList();
  return out.join( '' );
}
