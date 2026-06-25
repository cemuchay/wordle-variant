/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GameEngineConfig {
    word: string;
    length: number;
    maxAttempts: number;
    date: string;
}

export interface GameEngineState {
    guesses: any[];
    currentGuess: string;
    cursorIndex: number;
    editIndex: number | null;
    isGameOver: boolean;
    isWon: boolean;
    isLost: boolean;
    isRevealing: boolean;
    isShake: boolean;
    usedHint: boolean;
    hintRecord: any | null;
    gameMessage: string;
    isGameOverModalOpen: boolean;
    syncStatus: "idle" | "syncing" | "synced" | "error";
    syncError: Error | null;
}
