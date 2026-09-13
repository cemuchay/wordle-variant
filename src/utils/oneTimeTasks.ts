import { safeLocalStorage } from './storage';

export interface OneTimeTask {
  id: string;
  description: string;
  run: () => void | Promise<void>;
}

/**
 * Registry of one-time client tasks.
 * Each task has a unique ID and will run exactly once per browser/user.
 */
const tasks: OneTimeTask[] = [
  {
    id: 'cleanup_social_lb_view_mode_ls',
    description: 'Remove legacy wordle_social_lb_view_mode key from localStorage if present',
    run: () => {
      safeLocalStorage.removeItem('wordle_social_lb_view_mode');
    },
  },
];

/**
 * Executes all pending one-time tasks that haven't been completed on this client.
 */
export async function runOneTimeTasks(): Promise<number> {
  let executedCount = 0;

  for (const task of tasks) {
    const flagKey = `wordle_task_done_${task.id}`;
    const alreadyDone = safeLocalStorage.getItem(flagKey) === 'true';

    if (!alreadyDone) {
      try {
        await task.run();
        safeLocalStorage.setItem(flagKey, 'true');
        executedCount++;
      } catch (err) {
        console.warn(`[OneTimeTask] Execution failed for task "${task.id}":`, err);
      }
    }
  }

  return executedCount;
}
