import { makeQuestionSet } from './questions';
import type { WordUpQuestion } from '../../utils/wordupQuestionGenerator';

interface MatchConfig {
  player1_id?: string;
  player2_id?: string;
  category?: string;
  game_type?: 'live' | 'live-bot' | 'async';
  status?: string;
  current_question_index?: number;
  p1_answers?: any[];
  p2_answers?: any[];
  p1_answered?: boolean;
  p2_answered?: boolean;
  p1_score?: number;
  p2_score?: number;
  questions?: WordUpQuestion[];
  encrypted_questions?: string;
  encryption_key?: string;
  role?: 'player1' | 'player2';
  bot_profile?: string;
}

const BASE_ID = '00000000-0000-0000-0000-000000000000';

export function makeMatch(overrides: MatchConfig = {}) {
  const questions = overrides.questions ?? makeQuestionSet();
  return {
    id: BASE_ID,
    created_at: new Date().toISOString(),
    category: overrides.category ?? 'mixed',
    player1_id: overrides.player1_id ?? 'user-test',
    player2_id: overrides.player2_id ?? 'opponent-test',
    status: overrides.status ?? 'active',
    game_type: overrides.game_type ?? 'live',
    current_question_index: overrides.current_question_index ?? 0,
    p1_answers: overrides.p1_answers ?? [],
    p2_answers: overrides.p2_answers ?? [],
    p1_answered: overrides.p1_answered ?? false,
    p2_answered: overrides.p2_answered ?? false,
    p1_score: overrides.p1_score ?? 0,
    p2_score: overrides.p2_score ?? 0,
    questions: JSON.stringify(questions),
    encrypted_questions: overrides.encrypted_questions ?? null,
    encryption_key: overrides.encryption_key ?? null,
    bot_profile: overrides.bot_profile ?? null,
    is_bot_match: overrides.game_type === 'live-bot',
  };
}

export function makeLiveMatch(overrides: MatchConfig = {}) {
  return makeMatch({ ...overrides, game_type: 'live' });
}

export function makeBotMatch(overrides: MatchConfig = {}) {
  return makeMatch({ ...overrides, game_type: 'live-bot', player2_id: '00000000-0000-0000-0000-000000000b0b' });
}

export function makeAsyncMatch(overrides: MatchConfig = {}) {
  return makeMatch({ ...overrides, game_type: 'async' });
}

export function makeCompletedMatch(overrides: MatchConfig = {}) {
  const questions = makeQuestionSet();
  const allAnswers = questions.map((q, i) => ({
    question_idx: i,
    correct: true,
    time_taken: 1.5,
    points: 100,
    choice: q.answer,
  }));
  return makeMatch({
    ...overrides,
    status: 'completed',
    current_question_index: 6,
    p1_answers: allAnswers,
    p2_answers: allAnswers,
    p1_score: 700,
    p2_score: 700,
    questions,
  });
}
