/**
 * Meta Pixel for paid-report pulses whose owner runs Meta ads to them
 * (paidReport.metaPixelId, set on the Firestore doc only; the backend sends
 * digits or nothing). Pulses without one load nothing, so other workspaces'
 * respondents are never tracked. Off on localhost and in previews (callers
 * skip preview).
 *
 * Events: PageView on the take page and the report page, Lead when someone
 * finishes a pulse on the paid path, `PulseReferred` on the free referral
 * path (so ads don't learn from people we can't sell to), InitiateCheckout on
 * Unlock. Purchase fires on the owner's own thank-you page (successUrl).
 */
type Fbq = ( ...args: unknown[] ) => void;
type PixelWindow = Window & { fbq?: Fbq & { callMethod?: Fbq; queue?: unknown[][]; loaded?: boolean; version?: string; push?: Fbq; }; _fbq?: unknown; };

const PIXEL_ID = /^\d{6,20}$/;
const started = new Set<string>();

function isLocal (): boolean {
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
}

function fbq (): Fbq {
  const w = window as PixelWindow;
  if ( !w.fbq ) {
    // Meta's standard loader: queue calls until fbevents.js arrives.
    const queued: Fbq & { callMethod?: Fbq; queue: unknown[][]; loaded: boolean; version: string; push?: Fbq; } = Object.assign(
      ( ...args: unknown[] ) => queued.callMethod ? queued.callMethod( ...args ) : queued.queue.push( args ),
      { queue: [] as unknown[][], loaded: true, version: '2.0' } );
    queued.push = queued;
    w.fbq = queued;
    if ( !w._fbq ) w._fbq = queued;
    const script = document.createElement( 'script' );
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild( script );
  }
  return w.fbq;
}

/** Loads the pixel once per ID and records a PageView. False when there's no pixel to use. */
export function startMetaPixel ( pixelId: string | null | undefined ): boolean {
  const id = String( pixelId || '' ).trim();
  if ( !PIXEL_ID.test( id ) || typeof window === 'undefined' || isLocal() ) return false;
  try {
    if ( !started.has( id ) ) {
      fbq()( 'init', id );
      fbq()( 'track', 'PageView' );
      started.add( id );
    }
    return true;
  } catch {
    return false;
  }
}

/** A standard event (Lead, InitiateCheckout). eventId lets Meta drop duplicates. */
export function trackMetaPixel ( pixelId: string | null | undefined, event: string, params: Record<string, unknown> = {}, eventId = '' ): void {
  if ( !startMetaPixel( pixelId ) ) return;
  try {
    fbq()( 'track', event, params, eventId ? { eventID: eventId } : undefined );
  } catch { }
}

/** A custom event (PulseReferred). */
export function trackMetaPixelCustom ( pixelId: string | null | undefined, event: string, params: Record<string, unknown> = {}, eventId = '' ): void {
  if ( !startMetaPixel( pixelId ) ) return;
  try {
    fbq()( 'trackCustom', event, params, eventId ? { eventID: eventId } : undefined );
  } catch { }
}
