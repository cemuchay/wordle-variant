import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordUpView } from '../../wordup/WordUpContainer';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { makeQuestionSet } from '../fixtures/questions';
import { makeBotMatch } from '../fixtures/matchData';
import { ConfirmationProvider } from '../../context/ConfirmationProvider';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user', user_metadata: { full_name: 'TestPlayer' } } }),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    triggerToast: () => {},
    realtimeStatus: 'connected' as const,
    onlineUsers: [],
    profile: { id: 'test-user', username: 'TestPlayer' },
    allProfiles: [],
  }),
}));

vi.mock('../../wordup/shared/useServerTime', () => ({
  useServerTime: () => ({ getSyncedNow: () => Date.now() }),
}));

vi.mock('../../wordup/shared/useWordUpProfile', () => ({
  useWordUpProfile: () => ({
    userStats: { rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: 'Bronze' },
    getRankColor: () => 'text-gray-400',
    updateStats: () => Promise.resolve(),
    fetchUserProfile: () => Promise.resolve(),
  }),
}));

vi.mock('../../wordup/live/hooks/useMatchmaking', () => ({
  useWordUpMatchmaking: () => ({
    startMatchmaking: () => {},
    cancelMatchmaking: () => {},
    countdownSecs: 6,
  }),
}));

vi.mock('../../wordup/live/hooks/useGameEngine.new', () => ({
  useGameEngine: () => {
    const s = useWordUpStore.getState();
    return {
      questions: s.questions,
      currentIdx: s.currentIdx,
      matchData: s.matchData,
      opponentStats: s.opponentStats,
      maxTime: s.maxTime,
      selectedAnswer: s.selectedAnswer,
      revealAnswers: s.revealAnswers,
      handleAnswerSelect: () => {},
      loadAndSubscribeMatch: () => Promise.resolve(),
      startQuestionRound: () => {},
      cleanUpIntervals: () => {},
      rematchState: 'idle' as const,
      rematchCountdown: 0,
      showRematchButton: s.view === 'gameover',
      sendRematch: () => {},
      acceptRematch: () => {},
      sendQuickChat: () => {},
      matchChannelRef: { current: null },
    };
  },
  getQuestionDuration: () => 10,
}));

beforeEach(() => {
  seedStore();
  localStorage.clear();
  const mock = (globalThis as any).__mockSupabase;
  if (mock) mock.channels.clear();
});

function renderWordUp() {
  return render(
    <ConfirmationProvider>
      <WordUpView />
    </ConfirmationProvider>
  );
}

describe('Bot game flow', () => {
  it('renders bot battle view', () => {
    const questions = makeQuestionSet(2);
    useWordUpStore.setState({
      view: 'battle',
      questions,
      matchId: 'bot-match-test',
      role: 'player1',
      matchData: makeBotMatch({ game_type: 'live-bot' }),
      currentIdx: 0,
    });
    renderWordUp();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('renders bot gameover', () => {
    const match = makeBotMatch({
      status: 'completed',
      p1_score: 400,
      p2_score: 300,
      p1_answers: [{ question_idx: 0, correct: true, time_taken: 1, points: 100, choice: 'A0' }],
    });
    useWordUpStore.setState({
      view: 'gameover',
      matchId: null,
      role: 'player1',
      matchData: match,
      questions: makeQuestionSet(1),
    });
    renderWordUp();
    expect(screen.getByText('Victory!')).toBeInTheDocument();
  });

  it('shows rematch button on gameover', () => {
    const match = makeBotMatch({
      status: 'completed',
      bot_profile: 'average',
      p1_score: 300,
      p2_score: 300,
      p1_answers: [{ question_idx: 0, correct: false, time_taken: 2, points: 0, choice: 'B0' }],
    });
    useWordUpStore.setState({
      view: 'gameover',
      matchId: null,
      role: 'player1',
      matchData: match,
      questions: makeQuestionSet(1),
    });
    renderWordUp();
    expect(screen.getByText('Draw!')).toBeInTheDocument();
  });
});
