import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordUpView } from '../../components/wordup/WordUpView';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { makeQuestionSet } from '../fixtures/questions';
import { makeAsyncMatch } from '../fixtures/matchData';
import { ConfirmationProvider } from '../../context/ConfirmationContext';

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

vi.mock('../../components/wordup/WordUpView/hooks/useServerTime', () => ({
  useServerTime: () => ({ getSyncedNow: () => Date.now() }),
}));

vi.mock('../../components/wordup/WordUpView/hooks/useWordUpProfile', () => ({
  useWordUpProfile: () => ({
    userStats: { rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: 'Bronze' },
    getRankColor: () => 'text-gray-400',
    updateStats: () => Promise.resolve(),
    fetchUserProfile: () => Promise.resolve(),
  }),
}));

vi.mock('../../components/wordup/WordUpView/hooks/useMatchmaking', () => ({
  useWordUpMatchmaking: () => ({
    startMatchmaking: () => {},
    cancelMatchmaking: () => {},
    countdownSecs: 6,
  }),
}));

vi.mock('../../components/wordup/WordUpView/hooks/useWordUpGameLoop', () => ({
  useWordUpGameLoop: () => {
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
      showRematchButton: false,
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

describe('Async game flow', () => {
  it('renders async battle view', () => {
    const questions = makeQuestionSet(2);
    useWordUpStore.setState({
      view: 'battle',
      questions,
      matchId: 'async-match-test',
      role: 'player1',
      matchData: makeAsyncMatch({ game_type: 'async' }),
      currentIdx: 0,
    });
    renderWordUp();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('renders async gameover when completed', () => {
    const match = makeAsyncMatch({
      status: 'completed',
      p1_score: 0,
      p2_score: 700,
      p1_answers: [],
      p2_answers: [{ question_idx: 0, correct: true, time_taken: 1, points: 100, choice: 'A0' }],
    });
    useWordUpStore.setState({
      view: 'gameover',
      matchId: null,
      role: 'player1',
      matchData: match,
      questions: makeQuestionSet(1),
    });
    renderWordUp();
    expect(screen.getByText('Defeat')).toBeInTheDocument();
    expect(screen.getByText('Match Completed')).toBeInTheDocument();
  });

  it('renders async loading view for pending opponent turn', () => {
    useWordUpStore.setState({
      view: 'loading',
      matchId: 'async-pending-test',
      role: 'player1',
      matchData: makeAsyncMatch({ status: 'active', game_type: 'async' }),
      questions: [],
    });
    renderWordUp();
    expect(screen.getByText(/preparing arena/i)).toBeInTheDocument();
  });
});
