import { SurveyQuestion } from '../../models/survey.model';
import { newQuestionId } from './pulse-state';

/** The four starters on New pulse (1b, and Pulsur's 2h). */
export interface PulseTemplate {
  key: string;
  label: string;
  blurb: string;
  tint: 'blue' | 'violet' | 'green' | 'pink';
  icon: string;
  title: string;
  description: string;
  questions: Omit<SurveyQuestion, 'id'>[];
}

export const PULSE_TEMPLATES: PulseTemplate[] = [
  {
    key: 'clientCheckIn',
    label: 'Client check-in',
    blurb: 'Are clients happy, and will they stay?',
    tint: 'blue',
    icon: 'users',
    title: 'Client check-in',
    description: 'Four quick questions about working with us. Takes about a minute.',
    questions: [
      { questionText: 'How likely are you to recommend us to a colleague?', questionType: 'rating', options: [], required: true },
      { questionText: 'Will you renew with us next year?', questionType: 'multiple_choice', options: ['Yes', 'Not sure', 'No'], required: true },
      { questionText: 'Which of our services do you use?', questionType: 'checkbox', options: ['Service one', 'Service two', 'Service three', 'Other'], required: false },
      { questionText: 'What should we do better?', questionType: 'textarea', options: [], required: false },
    ],
  },
  {
    key: 'eventFeedback',
    label: 'Event feedback',
    blurb: 'What worked and what to change next time',
    tint: 'violet',
    icon: 'cal',
    title: 'Event feedback',
    description: 'Two minutes to tell us how the event went, so the next one is better.',
    questions: [
      { questionText: 'How would you rate the event overall?', questionType: 'rating', options: [], required: true },
      { questionText: 'Which part was most useful?', questionType: 'multiple_choice', options: ['The talks', 'Meeting people', 'The workshop', 'Other'], required: false },
      { questionText: 'Was it the right length?', questionType: 'multiple_choice', options: ['Too short', 'About right', 'Too long'], required: false },
      { questionText: 'Would you come to the next one?', questionType: 'yes_no', options: [], required: true },
      { questionText: 'What should we change next time?', questionType: 'textarea', options: [], required: false },
    ],
  },
  {
    key: 'ideaCheck',
    label: 'Idea check',
    blurb: 'Would people pay for something new?',
    tint: 'green',
    icon: 'spark',
    title: 'Idea check',
    description: "We're thinking about something new and want your honest take first.",
    questions: [
      { questionText: 'How useful would this be for you?', questionType: 'rating', options: [], required: true },
      { questionText: 'Would you pay for it?', questionType: 'multiple_choice', options: ['Yes', 'Maybe, depending on price', 'No'], required: true },
      { questionText: 'What would you use it for first?', questionType: 'text', options: [], required: false },
      { questionText: 'What would stop you from trying it?', questionType: 'textarea', options: [], required: false },
    ],
  },
  {
    key: 'teamPulse',
    label: 'Team pulse',
    blurb: 'How your team is doing this month',
    tint: 'pink',
    icon: 'msg',
    title: 'Team pulse',
    description: 'A quick check-in on how this month is going. Be as honest as you like.',
    questions: [
      { questionText: 'How are you feeling about work this month?', questionType: 'rating', options: [], required: true },
      { questionText: 'How is your workload?', questionType: 'multiple_choice', options: ['Too light', 'About right', 'Too heavy'], required: true },
      { questionText: "What's getting in your way?", questionType: 'textarea', options: [], required: false },
    ],
  },
];

/** A template's questions with fresh ids, ready to save. */
export function templateQuestions ( template: PulseTemplate ): SurveyQuestion[] {
  return template.questions.map( ( question, index ) => ( {
    ...question,
    id: newQuestionId(),
    order: index,
    options: [...question.options],
    helpText: '',
    placeholder: '',
  } ) );
}
