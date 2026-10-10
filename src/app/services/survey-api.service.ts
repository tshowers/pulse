import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PublicSurvey,
  Survey,
  SurveyCloseRule,
  SurveyListResult,
  SurveyResults,
  SurveyStatus,
  SurveyVisibility,
  ToddDraft,
  ToddEmailDraft,
  ToddInsights,
  ToddSuggestion,
} from '../models/survey.model';
import {
  SurveyNlpSearchRequest,
  SurveyNlpSearchResponse,
  SurveySearchRequest,
  SurveySearchResponse
} from '../models/survey-search.model';

/**
 * Ported near-verbatim from the monorepo's
 * features/survey/services/survey-api.service.ts (171 lines) - already
 * pure HttpClient with zero Firestore/emulator cruft, the cleanest backend
 * coupling of any module extracted so far. Only the environment import path
 * changed (one fewer directory level here than in the monorepo).
 */

export interface SurveyResponsePayload {
  surveyId: string;
  tenantId: string | null;
  responses: any[];
  submittedAt: Date;
}

export interface SubmitSurveyResponseResult {
  success: boolean;
  responseId?: string;
  message?: string;
}

export interface SurveyResponseRecord {
  id: string;
  surveyId: string;
  submittedAt: string | Date;
  tenantId: string | null;
  /** Legacy positional answers; prefer `answers`. */
  responses: any[];
  /** Answers keyed by question id. */
  answers?: Record<string, unknown>;
  /** Only when the pulse asked for name and email. */
  respondent?: { name: string; email: string; };
}

export interface PublishSurveyResult {
  id?: string;
  status?: SurveyStatus;
  visibility?: SurveyVisibility;
  title?: string;
}

export interface PublicSurveyResponsePayload {
  surveyId: string;
  /** Answers keyed by question id. */
  answers?: Record<string, unknown>;
  /** Legacy positional answers, for older callers. */
  responses?: any[];
  respondent?: { name: string; email: string; };
  submittedAt: Date;
}

export interface PublishSurveyOptions {
  closeRule?: SurveyCloseRule;
  collectIdentity?: boolean;
}


export interface SurveyCheckoutRequest {
  tenantId: string;
  email: string;
}

export interface SurveyCheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class SurveyApiService {

  private readonly baseUrl = environment.backendURL + '/surveys';

  constructor ( private http: HttpClient ) { }

  createSurvey ( survey: Survey ): Observable<Survey> {
    return this.http.post<Survey>( this.baseUrl, survey );
  }

  getSurveyResponses ( id: string ): Observable<SurveyResponseRecord[]> {
    return this.http.get<SurveyResponseRecord[]>( `${this.baseUrl}/${id}/responses` );
  }


  updateSurvey ( id: string, survey: Survey ): Observable<Survey> {
    return this.http.put<Survey>( `${this.baseUrl}/${id}`, survey );
  }

  getSurveyById ( id: string ): Observable<Survey | null> {
    return this.http.get<Survey | null>( `${this.baseUrl}/${id}` );
  }

  getPublicSurveyById ( id: string ): Observable<PublicSurvey | null> {
    return this.http.get<PublicSurvey | null>( `${environment.backendURL}/public/surveys/${id}` );
  }

  publishSurvey ( id: string, options: PublishSurveyOptions = {} ): Observable<Survey> {
    return this.http.post<Survey>( `${this.baseUrl}/${id}/publish`, options );
  }

  /** "Close now": stop taking answers. */
  closeSurvey ( id: string ): Observable<Survey> {
    return this.http.post<Survey>( `${this.baseUrl}/${id}/close`, {} );
  }

  /** Opening Results resets the "N new" badge. */
  markViewed ( id: string ): Observable<Survey> {
    return this.http.post<Survey>( `${this.baseUrl}/${id}/viewed`, {} );
  }

  /** The owner tried their pulse in preview (Share checklist, Getting started). */
  markTried ( id: string ): Observable<Survey> {
    return this.http.post<Survey>( `${this.baseUrl}/${id}/tried`, {} );
  }

  getResults ( id: string ): Observable<SurveyResults> {
    return this.http.get<SurveyResults>( `${this.baseUrl}/${id}/results` );
  }

  getInsights ( id: string ): Observable<ToddInsights> {
    return this.http.get<ToddInsights>( `${this.baseUrl}/${id}/insights` );
  }

  refreshInsights ( id: string ): Observable<ToddInsights> {
    return this.http.post<ToddInsights>( `${this.baseUrl}/${id}/insights/refresh`, {} );
  }

  /** "Write my questions": TODD drafts a pulse from one sentence (not saved). */
  draftWithTodd ( prompt: string ): Observable<ToddDraft> {
    return this.http.post<ToddDraft>( `${this.baseUrl}/todd/draft`, { prompt } );
  }

  /** TODD's review of the draft as it is on screen. */
  reviewWithTodd ( id: string, draft: Pick<Survey, 'title' | 'description' | 'questions'> ): Observable<{ suggestions: ToddSuggestion[]; hash: string; }> {
    return this.http.post<{ suggestions: ToddSuggestion[]; hash: string; }>( `${this.baseUrl}/${id}/todd/review`, draft );
  }

  anotherNextMove ( id: string ): Observable<ToddInsights> {
    return this.http.post<ToddInsights>( `${this.baseUrl}/${id}/todd/next-move/alternative`, {} );
  }

  draftNextMoveEmail ( id: string ): Observable<ToddEmailDraft> {
    return this.http.post<ToddEmailDraft>( `${this.baseUrl}/${id}/todd/next-move/email`, {} );
  }

  addNextMoveTask ( id: string ): Observable<{ taskId: string; alreadyAdded: boolean; }> {
    return this.http.post<{ taskId: string; alreadyAdded: boolean; }>( `${this.baseUrl}/${id}/todd/next-move/task`, {} );
  }

  unpublishSurvey ( id: string ): Observable<Survey> {
    return this.http.post<Survey>( `${this.baseUrl}/${id}/unpublish`, {} );
  }

  submitSurveyResponse ( id: string, payload: SurveyResponsePayload ): Observable<SubmitSurveyResponseResult> {
    return this.http.post<SubmitSurveyResponseResult>( `${this.baseUrl}/${id}/responses`, payload );
  }

  submitPublicSurveyResponse ( id: string, payload: PublicSurveyResponsePayload ): Observable<SubmitSurveyResponseResult> {
    return this.http.post<SubmitSurveyResponseResult>( `${environment.backendURL}/public/surveys/${id}/responses`, payload );
  }

  listSurveys ( request?: SurveySearchRequest ): Observable<SurveyListResult> {
    let params = new HttpParams();

    if ( request?.pageSize ) {
      params = params.set( 'pageSize', String( request.pageSize ) );
    }

    if ( request?.pageToken ) {
      params = params.set( 'pageToken', request.pageToken );
    }

    if ( request?.filters?.query?.trim() ) {
      params = params.set( 'query', request.filters.query.trim() );
    }

    if ( request?.filters?.status ) {
      params = params.set( 'status', request.filters.status );
    }

    if ( request?.filters?.visibility ) {
      params = params.set( 'visibility', request.filters.visibility );
    }

    if ( request?.filters?.ownerId ) {
      params = params.set( 'ownerId', request.filters.ownerId );
    }

    if ( request?.filters?.tenantId ) {
      params = params.set( 'tenantId', request.filters.tenantId );
    }

    if ( request?.filters?.sortBy ) {
      params = params.set( 'sortBy', request.filters.sortBy );
    }

    if ( request?.filters?.sortDirection ) {
      params = params.set( 'sortDirection', request.filters.sortDirection );
    }

    return this.http.get<SurveyListResult>( this.baseUrl, { params } );
  }

  deleteSurvey ( id: string ): Observable<void> {
    return this.http.delete<void>( `${this.baseUrl}/${id}` );
  }

  searchSurveys ( request: SurveySearchRequest ): Observable<SurveySearchResponse> {
    return this.http.post<SurveySearchResponse>( `${this.baseUrl}/search`, request );
  }

  nlpSearchSurveys ( request: SurveyNlpSearchRequest ): Observable<SurveyNlpSearchResponse> {
    return this.http.post<SurveyNlpSearchResponse>( `${this.baseUrl}/search/nlp`, request );
  }
  createSurveyCheckout ( request: SurveyCheckoutRequest ): Observable<SurveyCheckoutResult> {
    return this.http.post<SurveyCheckoutResult>(
      `${environment.backendURL}/survey/checkout`,
      request
    );
  }

  confirmSurveyCheckout ( sessionId: string ): Observable<any> {
    return this.http.post(
      `${environment.backendURL}/survey/checkout/confirm`,
      { sessionId }
    );
  }
}
