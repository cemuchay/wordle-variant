// ── Shared helpers ─────────────────────────────────────────────────

export function generateUserId(): string {
   return crypto.randomUUID();
}

export function sleep(ms: number): Promise<void> {
   return new Promise((r) => setTimeout(r, ms));
}

export function randChoice<T>(arr: T[]): T {
   return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(v: number, min: number, max: number): number {
   return Math.max(min, Math.min(max, v));
}

export function formatDuration(ms: number): string {
   if (ms < 1000) return `${ms}ms`;
   if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
   return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
