import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { SurveyApiService } from './survey-api.service';
import { Survey } from '../models/survey.model';
import { environment } from '../../environments/environment';

describe( 'SurveyApiService', () => {
  let service: SurveyApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.backendURL}/surveys`;

  const survey: Survey = {
    id: 'survey-1',
    title: 'Customer Satisfaction',
    description: 'How are we doing?',
    questions: [
      { questionText: 'Would you recommend us?', questionType: 'yes_no', options: [] }
    ],
  };

  beforeEach( () => {
    TestBed.configureTestingModule( {
      imports: [HttpClientTestingModule],
      providers: [SurveyApiService],
    } );

    service = TestBed.inject( SurveyApiService );
    httpMock = TestBed.inject( HttpTestingController );
  } );

  afterEach( () => {
    httpMock.verify();
  } );

  it( 'creates a survey with a POST to /surveys', () => {
    const payload: Survey = { title: 'New Pulse', description: 'desc', questions: [] };

    service.createSurvey( payload ).subscribe( ( result ) => {
      expect( result ).toEqual( { ...payload, id: 'survey-1' } );
    } );

    const req = httpMock.expectOne( baseUrl );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( payload );
    req.flush( { ...payload, id: 'survey-1' } );
  } );

  it( 'reads a survey by id with a GET to /surveys/:id', () => {
    service.getSurveyById( 'survey-1' ).subscribe( ( result ) => {
      expect( result ).toEqual( survey );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1` );
    expect( req.request.method ).toBe( 'GET' );
    req.flush( survey );
  } );

  it( 'returns null when a survey is not found', () => {
    service.getSurveyById( 'missing' ).subscribe( ( result ) => {
      expect( result ).toBeNull();
    } );

    const req = httpMock.expectOne( `${baseUrl}/missing` );
    req.flush( null );
  } );

  it( 'reads a public survey with a GET to /public/surveys/:id', () => {
    service.getPublicSurveyById( 'survey-1' ).subscribe( ( result ) => {
      expect( result ).toEqual( survey );
    } );

    const req = httpMock.expectOne( `${environment.backendURL}/public/surveys/survey-1` );
    expect( req.request.method ).toBe( 'GET' );
    req.flush( survey );
  } );

  it( 'lists surveys with a GET to /surveys and forwards filters as query params', () => {
    service.listSurveys( {
      pageSize: 25,
      pageToken: 'next-page',
      filters: {
        query: '  feedback  ',
        status: 'published',
        visibility: 'public',
        ownerId: 'owner-1',
        tenantId: 'tenant-1',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      },
    } ).subscribe( ( result ) => {
      expect( result ).toEqual( { surveys: [survey], nextPageToken: null } );
    } );

    const req = httpMock.expectOne(
      ( request ) => request.url === baseUrl && request.method === 'GET'
    );
    expect( req.request.params.get( 'pageSize' ) ).toBe( '25' );
    expect( req.request.params.get( 'pageToken' ) ).toBe( 'next-page' );
    expect( req.request.params.get( 'query' ) ).toBe( 'feedback' );
    expect( req.request.params.get( 'status' ) ).toBe( 'published' );
    expect( req.request.params.get( 'visibility' ) ).toBe( 'public' );
    expect( req.request.params.get( 'ownerId' ) ).toBe( 'owner-1' );
    expect( req.request.params.get( 'tenantId' ) ).toBe( 'tenant-1' );
    expect( req.request.params.get( 'sortBy' ) ).toBe( 'updatedAt' );
    expect( req.request.params.get( 'sortDirection' ) ).toBe( 'desc' );
    req.flush( { surveys: [survey], nextPageToken: null } );
  } );

  it( 'lists surveys with no params when no request is given', () => {
    service.listSurveys().subscribe();

    const req = httpMock.expectOne(
      ( request ) => request.url === baseUrl && request.method === 'GET'
    );
    expect( req.request.params.keys().length ).toBe( 0 );
    req.flush( { surveys: [] } );
  } );

  it( 'omits a blank query filter instead of sending an empty string', () => {
    service.listSurveys( { filters: { query: '   ' } } ).subscribe();

    const req = httpMock.expectOne(
      ( request ) => request.url === baseUrl && request.method === 'GET'
    );
    expect( req.request.params.has( 'query' ) ).toBeFalse();
    req.flush( { surveys: [] } );
  } );

  it( 'updates a survey with a PUT to /surveys/:id', () => {
    const updated: Survey = { ...survey, title: 'Updated title' };

    service.updateSurvey( 'survey-1', updated ).subscribe( ( result ) => {
      expect( result ).toEqual( updated );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1` );
    expect( req.request.method ).toBe( 'PUT' );
    expect( req.request.body ).toEqual( updated );
    req.flush( updated );
  } );

  it( 'deletes a survey with a DELETE to /surveys/:id', () => {
    let completed = false;

    service.deleteSurvey( 'survey-1' ).subscribe( () => {
      completed = true;
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1` );
    expect( req.request.method ).toBe( 'DELETE' );
    req.flush( null );
    expect( completed ).toBeTrue();
  } );

  it( 'publishes a survey with a POST to /surveys/:id/publish', () => {
    service.publishSurvey( 'survey-1' ).subscribe( ( result ) => {
      expect( result ).toEqual( { id: 'survey-1', status: 'published', visibility: 'public' } );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1/publish` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( {} );
    req.flush( { id: 'survey-1', status: 'published', visibility: 'public' } );
  } );

  it( 'unpublishes a survey with a POST to /surveys/:id/unpublish', () => {
    service.unpublishSurvey( 'survey-1' ).subscribe( ( result ) => {
      expect( result ).toEqual( { id: 'survey-1', status: 'draft', visibility: 'private' } );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1/unpublish` );
    expect( req.request.method ).toBe( 'POST' );
    req.flush( { id: 'survey-1', status: 'draft', visibility: 'private' } );
  } );

  it( 'submits a survey response with a POST to /surveys/:id/responses', () => {
    const payload = { surveyId: 'survey-1', tenantId: 'tenant-1', responses: ['yes'], submittedAt: new Date() };

    service.submitSurveyResponse( 'survey-1', payload ).subscribe( ( result ) => {
      expect( result ).toEqual( { success: true, responseId: 'resp-1' } );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1/responses` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( payload );
    req.flush( { success: true, responseId: 'resp-1' } );
  } );

  it( 'submits a public survey response with a POST to /public/surveys/:id/responses', () => {
    const payload = { surveyId: 'survey-1', responses: ['yes'], submittedAt: new Date() };

    service.submitPublicSurveyResponse( 'survey-1', payload ).subscribe( ( result ) => {
      expect( result ).toEqual( { success: true } );
    } );

    const req = httpMock.expectOne( `${environment.backendURL}/public/surveys/survey-1/responses` );
    expect( req.request.method ).toBe( 'POST' );
    req.flush( { success: true } );
  } );

  it( 'fetches survey responses with a GET to /surveys/:id/responses', () => {
    const records = [{ id: 'r1', surveyId: 'survey-1', submittedAt: new Date().toISOString(), tenantId: 'tenant-1', responses: ['yes'] }];

    service.getSurveyResponses( 'survey-1' ).subscribe( ( result ) => {
      expect( result ).toEqual( records );
    } );

    const req = httpMock.expectOne( `${baseUrl}/survey-1/responses` );
    expect( req.request.method ).toBe( 'GET' );
    req.flush( records );
  } );

  it( 'searches surveys with a POST to /surveys/search', () => {
    const request = { filters: { query: 'feedback' } };

    service.searchSurveys( request ).subscribe();

    const req = httpMock.expectOne( `${baseUrl}/search` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( request );
    req.flush( { surveys: [] } );
  } );

  it( 'runs an NLP survey search with a POST to /surveys/search/nlp', () => {
    const request = { query: 'unhappy customers' };

    service.nlpSearchSurveys( request as any ).subscribe();

    const req = httpMock.expectOne( `${baseUrl}/search/nlp` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( request );
    req.flush( { surveys: [] } );
  } );

  it( 'starts a survey checkout with a POST to /survey/checkout', () => {
    const request = { tenantId: 'tenant-1', email: 'user@example.com' };

    service.createSurveyCheckout( request ).subscribe( ( result ) => {
      expect( result ).toEqual( { success: true, checkoutUrl: 'https://checkout.example.com' } );
    } );

    const req = httpMock.expectOne( `${environment.backendURL}/survey/checkout` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( request );
    req.flush( { success: true, checkoutUrl: 'https://checkout.example.com' } );
  } );

  it( 'confirms a survey checkout with a POST to /survey/checkout/confirm', () => {
    service.confirmSurveyCheckout( 'session-1' ).subscribe();

    const req = httpMock.expectOne( `${environment.backendURL}/survey/checkout/confirm` );
    expect( req.request.method ).toBe( 'POST' );
    expect( req.request.body ).toEqual( { sessionId: 'session-1' } );
    req.flush( {} );
  } );
} );
