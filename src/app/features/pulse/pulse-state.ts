import { Survey, SurveyQuestion, SurveyQuestionType } from '../../models/survey.model';

/**
 * The rules every Pulse screen shares (design_handoff_todd_pulse README:
 * "One primary action per state", the step bar, the type chips). Pure
 * functions, so Pulses home, the pulse bar and Pulsur's PulseState.swift can
 * all agree - keep the two in step.
 */

export type PulseStatus = 'live' | 'draft' | 'closed';
export type PulseStep = 'write' | 'share' | 'results';

export function pulseStatus ( survey: Pick<Survey, 'status'> ): PulseStatus {
  if ( survey.status === 'published' ) return 'live';
  if ( survey.status === 'archived' ) return 'closed';
  return 'draft';
}

export const STATUS_LABEL: Record<PulseStatus, string> = { live: 'Live', draft: 'Draft', closed: 'Closed' };
export const STATUS_TINT: Record<PulseStatus, string | null> = { live: 'green', draft: 'yellow', closed: null };

// ── Question types ─────────────────────────────────────────────────────────

export interface QuestionTypeMeta {
  type: SurveyQuestionType;
  label: string;
  icon: string;
  tint: string | null;
  usesOptions: boolean;
}

/** The six the builder offers, in chip order. */
export const BUILDER_TYPES: QuestionTypeMeta[] = [
  { type: 'text', label: 'Short answer', icon: 'text', tint: 'blue', usesOptions: false },
  { type: 'textarea', label: 'Long answer', icon: 'lines', tint: 'pink', usesOptions: false },
  { type: 'multiple_choice', label: 'One choice', icon: 'dot', tint: 'cyan', usesOptions: true },
  { type: 'checkbox', label: 'Pick any', icon: 'box', tint: 'green', usesOptions: true },
  { type: 'yes_no', label: 'Yes / No', icon: 'yn', tint: 'yellow', usesOptions: false },
  { type: 'rating', label: 'Rating', icon: 'star', tint: 'violet', usesOptions: false },
];

/** Older types still in the model; shown, and kept, if a pulse already uses one. */
const LEGACY_TYPES: QuestionTypeMeta[] = [
  { type: 'dropdown', label: 'Dropdown', icon: 'list', tint: 'cyan', usesOptions: true },
  { type: 'date', label: 'Date', icon: 'cal', tint: null, usesOptions: false },
  { type: 'email', label: 'Email', icon: 'at', tint: null, usesOptions: false },
  { type: 'number', label: 'Number', icon: 'hash', tint: null, usesOptions: false },
];

export function typeMeta ( type: string ): QuestionTypeMeta {
  return [...BUILDER_TYPES, ...LEGACY_TYPES].find( ( meta ) => meta.type === type ) || BUILDER_TYPES[0];
}

export function usesOptions ( type: string ): boolean {
  return typeMeta( type ).usesOptions;
}

export function isQuestionComplete ( question: SurveyQuestion ): boolean {
  if ( !question.questionText?.trim() ) return false;
  if ( usesOptions( question.questionType ) ) {
    return ( question.options || [] ).filter( ( option ) => option?.trim() ).length >= 2;
  }
  return true;
}

/**
 * What stops the pulse going to Share, in the words the Write step shows.
 * Mirrors the server's getPublishBlockers.
 */
export function publishBlockers ( survey: Pick<Survey, 'title' | 'questions'> ): string[] {
  const blockers: string[] = [];
  if ( !survey.title?.trim() ) blockers.push( 'Add a title' );
  const questions = survey.questions || [];
  if ( questions.length === 0 ) blockers.push( 'Add a question' );
  questions.forEach( ( question, index ) => {
    if ( isQuestionComplete( question ) ) return;
    blockers.push( usesOptions( question.questionType ) && question.questionText?.trim()
      ? `Give question ${index + 1} at least two options`
      : `Finish question ${index + 1}` );
  } );
  return blockers;
}

export function newQuestionId (): string {
  const bytes = new Uint8Array( 6 );
  crypto.getRandomValues( bytes );
  return `q_${Array.from( bytes, ( b ) => b.toString( 16 ).padStart( 2, '0' ) ).join( '' )}`;
}

export function blankQuestion ( type: SurveyQuestionType = 'text' ): SurveyQuestion {
  return {
    id: newQuestionId(),
    questionText: '',
    questionType: type,
    options: usesOptions( type ) ? ['', ''] : [],
    required: false,
    helpText: '',
    placeholder: '',
  };
}

// ── Steps and actions ──────────────────────────────────────────────────────

export type StepState = 'on' | 'done' | 'todo' | 'locked';

/** The step bar for `current`. Results stays locked until the first publish. */
export function stepStates ( survey: Survey, current: PulseStep ): Record<PulseStep, StepState> {
  const published = !!survey.everPublished || survey.status !== 'draft';
  const live = survey.status !== 'draft';
  return {
    write: current === 'write' ? 'on' : 'done',
    share: current === 'share' ? 'on' : live ? 'done' : 'todo',
    results: current === 'results' ? 'on' : published ? 'todo' : 'locked',
  };
}

export interface PulseAction {
  label: string;
  /** Route commands, or null for an action the page handles (copy link). */
  route: string[] | null;
  kind?: 'copy' | 'reopen';
}

/** "One primary action per state" (1a): the dark go button and its partner. */
export function pulseActions ( survey: Survey ): { primary: PulseAction; secondary: PulseAction | null; } {
  const id = survey.id || '';
  const status = pulseStatus( survey );
  if ( status === 'live' ) {
    return { primary: { label: 'See results', route: ['/survey', id, 'results'] }, secondary: { label: 'Copy link', route: null, kind: 'copy' } };
  }
  if ( status === 'closed' ) {
    return { primary: { label: 'See results', route: ['/survey', id, 'results'] }, secondary: { label: 'Reopen', route: ['/survey', id, 'share'], kind: 'reopen' } };
  }
  if ( publishBlockers( survey ).length === 0 ) {
    return { primary: { label: 'Share', route: ['/survey', id, 'share'] }, secondary: { label: 'Edit', route: ['/survey', id, 'write'] } };
  }
  return { primary: { label: 'Keep writing', route: ['/survey', id, 'write'] }, secondary: null };
}

/** The one-line hint on a pulse row: TODD's words when it has them. */
export function pulseHint ( survey: Survey, now = new Date() ): string {
  const status = pulseStatus( survey );
  const insights = survey.insights;
  const count = survey.responseCount || 0;
  if ( status === 'closed' ) {
    return insights?.summary || ( count ? `${plural( count, 'answer' )} in. Closed.` : 'Closed before anyone answered.' );
  }
  if ( status === 'live' ) {
    if ( insights?.summary && insights.updatedAt ) return `TODD updated the summary ${relativeDay( insights.updatedAt, now )}.`;
    if ( count === 0 ) return 'Waiting for the first answer. Send the link.';
    if ( count < 5 ) return `TODD writes a summary after 5 answers. ${count} so far.`;
    return 'TODD is reading the answers.';
  }
  const questions = survey.questions || [];
  if ( !survey.title?.trim() && questions.length === 0 ) return 'Start with a title or let TODD write the questions.';
  if ( questions.length === 1 ) return 'One question rarely tells you much. Add two more.';
  if ( publishBlockers( survey ).length ) return publishBlockers( survey )[0] + ' to share it.';
  return survey.everPublished ? 'Back in draft. Publish again to keep collecting.' : 'Ready to share.';
}

/** "4 questions · 38 answers · live since Oct 2" */
export function pulseMeta ( survey: Survey ): string {
  const status = pulseStatus( survey );
  const parts = [plural( survey.questions?.length || 0, 'question' )];
  const count = survey.responseCount || 0;
  if ( status === 'live' ) {
    parts.push( plural( count, 'answer' ) );
    if ( survey.publishedAt ) parts.push( `live since ${shortDate( survey.publishedAt )}` );
  } else if ( status === 'closed' ) {
    parts.push( plural( count, 'answer' ) );
    if ( survey.closedAt ) parts.push( `closed ${shortDate( survey.closedAt )}` );
  } else if ( survey.everPublished && count ) {
    parts.push( plural( count, 'answer' ) );
  } else if ( !survey.everPublished && ( survey.questions?.length || 0 ) >= 3 && publishBlockers( survey ).length === 0 ) {
    parts.push( 'not shared yet' );
  } else if ( survey.updatedAt ) {
    parts.push( `edited ${shortDate( survey.updatedAt )}` );
  }
  return parts.join( ' · ' );
}

// ── Formatting ─────────────────────────────────────────────────────────────

export function plural ( count: number, word: string ): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function shortDate ( iso: string | null | undefined ): string {
  if ( !iso ) return '';
  const date = new Date( iso );
  return Number.isNaN( date.getTime() ) ? '' : date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
}

/** "just now", "2 min ago", "3 hr ago", then a date. */
export function timeAgo ( iso: string | null | undefined, now = new Date() ): string {
  if ( !iso ) return '';
  const minutes = Math.max( 0, Math.round( ( now.getTime() - new Date( iso ).getTime() ) / 60000 ) );
  if ( minutes < 1 ) return 'just now';
  if ( minutes < 60 ) return `${minutes} min ago`;
  const hours = Math.round( minutes / 60 );
  if ( hours < 24 ) return `${hours} hr ago`;
  return `on ${shortDate( iso )}`;
}

/** "this morning", "yesterday", "on Oct 2". */
export function relativeDay ( iso: string, now = new Date() ): string {
  const date = new Date( iso );
  const startOfToday = new Date( now.getFullYear(), now.getMonth(), now.getDate() ).getTime();
  if ( date.getTime() >= startOfToday ) {
    const hour = date.getHours();
    return hour < 12 ? 'this morning' : hour < 17 ? 'this afternoon' : 'this evening';
  }
  if ( date.getTime() >= startOfToday - 86400000 ) return 'yesterday';
  return `on ${shortDate( iso )}`;
}

export function greeting ( firstName: string, now = new Date() ): string {
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${part}, ${firstName}` : part;
}

/** The public link respondents open. */
export function pulseLink ( origin: string, id: string ): string {
  return `${origin.replace( /\/+$/, '' )}/take/${id}`;
}
