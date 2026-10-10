import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GettingStarted, GettingStartedService } from '../../services/getting-started.service';
import { PulseAssistantSignalService } from '../../services/pulse-assistant-signal.service';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

/**
 * Pulse help (design_handoff_todd_pulse 2c). Signed in: Getting started
 * progress on top. Then the three steps (Write, Share, Results), tips for
 * good questions and the FAQ. Ask TODD opens the assistant.
 */
@Component( {
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink, IconComponent, SiteFooterComponent],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
} )
export class HelpComponent implements OnInit {
  private readonly auth = inject( PulseAuthService );
  private readonly assistant = inject( PulseAssistantSignalService );
  readonly gettingStarted = inject( GettingStartedService );

  readonly signedIn = signal( false );
  readonly progress = signal<GettingStarted | null>( null );
  readonly showAfterSignIn = signal( true );
  readonly active = signal( 'your-progress' );
  readonly openFaq = signal( 0 );

  readonly nav = [
    { id: 'your-progress', label: 'Getting started', signedInOnly: true },
    { id: 'how-it-works', label: 'From a question to a decision' },
    { id: 'tips', label: 'Writing good questions' },
    { id: 'faq', label: 'Common questions' },
  ];

  readonly steps = [
    {
      n: 1, title: 'Write', tint: 'green', lead: 'A pulse is a short survey about one decision. Start from New pulse.',
      details: [
        'Describe what you want to find out and TODD drafts 3 to 5 questions, or pick a template, or start blank.',
        'Each question can be a short or long answer, one choice, pick any, yes or no, or a rating.',
        'TODD reviews your questions as you go and suggests fixes. Apply or dismiss each one.',
        'Use Try it to answer it yourself the way respondents will. Nothing is saved.',
      ],
      action: 'Start a pulse', route: '/survey-edit',
    },
    {
      n: 2, title: 'Share', tint: 'violet', lead: 'When it reads right, choose Next: Share.',
      details: [
        'Choose when to stop taking answers, and whether to ask for names or keep it anonymous.',
        'Publish and get your link. Publishing is on the paid plan; writing never is.',
        'Copy the link or send it by email, text or QR code. Anyone with it can answer, no account needed.',
        'Need to change a question? Move it back to draft. Answers you already have are kept.',
      ],
      action: 'See your pulses', route: '/app',
    },
    {
      n: 3, title: 'Results', tint: 'blue', lead: 'Results update the moment someone answers.',
      details: [
        'After 5 answers, TODD writes a summary of what people said and suggests one next move.',
        'Act on it right there: draft the email, add it to your tasks, or ask for another idea.',
        'Every question has its own chart, and TODD groups written answers by theme.',
        'Download a CSV any time. Close the pulse when you have enough.',
      ],
      action: 'Open results', route: '/app',
    },
  ];

  readonly tips = [
    { title: 'Keep it short', copy: 'Three to five questions. Every extra question means fewer people finish.' },
    { title: 'Ask one thing per question', copy: '“Was it fast and friendly?” is two questions. Split it so the answer means something.' },
    { title: 'Mix choice and text', copy: 'Multiple-choice gives you numbers you can compare. One open text question gives you the “why.”' },
    { title: 'Ask the right people', copy: 'Recent buyers, people who cancelled, and trial users who didn’t upgrade all tell you different things. Pick one group per Pulse.' },
    { title: 'Say why you’re asking', copy: 'A one-line description like “Help us pick next month’s menu” gets more answers than a bare survey.' },
    { title: 'Close the loop', copy: 'Tell respondents what you changed. People who see results answer the next Pulse.' },
  ];

  readonly faqs = [
    { question: 'What does Pulse cost?', answer: 'Building and saving Pulses is free, as many as you want. Publishing and collecting responses requires a Pulse plan. See Pricing for the current price.' },
    { question: 'Are responses anonymous?', answer: 'You choose when you publish. Ask for name and email, or keep it anonymous and Pulse won’t attach anyone’s details to their answers.' },
    { question: 'Can someone answer more than once?', answer: 'Pulse allows one response per device, so the same browser cannot submit the same Pulse twice.' },
    { question: 'Why can’t I submit my own Pulse?', answer: 'Owners can preview their Pulse but not answer it, so your own test answers never skew your results. Ask a colleague to send a test response.' },
    { question: 'How do I stop collecting responses?', answer: 'Choose Close now on the Share step, or set a date or answer limit before you publish. Back to draft also stops it, so you can edit and publish again.' },
    { question: 'Can I export my results?', answer: 'Yes. Choose CSV on the Results step to download every answer.' },
  ];

  ngOnInit (): void {
    this.showAfterSignIn.set( this.gettingStarted.showAfterSignIn );
    this.auth.getUserId().subscribe( ( userId ) => {
      this.signedIn.set( !!userId );
      if ( !userId ) {
        this.progress.set( null );
        this.active.set( 'how-it-works' );
        return;
      }
      this.gettingStarted.load()
        .then( ( progress ) => {
          this.progress.set( progress );
          if ( typeof location !== 'undefined' && location.hash === '#your-progress' ) setTimeout( () => this.jump( 'your-progress' ) );
        } )
        .catch( () => this.progress.set( null ) );
    } );
  }

  visibleNav () {
    return this.nav.filter( ( item ) => !item.signedInOnly || this.signedIn() );
  }

  jump ( id: string ): void {
    this.active.set( id );
    document.getElementById( id )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  askTodd (): void {
    this.assistant.openAssistant();
  }

  toggleFaq ( index: number ): void {
    this.openFaq.set( this.openFaq() === index ? -1 : index );
  }

  setShowAfterSignIn ( value: boolean ): void {
    this.showAfterSignIn.set( value );
    this.gettingStarted.showAfterSignIn = value;
  }

  progressPct (): number {
    const progress = this.progress();
    return progress ? ( progress.completedSteps / Math.max( 1, progress.totalSteps ) ) * 100 : 0;
  }
}
