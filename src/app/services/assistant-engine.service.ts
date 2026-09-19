import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

export interface AssistantEnginePatches {
    setLoading: ( v: boolean ) => void;
    patchState: ( p: Partial<{
        assistantResponse: string;
        pendingAction: { action: string; param: any; } | null;
        inlineReply: any | null;
        showConfirmPrompt: boolean;
    }> ) => void;
    setAssistantPrompt: ( v: string ) => void;
    setAssistantResponse: ( v: string ) => void;
    setPendingAction: ( v: { action: string; param: any; } | null ) => void;
    setInlineReply: ( v: any | null ) => void;
    setShowConfirmPrompt: ( v: boolean ) => void;
    enforceExternalModeUiGuards: () => void;
}

export interface AssistantEngineIO {
    pushLocalHistory: ( role: 'user' | 'assistant', content: string ) => void;
    emitMessage: ( role: 'user' | 'assistant', content: string ) => void;
    scheduleScrollToBottom: ( force?: boolean ) => void;
    scrollHistoryToBottom: ( delay?: boolean ) => void;
    clearSuggestions: () => void;
}

export interface AssistantEngineContext {
    rawPrompt: string;
    userId: string | null | undefined;
    externalMode: boolean;
    parentOwnsHistory: boolean;
}

export interface AssistantEngineHelpers {
    tryDirectNavCommand: ( prompt: string ) => boolean;
    runGlobalPreChecks: ( prompt: string ) => boolean;
    routeDomain: ( prompt: string ) => 'survey' | null;
    handleSurveyLLMIntent: ( prompt: string ) => void;

    buildUiHint: () => string;
    withUserContext: ( prompt: string ) => string;
    onSystemTrouble: ( prompt: string ) => boolean;

    cancelInFlight: () => void;
    replaceOpenAISubscription: ( s: Subscription | null ) => void;

    runGeneralLLM: ( args: {
        promptForLLM: string;
        lastUserPrompt: string;
        patchState: AssistantEnginePatches['patchState'];
        setLoading: AssistantEnginePatches['setLoading'];
        emitAssistant: ( html: string ) => void;
        onError: ( err: any ) => void;
    } ) => Subscription;
    formatAssistantError?: ( err: any, area?: string ) => string;
}

/**
 * Trimmed port of TODD's AssistantEngineService. Same dispatch shape as
 * web-products/network's port (direct nav -> pre-checks -> domain routing ->
 * general LLM fallback), minus even the local-intent step Network had -
 * TODD's original never had a "local survey intent" layer the way it had
 * one for contacts, so there's nothing to port or drop here.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantEngineService {
    async run (
        ctx: AssistantEngineContext,
        patches: AssistantEnginePatches,
        io: AssistantEngineIO,
        helpers: AssistantEngineHelpers
    ): Promise<void> {
        const rawClean = ( ctx.rawPrompt || '' ).trim();

        helpers.cancelInFlight();
        if ( !rawClean ) return;

        io.clearSuggestions();

        if ( helpers.tryDirectNavCommand( rawClean ) ) {
            patches.setAssistantPrompt( '' );
            if ( ctx.externalMode ) io.scrollHistoryToBottom( true );
            return;
        }

        if ( helpers.runGlobalPreChecks( rawClean ) ) {
            patches.setAssistantPrompt( '' );
            if ( ctx.externalMode ) io.scrollHistoryToBottom( true );
            return;
        }

        if ( helpers.routeDomain( rawClean ) === 'survey' ) {
            patches.setAssistantPrompt( '' );
            io.scheduleScrollToBottom( true );
            helpers.handleSurveyLLMIntent( rawClean );
            return;
        }

        if ( helpers.onSystemTrouble( rawClean ) ) {
            io.scheduleScrollToBottom( true );
            return;
        }

        // General LLM fallback
        patches.setLoading( true );
        patches.setAssistantResponse( '' );

        const uiCue = /\b(icon|icons|menu|navbar|nav|screen|page|homepage|home page|home)\b|todd[- ]assistance|start[- ]page|what\s+does\s+.*\s+icon/i;
        const isUiQuestion = uiCue.test( rawClean );
        const basePromptForLLM = isUiQuestion
            ? `${rawClean}\n\n[ui-hint]\n${helpers.buildUiHint()}`
            : rawClean;
        const promptForLLM = helpers.withUserContext( basePromptForLLM );

        const sub = helpers.runGeneralLLM( {
            promptForLLM,
            lastUserPrompt: rawClean,
            patchState: patches.patchState,
            setLoading: patches.setLoading,
            emitAssistant: ( html ) => io.emitMessage( 'assistant', html ),
            onError: ( err ) => {
                patches.setLoading( false );
                helpers.replaceOpenAISubscription( null );
                const message = helpers.formatAssistantError?.( err, 'general' )
                    || `<div class="assistant-nudge">Sorry, I'm having trouble understanding that.</div>`;
                io.emitMessage( 'assistant', message );
            },
        } );
        helpers.replaceOpenAISubscription( sub );

        patches.setAssistantPrompt( '' );
    }
}
