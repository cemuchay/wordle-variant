import { useWordUpStore } from '../../store/useWordUpStore';
import type { WordUpQuestion } from '../../utils/wordupQuestionGenerator';

const defaultState: Record<string, any> = {
  isBattlePlaying: false,
  view: 'menu',
  category: 'mixed',
  matchId: null,
  role: null,
  questions: [],
  currentIdx: 0,
  matchData: null,
  opponentStats: null,
  countdownSecs: 6,
  timeLeft: 10.0,
  maxTime: 10.0,
  selectedAnswer: null,
  revealAnswers: false,
};

export function seedStore(overrides: Record<string, any> = {}) {
  useWordUpStore.setState({ ...defaultState, ...overrides });
}

export function seedBattleStore(questions: WordUpQuestion[], overrides: Record<string, any> = {}) {
  seedStore({
    view: 'battle',
    questions,
    matchId: '00000000-0000-0000-0000-000000000000',
    role: 'player1',
    matchData: { game_type: 'live' },
    currentIdx: 0,
    ...overrides,
  });
}
