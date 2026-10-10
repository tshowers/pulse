import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { Survey } from '../../models/survey.model';
import { SurveyApiService } from '../../services/survey-api.service';
import { PulseStore } from './pulse.store';

describe( 'PulseStore autosave', () => {
  let api: jasmine.SpyObj<SurveyApiService>;
  let store: PulseStore;
  const base: Survey = { id: 's1', title: 'Q4', description: '', questions: [], revision: 3, status: 'draft' };

  beforeEach( () => {
    api = jasmine.createSpyObj<SurveyApiService>( 'SurveyApiService', ['getSurveyById', 'updateSurvey'] );
    api.getSurveyById.and.returnValue( of( base ) );
    TestBed.configureTestingModule( { providers: [PulseStore, { provide: SurveyApiService, useValue: api }] } );
    store = TestBed.inject( PulseStore );
  } );

  it( 'saves once, a second after the last edit, with the revision it was based on', fakeAsync( () => {
    api.updateSurvey.and.callFake( ( _id, body ) => of( { ...base, ...body, revision: 4 } as Survey ) );
    void store.load( 's1' );
    tick();
    store.patch( ( d ) => { d.title = 'Q'; } );
    tick( 500 );
    store.patch( ( d ) => { d.title = 'Q4 check-in'; } );
    tick( 999 );
    expect( api.updateSurvey ).not.toHaveBeenCalled();
    tick( 1 );
    flush();
    expect( api.updateSurvey ).toHaveBeenCalledTimes( 1 );
    expect( api.updateSurvey.calls.mostRecent().args[1] ).toEqual( jasmine.objectContaining( { title: 'Q4 check-in', revision: 3 } ) );
    expect( store.saveState() ).toBe( 'saved' );
    expect( store.survey()?.revision ).toBe( 4 );
  } ) );

  it( 'keeps edits made while a save is in flight and saves them next, in order', fakeAsync( () => {
    const first = new Subject<Survey>();
    api.updateSurvey.and.returnValues( first.asObservable(), of( { ...base, title: 'third', revision: 5 } ) );
    void store.load( 's1' );
    tick();
    store.patch( ( d ) => { d.title = 'second'; } );
    tick( 1000 );
    store.patch( ( d ) => { d.title = 'third'; } );
    first.next( { ...base, title: 'second', revision: 4 } );
    first.complete();
    tick( 1000 );
    flush();
    expect( api.updateSurvey ).toHaveBeenCalledTimes( 2 );
    expect( api.updateSurvey.calls.argsFor( 1 )[1] ).toEqual( jasmine.objectContaining( { title: 'third', revision: 4 } ) );
    expect( store.survey()?.title ).toBe( 'third' );
  } ) );

  it( 'stops on a 409 instead of overwriting the newer save', fakeAsync( () => {
    api.updateSurvey.and.returnValue( throwError( () => new HttpErrorResponse( { status: 409 } ) ) );
    void store.load( 's1' );
    tick();
    store.patch( ( d ) => { d.title = 'mine'; } );
    tick( 1000 );
    flush();
    expect( store.saveState() ).toBe( 'conflict' );
    store.patch( ( d ) => { d.title = 'ignored'; } );
    tick( 2000 );
    expect( api.updateSurvey ).toHaveBeenCalledTimes( 1 );
  } ) );
} );
