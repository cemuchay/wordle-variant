import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WordUpView } from '../../components/wordup/WordUpView';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { waitForStore } from '../helpers/waitForStore';
import { makeAsyncMatch } from '../fixtures/matchData';
import { makeQuestionSet } from '../fixtures/questions';
import { makeProfile } from '../fixtures/profiles';
import { ConfirmationProvider } from '../../context/ConfirmationProvider';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user', user_metadata: { full_name: 'TestPlayer' } } }),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    triggerToast: () => {},
    realtimeStatus: 'connected' as const,
    onlineUsers: [],
    profile: null,
    allProfiles: [],
  }),
}));

const testQuestions = makeQuestionSet(7);

vi.mock('../../utils/wordupQuestionGenerator', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    decryptMatchQuestions: () => Promise.resolve(testQuestions),
  };
});

beforeEach(() => {
  seedStore();
  localStorage.clear();
  const mock = (globalThis as any).__mockSupabase;
  if (mock) {
    mock.channels.clear();
    mock.tables = {};
  }
});

function renderWordUp() {
  return render(
    <ConfirmationProvider>
      <WordUpView />
    </ConfirmationProvider>
  );
}

describe('Integration: async game flow (real hooks)', () => {
  it('loads async match and shows loading for pending opponent', async () => {
    const match = makeAsyncMatch({
      status: 'active',
      game_type: 'async',
      player1_id: 'test-user',
      current_question_index: 2,
      questions: JSON.stringify(testQuestions),
      encryption_key: 'test-key',
      encrypted_questions: null,
    });

    const mock = (globalThis as any).__mockSupabase;
    mock.setTableData('wordup_matches', [match]);
    mock.setTableData('wordup_profiles', [makeProfile()]);

    useWordUpStore.setState({
      view: 'loading',
      matchId: match.id,
      role: 'player1',
      matchData: match,
    });

    renderWordUp();

    await waitForStore(s => s.view === 'battle' || s.view === 'loading', 10000);
    const store = useWordUpStore.getState();
    expect(store.matchData).toBeTruthy();
    expect(store.matchData.game_type).toBe('async');
  });

  it('handles completed async match by resetting to menu', async () => {
    const match = makeAsyncMatch({
      status: 'completed',
      game_type: 'async',
      player1_id: 'test-user',
      p1_score: 100,
      p2_score: 200,
      questions: JSON.stringify(testQuestions),
      encryption_key: 'test-key',
      encrypted_questions: null,
    });

    const mock = (globalThis as any).__mockSupabase;
    mock.setTableData('wordup_matches', [match]);
    mock.setTableData('wordup_profiles', [makeProfile()]);

    useWordUpStore.setState({
      view: 'loading',
      matchId: match.id,
      role: 'player1',
      matchData: match,
    });

    renderWordUp();

    // The async hook detects completed status, the app's error handler
    // resets the game and transitions to menu.
    await waitForStore(s => s.view === 'menu', 15000);
    expect(useWordUpStore.getState().view).toBe('menu');
  });
});
