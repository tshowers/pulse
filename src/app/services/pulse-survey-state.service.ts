import { Injectable } from '@angular/core';

/**
 * Ported verbatim from the monorepo's services/survey.service.ts (28
 * lines) - a trivial in-memory "selected survey" holder used to pass a
 * survey object between survey-list/survey-add without a route param
 * round-trip. Renamed from SurveyService to PulseSurveyStateService only
 * to avoid a name collision with SurveyApiService's own naming pattern in
 * this app; behavior is unchanged.
 */
@Injectable( {
  providedIn: 'root'
} )
export class PulseSurveyStateService {

  private selectedSurvey: any;

  constructor() { }

  setSelectedSurvey(survey: any) {
    this.selectedSurvey = survey;
  }

  getSelectedSurvey() {
    return this.selectedSurvey;
  }


  clearSelectedSurvey() {
    this.selectedSurvey = null;
  }

  public clearAll(): void {
    this.selectedSurvey = null;
  }
}
