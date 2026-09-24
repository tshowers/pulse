import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
  route?: string;
  action?: string;
}

interface HelpCard {
  title: string;
  copy: string;
}

interface HelpFaq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent {
  readonly audiences: HelpCard[] = [
    {
      title: 'Small business owners',
      copy: 'Find out why customers come back, why they stop, and what they wish you offered — without hiring a research firm.',
    },
    {
      title: 'Founders and product leads',
      copy: 'Check a pricing idea, a feature, or a message with real users before you spend the time building it.',
    },
    {
      title: 'Team leads',
      copy: 'Run a quick check-in with your team and see where people agree, where they don’t, and what is getting in the way.',
    },
  ];

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Start at Pulse Home',
      copy: 'Pulse Home is where you check how well you are listening. It scores your feedback habit and points to the one part of it that needs attention next.',
      details: [
        'Guests see a preview of the dashboard. Sign in to see your own Pulses and responses.',
        'Use the buttons at the top to jump to Create Pulse or Pulse List.',
        'See “How Pulse Home works” below for what each meter means.',
      ],
      route: '/app',
      action: 'Open Pulse Home',
    },
    {
      number: '02',
      title: 'Create a Pulse around one decision',
      copy: 'A Pulse is a short survey. The best ones ask about a single decision you are trying to make, so every answer helps you make it.',
      details: [
        'Give it a clear title and a one-line description so people know why you are asking.',
        'Add questions. Each one can be a text answer, a multiple-choice (pick one), or a checkbox (pick any).',
        'Add or remove answer options as you shape each question.',
        'Watch the live preview to see what respondents will see, then save. Saving is free.',
      ],
      route: '/survey-edit',
      action: 'Create a Pulse',
    },
    {
      number: '03',
      title: 'Publish and share it',
      copy: 'Open your Pulse from the Pulse List (called “Current Pulse” in the side menu) to take it from draft to live.',
      details: [
        'Preview it as a respondent will see it. Use Back to Edit if anything reads wrong.',
        'Publish when it is ready. Publishing requires a Pulse plan; building and saving drafts do not.',
        'Copy the share link and send it where your audience already is: email, text, a receipt, your site, or a team chat.',
        'Anyone with the link can answer. They do not need a Pulse account.',
      ],
      route: '/survey-list',
      action: 'Go to Pulse List',
    },
    {
      number: '04',
      title: 'Check it the way respondents will',
      copy: 'Before sending the link widely, walk through the live Pulse once, then have one person you trust complete it.',
      details: [
        'Use Open Live Survey to see the public page. People answer one question at a time with Next and Back.',
        'As the owner you can preview your own Pulse, but you cannot submit a response to it. Ask a colleague to send a test answer.',
        'After someone submits, they see a confirmation and their answers show up in your results.',
      ],
    },
    {
      number: '05',
      title: 'Read the results and pick one change',
      copy: 'The results dashboard shows how many people answered, how each option was chosen, and every written answer.',
      details: [
        'Open results from the Pulse List or from the Pulse itself.',
        'Start with the response count. A handful of answers is a hint; wait for more before making big calls.',
        'Read the written answers in full. They usually explain the numbers.',
        'Finish by writing down one thing you will do differently because of what you read.',
      ],
      route: '/survey-list',
      action: 'Open results from Pulse List',
    },
    {
      number: '06',
      title: 'Come back and run the next one',
      copy: 'Pulse pays off as a habit, not a one-time survey. Head back to Pulse Home, see what it flags, and start the next Pulse.',
      details: [
        'Once you have made your change, ask a follow-up Pulse to check whether it helped.',
        'Publish your drafts or delete them. Drafts sitting around lower your score on Home.',
        'Pick a regular rhythm, such as one Pulse a month, and stick to it.',
      ],
      route: '/app',
      action: 'Back to Pulse Home',
    },
  ];

  readonly meters: HelpCard[] = [
    { title: 'Feedback coverage', copy: 'The share of your Pulses that are collecting feedback right now.' },
    { title: 'Listening cadence', copy: 'The share of your Pulses that are published instead of sitting as drafts.' },
    { title: 'Response flow', copy: 'The share of your published Pulses that have received at least one response.' },
    { title: 'Draft pressure', copy: 'Higher is better. It drops as unpublished drafts pile up.' },
  ];

  readonly careCycle: HelpCard[] = [
    { title: 'Symptom', copy: 'What is wrong with your feedback loop, such as “Customer feedback is missing” or “Survey participation is low.”' },
    { title: 'Treatment', copy: 'What TODD is doing about it, such as watching published Pulses for the first responses.' },
    { title: 'Relief', copy: 'Whether the problem is getting better, and what would fix it.' },
    { title: 'Proof', copy: 'The numbers behind it, such as responses collected or Pulses published.' },
  ];

  readonly tips: HelpCard[] = [
    { title: 'Keep it short', copy: 'Three to five questions. Every extra question means fewer people finish.' },
    { title: 'Ask one thing per question', copy: '“Was it fast and friendly?” is two questions. Split it so the answer means something.' },
    { title: 'Mix choice and text', copy: 'Multiple-choice gives you numbers you can compare. One open text question gives you the “why.”' },
    { title: 'Ask the right people', copy: 'Recent buyers, people who cancelled, and trial users who didn’t upgrade all tell you different things. Pick one group per Pulse.' },
    { title: 'Say why you’re asking', copy: 'A one-line description like “Help us pick next month’s menu” gets more answers than a bare survey.' },
    { title: 'Close the loop', copy: 'Tell respondents what you changed. People who see results answer the next Pulse.' },
  ];

  readonly faqs: HelpFaq[] = [
    {
      question: 'What does Pulse cost?',
      answer: 'Building and saving Pulses is free, as many as you want. Publishing and collecting responses requires a Pulse plan. See Pricing for the current price.',
    },
    {
      question: 'Are responses anonymous?',
      answer: 'Respondents are not asked to sign in, and Pulse does not attach their name or email to their answers. If you need to know who answered, add a question that asks for it.',
    },
    {
      question: 'Can someone answer more than once?',
      answer: 'Pulse allows one response per device, so the same browser cannot submit the same Pulse twice.',
    },
    {
      question: 'Why can’t I submit my own Pulse?',
      answer: 'Owners can preview their Pulse but not answer it, so your own test answers never skew your results. Ask a colleague to send a test response.',
    },
    {
      question: 'How do I stop collecting responses?',
      answer: 'Open the Pulse and choose Move Back to Draft. It stops accepting responses, and you can edit it or publish it again later.',
    },
    {
      question: 'Can I export my results?',
      answer: 'Not yet. The results dashboard shows every option count and every written answer. If you need an export, contact Support.',
    },
  ];

  jumpTo ( id: string ): void {
    document.getElementById( id )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }
}
