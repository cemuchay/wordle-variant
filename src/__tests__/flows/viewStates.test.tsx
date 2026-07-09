import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordUpView } from '../../wordup/WordUpContainer';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { makeQuestionSet } from '../fixtures/questions';
import { makeMatch } from '../fixtures/matchData';
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

vi.mock('../../wordup/live/hooks/useGameEngine', () => ({
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
});

function renderWordUp() {
  return render(
    <ConfirmationProvider>
      <WordUpView />
    </ConfirmationProvider>
  );
}

describe('WordUpView state machine rendering', () => {
  it('renders lobby/menu by default', () => {
    renderWordUp();
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('WordUp Battles (Beta)')).toBeInTheDocument();
  });

  it('renders LoadingView when view is loading', () => {
    useWordUpStore.setState({ view: 'loading' });
    renderWordUp();
    expect(screen.getByText(/preparing arena/i)).toBeInTheDocument();
  });

  it('renders BattleView when view is battle', () => {
    useWordUpStore.setState({
      view: 'battle',
      questions: makeQuestionSet(2),
      matchId: 'test-match',
      role: 'player1',
      matchData: makeMatch({ game_type: 'live' }),
      currentIdx: 0,
    });
    renderWordUp();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('renders MatchmakingView when view is matchmaking', () => {
    useWordUpStore.setState({ view: 'matchmaking' });
    renderWordUp();
    expect(screen.getByText('Finding Match')).toBeInTheDocument();
  });

  it('renders GameOverView when view is gameover', () => {
    const match = makeMatch({
      status: 'completed',
      p1_score: 500,
      p2_score: 300,
      p1_answers: [{ question_idx: 0, correct: true, time_taken: 1, points: 100, choice: 'A0' }],
      p2_answers: [{ question_idx: 0, correct: false, time_taken: 2, points: 0, choice: 'B0' }],
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
    expect(screen.getByText('Match Completed')).toBeInTheDocument();
  });

  it('renders ConnectingView when view is connecting', () => {
    useWordUpStore.setState({ view: 'connecting' });
    renderWordUp();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });
});
