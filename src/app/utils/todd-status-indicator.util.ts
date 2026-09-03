export type ToddStatusTone = 'on' | 'active' | 'off' | 'waiting' | 'blocked';

export function mapToddStatusTone ( status: string | null | undefined ): ToddStatusTone {
  const rawStatus = String( status || '' ).trim().toLowerCase().replace( /[\s-]+/g, '_' );

  if ( !rawStatus ) return 'off';

  if ( /(blocked|failed|failure|error|missing|overdue|attention|behind|unavailable)/.test( rawStatus ) ) {
    return 'blocked';
  }

  if ( /(trial|trialing|needs_you|handoff)/.test( rawStatus ) ) {
    return 'waiting';
  }

  if ( /(waiting|pending|draft|drafted|selected|review|approval|confirm)/.test( rawStatus ) ) {
    return 'waiting';
  }

  if ( /(active|running|processing|live|queued|sending|publishing|working|in_progress)/.test( rawStatus ) ) {
    return 'active';
  }

  if ( /(off|disconnected|disabled|idle|unknown|not_started)/.test( rawStatus ) ) {
    return 'off';
  }

  if ( /(on|ready|connected|available|completed|complete|done|checked|published|met|paid|included|free|admin)/.test( rawStatus ) ) {
    return 'on';
  }

  return 'on';
}

export function shouldPulseToddStatus ( status: string | null | undefined ): boolean {
  return mapToddStatusTone( status ) === 'active';
}
