/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UseChallengeGameEngineProps {
   challenge: any;
   participation: any;
   triggerToast: (msg: string, duration?: number) => void;
   submitChallengeResult: (
      result: any,
      wordLength?: number,
      gameIndex?: number,
   ) => Promise<boolean>;
   onFinish: () => void;
   gameIndex?: number | null; // For Marathon mode
   onLengthComplete?: () => void; // Callback for Marathon mode
}

export interface NetworkLog {
   id: string;
   msg: string;
   duration?: number;
}
