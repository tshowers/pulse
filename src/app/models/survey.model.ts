export type SurveyQuestionType =
    | 'text'
    | 'textarea'
    | 'multiple_choice'
    | 'checkbox'
    | 'yes_no'
    | 'rating'
    | 'dropdown'
    | 'date'
    | 'email'
    | 'number';

export type SurveyStatus = 'draft' | 'published' | 'archived';

export type SurveyVisibility = 'private' | 'public' | 'link_only';

export interface SurveyQuestion {
    /** Stable for the life of the question - answers are stored by it. */
    id?: string;
    order?: number;
    questionText: string;
    questionType: SurveyQuestionType | string;
    options: string[];
    required?: boolean;
    helpText?: string;
    placeholder?: string;
}

/** When a live pulse stops taking answers (Share step). */
export interface SurveyCloseRule {
    type: 'manual' | 'date' | 'count';
    /** ISO date for `date`, answer count for `count`. */
    value?: string | number | null;
}

/** The compact TODD summary that rides along on survey reads and lists. */
export interface ToddInsightsSummary {
    state: ToddInsightsState;
    answerCount: number;
    updatedAt: string | null;
    summary: string;
    nextMove: { id: string; text: string; } | null;
}

export interface Survey {
    id?: string;
    tenantId?: string;
    ownerId?: string;
    title: string;
    description: string;
    questions: SurveyQuestion[];
    status?: SurveyStatus;
    visibility?: SurveyVisibility;
    responseCount?: number;
    publishedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    lastViewedAt?: string | null;

    // Server-owned; ignored on write.
    newSinceViewed?: number;
    everPublished?: boolean;
    closedAt?: string | null;
    triedAt?: string | null;
    lastResponseAt?: string | null;
    /** Sent back on PUT so the server can refuse a stale save (409). */
    revision?: number;
    insights?: ToddInsightsSummary;

    closeRule?: SurveyCloseRule;
    /** True: ask respondents for name and email. False: anonymous. */
    collectIdentity?: boolean;

    // Legacy timestamp support during migration.
    dateAdded?: string;
    lastUpdated?: string;
    lastViewed?: string;
}

/** What /take/:id gets: the pulse plus who it's from. */
export interface PublicSurvey extends Survey {
    ownerDisplay?: { name: string; };
}

export interface SurveyListResult {
    surveys: Survey[];
    nextPageToken?: string | null;
}

export interface SurveySearchRequest {
    query?: string;
    pageSize?: number;
    pageToken?: string | null;
    status?: SurveyStatus;
    visibility?: SurveyVisibility;
}

// ── Results (GET /surveys/:id/results) ─────────────────────────────────────

export type QuestionResultKind = 'rating' | 'choice' | 'number' | 'text';

export interface QuestionResult {
    questionId: string;
    questionText: string;
    questionType: string;
    kind: QuestionResultKind;
    responseCount: number;
    average?: number | null;
    histogram?: number[];
    tally?: Record<string, number>;
    options?: { label: string; count: number; pct: number; }[];
    quotes?: { responseId: string; text: string; submittedAt: string; }[];
}

export interface SurveyResults {
    surveyId: string;
    title: string;
    totalResponses: number;
    last24h: number;
    lastResponseAt: string | null;
    questions: QuestionResult[];
}

// ── TODD (GET /surveys/:id/insights and the todd/* actions) ────────────────

export type ToddInsightsState = 'waiting' | 'pending' | 'ready' | 'error';
export type NextMoveAction = 'draft_email' | 'add_task' | 'another_idea';

export interface ToddNextMove {
    id: string;
    text: string;
    why: string;
    segment: { questionId: string; values: string[]; } | null;
    recipientCount: number;
    taskId: string | null;
    actions: NextMoveAction[];
}

export interface ToddInsights {
    surveyId: string;
    state: ToddInsightsState;
    minAnswers: number;
    responseCount: number;
    answerCount: number;
    updatedAt: string | null;
    summary: string;
    findings: { n: string; text: string; }[];
    nextMove: ToddNextMove | null;
    themesByQuestion: Record<string, { label: string; count: number; responseIds: string[]; }[]>;
    capabilities: { movesTasks: boolean; draftEmail: boolean; };
}

export interface ToddDraft {
    title: string;
    description: string;
    questions: SurveyQuestion[];
}

export interface ToddSuggestion {
    id: string;
    questionId: string | null;
    action: 'replace' | 'remove' | 'add';
    message: string;
    label: string;
    question: { questionText: string; questionType: string; options: string[]; } | null;
}

export interface ToddEmailDraft {
    subject: string;
    body: string;
    recipients: string[];
    recipientCount: number;
    truncated: boolean;
    mailto: string;
}
