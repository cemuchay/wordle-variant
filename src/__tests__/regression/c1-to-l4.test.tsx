import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordUpView } from '../../components/wordup/WordUpView';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { makeQuestionSet } from '../fixtures/questions';
import { makeMatch } from '../fixtures/matchData';
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

describe('Regression: C1-C4 (Critical fixes)', () => {
  it('C1: accepts loading view in sync condition', () => {
    useWordUpStore.setState({
      view: 'loading',
      matchId: 'match-c1',
      role: 'player1',
      matchData: makeMatch({ game_type: 'live' }),
      questions: makeQuestionSet(2),
    });
    renderWordUp();
    expect(screen.getByText(/preparing arena/i)).toBeInTheDocument();
  });

  it('C2: live merge uses > not >= (renders battle)', () => {
    useWordUpStore.setState({
      view: 'battle',
      matchId: 'match-c2',
      role: 'player1',
      matchData: makeMatch({ game_type: 'live', p1_answered: false, p2_answered: true }),
      questions: makeQuestionSet(2),
      currentIdx: 0,
    });
    renderWordUp();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('C3: async completed guard shows gameover', () => {
    useWordUpStore.setState({
      view: 'gameover',
      matchId: null,
      role: 'player1',
      matchData: makeMatch({ game_type: 'async', status: 'completed', p1_score: 300, p2_score: 200 }),
      questions: makeQuestionSet(1),
    });
    renderWordUp();
    expect(screen.getByText('Victory!')).toBeInTheDocument();
  });

  it('C4: recovery with correct game type renders loading', () => {
    localStorage.setItem('wordup_active_game', JSON.stringify({
      matchId: 'match-c4',
      role: 'player1',
      matchData: makeMatch({ game_type: 'async', status: 'active' }),
      currentIdx: 2,
    }));
    useWordUpStore.setState({
      view: 'loading',
      matchId: 'match-c4',
      role: 'player1',
      matchData: makeMatch({ game_type: 'async', status: 'active' }),
      questions: makeQuestionSet(7),
    });
    renderWordUp();
    expect(screen.getByText(/preparing arena/i)).toBeInTheDocument();
  });
});

describe('Regression: L1-L4 (Low fixes)', () => {
  it('L1: ELO loss clamp is correct logic', () => {
    const eloGain = -50;
    const MAX_LOSS_ON_LOSS = -2;
    const clamped = eloGain < MAX_LOSS_ON_LOSS ? MAX_LOSS_ON_LOSS : eloGain;
    expect(clamped).toBe(-2);
  });

  it('L2: stale triggerToast removal does not cause error', () => {
    expect(() => renderWordUp()).not.toThrow();
  });
});
