import { Injectable } from '@angular/core';

/**
 * Trimmed port of TODD's AssistantIntentRunnerService. The original also
 * decides early intercepts for Catalyst/composer/email-sent flows and
 * routes across four domains - none of that applies here, since this app
 * only ever has one domain. Same trim as web-products/network's port.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantIntentRunnerService {
    /** Only one domain exists here, so this only ever confirms it applies. */
    routeDomain ( prompt: string ): 'survey' | null {
        const p = ( prompt || '' ).trim();
        if ( !p ) return null;
        const lower = p.toLowerCase();

        if ( /(survey|pulse|poll|questionnaire|nps|csat|question|response|respondent)/.test( lower ) ) return 'survey';

        return null;
    }
}
