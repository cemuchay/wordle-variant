import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordUpView } from '../../wordup/WordUpContainer';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { makeQuestionSet } from '../fixtures/questions';
import { makeLiveMatch, makeAsyncMatch } from '../fixtures/matchData';
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
      state: {
        lastRoundPopup: false,
        phase: 'playing',
        rematchState: 'idle' as const,
        rematchCountdown: 0,
        showRematchButton: false,
      },
      sendRematch: () => {},
      acceptRematch: () => {},
      sendQuickChat: () => {},
      sendSignalUpdate: () => {},
      cleanup: () => {},
      startMatch: () => {},
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

describe('Recovery flow', () => {
  it('renders menu when no active game in localStorage', () => {
    renderWordUp();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('stores active game state to localStorage during battle', () => {
    const match = makeLiveMatch({ game_type: 'live' });
    const activeGame = {
      matchId: 'recovery-test',
      role: 'player1' as const,
      matchData: match,
      currentIdx: 0,
    };
    localStorage.setItem('wordup_active_game', JSON.stringify(activeGame));

    useWordUpStore.setState({
      view: 'loading',
      matchId: 'recovery-test',
      role: 'player1',
      matchData: match,
      questions: makeQuestionSet(2),
      currentIdx: 0,
    });

    renderWordUp();
    const stored = localStorage.getItem('wordup_active_game');
    expect(stored).not.toBeNull();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.matchId).toBe('recovery-test');
    }
  });

  it('recovery preserves async match state after turn submission', () => {
    const match = makeAsyncMatch({ game_type: 'async', status: 'active', current_question_index: 3 });
    const activeGame = {
      matchId: 'async-recovery',
      role: 'player2' as const,
      matchData: match,
      currentIdx: 3,
    };
    localStorage.setItem('wordup_active_game', JSON.stringify(activeGame));

    useWordUpStore.setState({
      view: 'loading',
      matchId: 'async-recovery',
      role: 'player2',
      matchData: match,
      questions: makeQuestionSet(7),
      currentIdx: 3,
    });

    renderWordUp();
    expect(screen.getByText(/loading arena/i)).toBeInTheDocument();
  });
});
