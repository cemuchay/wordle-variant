import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattleView } from '../../components/wordup/WordUpView/components/BattleView';
import { ConfirmationProvider } from '../../context/ConfirmationProvider';
import { makeQuestion } from '../fixtures/questions';
import { useWordUpStore } from '../../store/useWordUpStore';

function renderBattleView(overrides: Record<string, any> = {}) {
  const questions = overrides.questions ?? [makeQuestion(), makeQuestion()];
  const defaultProps: any = {
    questions,
    currentIdx: 0,
    matchData: { game_type: 'live' as const, player1_id: 'user', player2_id: 'opponent' },
    opponentStats: null,
    maxTime: 10,
    selectedAnswer: null,
    revealAnswers: false,
    handleAnswerSelect: vi.fn(),
    role: 'player1' as const,
    playerProfile: { id: 'user', username: 'TestPlayer' },
    sendQuickChat: vi.fn(),
    onAbort: vi.fn(),
    ...overrides,
  };

  useWordUpStore.setState({
    view: 'battle',
    questions,
    currentIdx: overrides.currentIdx ?? 0,
    matchData: defaultProps.matchData,
    role: 'player1',
    selectedAnswer: null,
    revealAnswers: false,
  });

  return render(
    <ConfirmationProvider>
      <BattleView {...defaultProps} />
    </ConfirmationProvider>
  );
}

describe('BattleView', () => {
  it('renders prompt and choices for current question', () => {
    renderBattleView();
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
  });

  it('shows player score', () => {
    renderBattleView({ matchData: { p1_score: 300, p2_score: 200 } });
    const ptsElements = screen.getAllByText((_content, element) => {
      return element?.textContent?.includes('300') ?? false;
    });
    expect(ptsElements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls handleAnswerSelect when clicking an answer', async () => {
    const handleAnswerSelect = vi.fn();
    renderBattleView({ handleAnswerSelect });
    await userEvent.click(screen.getByText('Paris'));
    expect(handleAnswerSelect).toHaveBeenCalledWith('Paris');
  });

  it('shows reveal state after answer selection', () => {
    renderBattleView({ revealAnswers: true, selectedAnswer: 'Paris' });
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });
});
