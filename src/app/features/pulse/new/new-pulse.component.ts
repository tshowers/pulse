import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';

import { Survey } from '../../../models/survey.model';
import { PulseAuthService } from '../../../services/pulse-auth.service';
import { SurveyApiService } from '../../../services/survey-api.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { blankQuestion, plural } from '../pulse-state';
import { PULSE_TEMPLATES, PulseTemplate, templateQuestions } from '../pulse-templates';

/**
 * New pulse (1b): say what you want to find out and TODD writes the
 * questions, or start from a template or blank. Every path creates a draft
 * and opens Write with it. Also the Pulses home when there are no pulses yet.
 *
 * /survey-edit?id=… (the old editor's URL) forwards to that pulse's Write step.
 */
@Component( {
  selector: 'app-new-pulse',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './new-pulse.component.html',
  styleUrl: './new-pulse.component.css',
} )
export class NewPulseComponent implements OnInit {
  /** True when shown inside Pulses home (no page frame of its own). */
  @Input() embedded = false;

  private readonly api = inject( SurveyApiService );
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );
  private readonly auth = inject( PulseAuthService );

  readonly templates = PULSE_TEMPLATES;
  readonly plural = plural;
  readonly prompt = signal( '' );
  readonly busy = signal<'todd' | 'template' | 'blank' | ''>( '' );
  readonly error = signal( '' );

  async ngOnInit (): Promise<void> {
    if ( this.embedded ) return;
    const legacyId = this.route.snapshot.queryParamMap.get( 'id' );
    if ( legacyId ) {
      await this.router.navigate( ['/survey', legacyId, 'write'], { replaceUrl: true } );
      return;
    }
    const signedIn = await firstValueFrom( this.auth.isLoggedIn().pipe( take( 1 ) ) );
    if ( !signedIn ) await this.router.navigate( ['/get-started'], { replaceUrl: true } );
  }

  async writeWithTodd (): Promise<void> {
    const prompt = this.prompt().trim();
    if ( prompt.length < 3 || this.busy() ) return;
    this.busy.set( 'todd' );
    this.error.set( '' );
    try {
      const draft = await firstValueFrom( this.api.draftWithTodd( prompt ) );
      await this.create( { title: draft.title, description: draft.description, questions: draft.questions } );
    } catch ( error ) {
      this.error.set( ( error as HttpErrorResponse )?.error?.error || "TODD couldn't write questions just now. Try again, or start from a template." );
      this.busy.set( '' );
    }
  }

  async fromTemplate ( template: PulseTemplate ): Promise<void> {
    if ( this.busy() ) return;
    this.busy.set( 'template' );
    await this.create( { title: template.title, description: template.description, questions: templateQuestions( template ) } );
  }

  async blank (): Promise<void> {
    if ( this.busy() ) return;
    this.busy.set( 'blank' );
    await this.create( { title: '', description: '', questions: [blankQuestion()] } );
  }

  private async create ( content: Pick<Survey, 'title' | 'description' | 'questions'> ): Promise<void> {
    try {
      await firstValueFrom( this.auth.getTenantId().pipe( filter( ( id ) => !!id ), take( 1 ) ) );
      // New pulses ask for names by default (Share step can switch to Anonymous).
      const created = await firstValueFrom( this.api.createSurvey( { ...content, collectIdentity: true } as Survey ) );
      await this.router.navigate( ['/survey', created.id, 'write'] );
    } catch {
      this.error.set( "Couldn't create the pulse. Check your connection and try again." );
      this.busy.set( '' );
    }
  }

  onPromptKey ( event: KeyboardEvent ): void {
    if ( event.key === 'Enter' && !event.shiftKey ) {
      event.preventDefault();
      void this.writeWithTodd();
    }
  }
}
