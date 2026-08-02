/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SubGameResult {
   gameIndex: number;
   roundRange: [number, number];
   myScore: number;
   oppScore: number;
   outcome: "win" | "draw" | "loss";
   eloChange: number;
   xpWinBonus: number;
}

export interface MatchRewardResult {
   totalQuestions: number;
   subGameCount: number;
   subGames: SubGameResult[];
   totalEloChange: number;
   baseCompletionXp: number;
   winBonusXp: number;
   correctAnswersXp: number;
   totalXpEarned: number;
   totalCorrectAnswers: number;
   winsCount: number;
   drawsCount: number;
   lossesCount: number;
   overallWinner: boolean;
   overallDraw: boolean;
}

export function calculateMatchRewards(
   matchData: any,
   role: "player1" | "player2" | null,
   questionsCount?: number
): MatchRewardResult {
   const isP1 = role === "player1";
   const myAnswers: any[] = (isP1 ? matchData?.p1_answers : matchData?.p2_answers) || [];
   const oppAnswers: any[] = (isP1 ? matchData?.p2_answers : matchData?.p1_answers) || [];

   const totalQuestions = questionsCount || matchData?.total_rounds || 7;
   const subGameCount = Math.max(1, Math.floor(totalQuestions / 7));

   const subGames: SubGameResult[] = [];
   let totalEloChange = 0;
   let winBonusXp = 0;
   let winsCount = 0;
   let drawsCount = 0;
   let lossesCount = 0;

   for (let g = 0; g < subGameCount; g++) {
      const startIdx = g * 7;
      const endIdx = Math.min(totalQuestions, (g + 1) * 7);

      let mySubScore = 0;
      let oppSubScore = 0;

      for (let idx = startIdx; idx < endIdx; idx++) {
         const myAns = myAnswers.find((a: any) => a?.question_idx === idx) || myAnswers[idx];
         const oppAns = oppAnswers.find((a: any) => a?.question_idx === idx) || oppAnswers[idx];

         mySubScore += myAns?.points || 0;
         oppSubScore += oppAns?.points || 0;
      }

      let outcome: "win" | "draw" | "loss" = "draw";
      let eloChange = 0;
      let gameWinXp = 0;

      if (mySubScore > oppSubScore) {
         outcome = "win";
         eloChange = 18;
         gameWinXp = 100;
         winsCount++;
      } else if (mySubScore === oppSubScore) {
         outcome = "draw";
         eloChange = 2;
         gameWinXp = 50;
         drawsCount++;
      } else {
         outcome = "loss";
         eloChange = -12;
         gameWinXp = 0;
         lossesCount++;
      }

      totalEloChange += eloChange;
      winBonusXp += gameWinXp;

      subGames.push({
         gameIndex: g,
         roundRange: [startIdx + 1, endIdx],
         myScore: mySubScore,
         oppScore: oppSubScore,
         outcome,
         eloChange,
         xpWinBonus: gameWinXp,
      });
   }

   const myTotalScore = isP1 ? (matchData?.p1_score || 0) : (matchData?.p2_score || 0);
   const oppTotalScore = isP1 ? (matchData?.p2_score || 0) : (matchData?.p1_score || 0);

   const overallWinner = myTotalScore > oppTotalScore;
   const overallDraw = myTotalScore === oppTotalScore;

   const totalCorrectAnswers = myAnswers.filter((a: any) => a?.correct).length;
   const correctAnswersXp = totalCorrectAnswers * 10;
   const baseCompletionXp = 50 * subGameCount;
   const totalXpEarned = baseCompletionXp + winBonusXp + correctAnswersXp;

   return {
      totalQuestions,
      subGameCount,
      subGames,
      totalEloChange,
      baseCompletionXp,
      winBonusXp,
      correctAnswersXp,
      totalXpEarned,
      totalCorrectAnswers,
      winsCount,
      drawsCount,
      lossesCount,
      overallWinner,
      overallDraw,
   };
}
