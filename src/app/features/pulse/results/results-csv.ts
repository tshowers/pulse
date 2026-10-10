import { Survey } from '../../../models/survey.model';
import { SurveyResponseRecord } from '../../../services/survey-api.service';

/** One field, quoted when it has to be; leading = + - @ are defused so a spreadsheet won't run them. */
export function csvField ( value: unknown ): string {
  let text = Array.isArray( value ) ? value.join( '; ' ) : value === null || value === undefined ? '' : String( value );
  if ( /^[=+\-@\t\r]/.test( text ) ) text = `'${text}`;
  return /[",\r\n]/.test( text ) ? `"${text.replace( /"/g, '""' )}"` : text;
}

/** Every answer, one row per response, one column per question (Results → CSV). */
export function buildCsv ( survey: Survey, responses: SurveyResponseRecord[] ): string {
  const questions = survey.questions || [];
  const withIdentity = responses.some( ( response ) => response.respondent );
  const header = ['Submitted', ...( withIdentity ? ['Name', 'Email'] : [] ), ...questions.map( ( q ) => q.questionText || 'Untitled question' )];
  const rows = responses.map( ( response ) => {
    const answers = response.answers || {};
    return [
      new Date( response.submittedAt ).toISOString(),
      ...( withIdentity ? [response.respondent?.name || '', response.respondent?.email || ''] : [] ),
      ...questions.map( ( question ) => answers[question.id || ''] ?? '' ),
    ];
  } );
  return `﻿${[header, ...rows].map( ( row ) => row.map( csvField ).join( ',' ) ).join( '\r\n' )}\r\n`;
}
