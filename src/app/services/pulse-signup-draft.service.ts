import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getAuth } from 'firebase/auth';
import { filter, firstValueFrom, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { Survey, SurveyQuestion } from '../models/survey.model';
import { PulseAuthService } from './pulse-auth.service';
import { SurveyApiService } from './survey-api.service';

export type WizardQuestionType = 'multiple_choice' | 'rating' | 'yes_no';

export interface SurveyTemplate {
  key: string;
  label: string;
  subtitle: string;
  title: string;
  /** The backend requires a description; each starter has a sensible one. */
  description: string;
  question: SurveyQuestion;
}

/** Same three starters as pulse-ios's PreAuthSurveyBuilderView. */
export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    key: 'customerFeedback', label: 'Customer Feedback', subtitle: "Ask customers how you're doing", title: 'Customer Feedback',
    description: 'A quick question about your experience with us - it takes less than a minute.',
    question: { questionText: 'How likely are you to recommend us to a friend?', questionType: 'rating', options: [] },
  },
  {
    key: 'eventRSVP', label: 'Event RSVP', subtitle: "Find out who's coming", title: 'Event RSVP',
    description: 'Let us know if you can make it so we can plan.',
    question: { questionText: 'Will you be attending?', questionType: 'yes_no', options: [] },
  },
  {
    key: 'teamPulseCheck', label: 'Team Pulse Check', subtitle: 'Check in on your team', title: 'Team Pulse Check',
    description: 'A quick, anonymous check-in on how the week is going.',
    question: { questionText: 'How is your workload this week?', questionType: 'multiple_choice', options: ['Too light', 'Just right', 'Too heavy'] },
  },
];

export interface PulseSignupDraft {
  templateKey: string;
  survey: Survey;
  firstName: string;
  lastName: string;
  companyName: string;
  /** Set once the visitor reached the sign-in step; an abandoned draft is never submitted. */
  readyToSubmit: boolean;
}

/**
 * The pre-sign-in /get-started wizard's draft - the web twin of pulse-ios's
 * PreAuthSurveyBuilderView: a first survey, then name and company. Kept in
 * localStorage because sign-in leaves the site for todd.taliferro.tech and
 * comes back to /auth/callback. After sign-in, submitIfPending() saves the
 * name/company to the TODD profile (POST /api/onboarding/profile, blank
 * fields only) and creates the survey as a draft.
 */
@Injectable( { providedIn: 'root' } )
export class PulseSignupDraftService {
  private readonly storageKey = 'pulse_signup_draft';

  constructor (
    private readonly http: HttpClient,
    private readonly authService: PulseAuthService,
    private readonly surveyApi: SurveyApiService,
  ) { }

  load (): PulseSignupDraft {
    const fresh = this.fromTemplate( SURVEY_TEMPLATES[0] );
    try {
      const raw = localStorage.getItem( this.storageKey );
      return raw ? { ...fresh, ...JSON.parse( raw ) } : fresh;
    } catch {
      return fresh;
    }
  }

  fromTemplate ( template: SurveyTemplate, existing?: PulseSignupDraft ): PulseSignupDraft {
    const questions = existing?.survey.questions.length ? [...existing.survey.questions] : [];
    questions[0] = { ...template.question, options: [...template.question.options] };
    return {
      templateKey: template.key,
      survey: { title: template.title, description: template.description, questions, status: 'draft' } as Survey,
      firstName: existing?.firstName || '',
      lastName: existing?.lastName || '',
      companyName: existing?.companyName || '',
      readyToSubmit: false,
    };
  }

  save ( draft: PulseSignupDraft ): void {
    try { localStorage.setItem( this.storageKey, JSON.stringify( draft ) ); } catch { }
  }

  clear (): void {
    try { localStorage.removeItem( this.storageKey ); } catch { }
  }

  /**
   * Never throws. Returns the created survey's id (to open it), or '' if
   * there was nothing to submit or it failed (the draft is then kept for
   * the next sign-in).
   */
  async submitIfPending (): Promise<string> {
    const draft = this.load();
    const user = getAuth().currentUser;
    if ( !draft.readyToSubmit || !user ) return '';

    try {
      const idToken = await user.getIdToken();
      await firstValueFrom( this.http.post( `${environment.backendURL}/onboarding/profile`, {
        source: 'pulse-web',
        profile: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          companyName: draft.companyName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        },
      }, { headers: { Authorization: `Bearer ${idToken}` } } ) ).catch( () => undefined );

      // Survey calls use the tenant headers the interceptor adds - wait for
      // a real tenant id (it's briefly '' right after sign-in).
      await firstValueFrom( this.authService.getTenantId().pipe( filter( ( id ) => !!id ), take( 1 ) ) );
      const created = await firstValueFrom( this.surveyApi.createSurvey( { ...draft.survey, status: 'draft' } as Survey ) );
      this.clear();
      return created?.id || '';
    } catch ( error ) {
      console.warn( '[PulseSignupDraftService] saving the sign-up survey failed; will retry next sign-in', error );
      return '';
    }
  }
}
