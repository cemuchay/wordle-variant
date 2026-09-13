import { describe, it, expect, beforeEach } from 'vitest';
import { runOneTimeTasks } from '../oneTimeTasks';
import { safeLocalStorage } from '../storage';

describe('runOneTimeTasks', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('removes wordle_social_lb_view_mode from localStorage on first run', async () => {
    safeLocalStorage.setItem('wordle_social_lb_view_mode', 'card');
    expect(safeLocalStorage.getItem('wordle_social_lb_view_mode')).toBe('card');

    const executed = await runOneTimeTasks();
    expect(executed).toBeGreaterThan(0);
    expect(safeLocalStorage.getItem('wordle_social_lb_view_mode')).toBeNull();
    expect(safeLocalStorage.getItem('wordle_task_done_cleanup_social_lb_view_mode_ls')).toBe('true');
  });

  it('does not re-execute tasks on subsequent runs', async () => {
    safeLocalStorage.setItem('wordle_social_lb_view_mode', 'card');

    const firstRun = await runOneTimeTasks();
    expect(firstRun).toBeGreaterThan(0);

    // Simulate setting key again manually
    safeLocalStorage.setItem('wordle_social_lb_view_mode', 'card');

    const secondRun = await runOneTimeTasks();
    expect(secondRun).toBe(0);
    // Should remain because task flag was set
    expect(safeLocalStorage.getItem('wordle_social_lb_view_mode')).toBe('card');
  });
});
