import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { WordUpView } from '../../components/wordup/WordUpView';
import { useWordUpStore } from '../../store/useWordUpStore';
import { seedStore } from '../helpers/seedStore';
import { waitForStore } from '../helpers/waitForStore';
import { makeLiveMatch } from '../fixtures/matchData';
import { makeQuestionSet } from '../fixtures/questions';
import { makeProfile, makeOpponentProfile } from '../fixtures/profiles';
import { ConfirmationProvider } from '../../context/ConfirmationContext';

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

const testQuestions = makeQuestionSet(2);

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

describe('Integration: live game flow (real hooks)', () => {
  it('loads match and transitions loading → countdown', async () => {
    const match = makeLiveMatch({
      status: 'countdown',
      game_type: 'live',
      player1_id: 'test-user',
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
    });

    renderWordUp();

    await waitForStore(s => s.view === 'countdown' || s.view === 'battle', 10000);
    const currentView = useWordUpStore.getState().view;
    expect(['countdown', 'battle']).toContain(currentView);
  });

  it('loads opponent profile during match setup', async () => {
    const match = makeLiveMatch({
      status: 'countdown',
      game_type: 'live',
      player1_id: 'test-user',
      player2_id: 'opponent-user',
      questions: JSON.stringify(testQuestions),
      encryption_key: 'test-key',
      encrypted_questions: null,
    });

    const mock = (globalThis as any).__mockSupabase;
    mock.setTableData('wordup_matches', [match]);
    mock.setTableData('wordup_profiles', [
      makeProfile({ id: 'test-user' }),
      makeOpponentProfile({ id: 'opponent-user', username: 'Rival' }),
    ]);

    useWordUpStore.setState({
      view: 'loading',
      matchId: match.id,
      role: 'player1',
      matchData: match,
    });

    renderWordUp();

    await waitForStore(s => s.view === 'countdown' || s.view === 'battle', 10000);
    const store = useWordUpStore.getState();
    expect(store.matchData).toBeTruthy();
    expect(store.matchData.player1_id).toBe('test-user');
  });
});
