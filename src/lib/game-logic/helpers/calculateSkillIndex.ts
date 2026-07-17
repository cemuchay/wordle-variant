import { SCORING } from "@/constants/game";
import type { GuessResult } from "@/types/game";
import { calculateSkillIndexJuly2026 } from "../scoringJuly2026";

export const calculateSkillIndexSub = ({
   attempts,
   maxAttempts,
   usedHint,
   guesses,
   gameDate,
   hintRecord,
}: {
   attempts: number;
   maxAttempts: number;
   usedHint: boolean;
   guesses: GuessResult[][];
   gameDate?: string;
   hintRecord?: { index: number; letter: string; row?: number } | null;
}): {
   rows: number[];
   base: number;
   bonus: number;
   hint: number;
   decisions: {
      rowNumber: string;
      totalRowPoints: number;
      decisions: { letter: string; status: string; pointDeduction: number }[];
   }[];
   finalScore: number;
} => {
   const targetDate = new Date("2026-05-18");
   const julyTargetDate = new Date("2026-07-06");
   const currentDate = gameDate ? new Date(gameDate) : new Date();
   const isNewSystem = currentDate >= targetDate;
   const isJuly2026System = currentDate >= julyTargetDate;

   if (isJuly2026System) {
      return calculateSkillIndexJuly2026({
         attempts,
         maxAttempts,
         usedHint,
         guesses,
         hintRecord,
      });
   }

   if (!isNewSystem) {
      // Legacy scoring logic for backwards compatibility
      let score =
         ((maxAttempts - attempts + 1) / maxAttempts) * SCORING.BASE_SCORE_MAX;
      if (usedHint) score -= SCORING.HINT_PENALTY;

      let bonus = 0;
      guesses.forEach((row) => {
         row.forEach((cell) => {
            if (cell.status === "correct") bonus += 15;
            if (cell.status === "present") bonus += 2;
            if (cell.status === "absent") bonus -= 10;
         });
      });
      const finalScore: number = Math.floor(score + bonus);
      return {
         rows: [],
         base: 0,
         bonus: 0,
         hint: 0,
         decisions: [],
         finalScore,
      };
   }

   // REVAMPED ALGORITHM (Harmony with GuessPreviewModal)
   if (!guesses || guesses.length === 0)
      return {
         rows: [],
         base: 0,
         bonus: 0,
         hint: 0,
         decisions: [],
         finalScore: 0,
      };

   const rows: number[] = [];

   let totalBonus = 0;

   const wordsAwardedPoints: Array<{
      letter: string;
      index: number | undefined;
      status: string;
      awardRow: number;
      isChecked: boolean;
   }> = [];

   const rowPointDecisions: Array<{
      rowNumber: string;
      totalRowPoints: number;
      decisions: Array<{
         letter: string;
         status: string;
         pointDeduction: number;
      }>;
   }> = [];

   // 2. PROCESS ROWS: Calculate deductions for rows 1 to (N-1), award points on Row N

   for (let rowIndex = 0; rowIndex < guesses.length; rowIndex++) {
      const row = guesses[rowIndex];

      /* first row **/
      if (rowIndex === 0) {
         let points = 0;
         const localDecisions: Array<{
            letter: string;
            status: string;
            pointDeduction: number;
         }> = [];

         row.forEach(
            (cell: { letter: string; index?: number; status: string }) => {
               // CASE: YELLOW (Present but wrong spot)
               if (cell.status === "present") {
                  points += SCORING.YELLOW_SCORE_FIRST_TRY;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${SCORING.YELLOW_SCORE_FIRST_TRY} 1st try`,
                     pointDeduction: SCORING.YELLOW_SCORE_FIRST_TRY,
                  });
                  wordsAwardedPoints.push({
                     letter: cell.letter,
                     index: cell.index,
                     status: cell.status,
                     awardRow: rowIndex,
                     isChecked: false,
                  });
               }

               // CASE: BLACK (Absent)
               else if (cell.status === "absent") {
                  points -= SCORING.ABSENT_PENALTY;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} -${SCORING.ABSENT_PENALTY}`,
                     pointDeduction: -SCORING.ABSENT_PENALTY,
                  });
                  wordsAwardedPoints.push({
                     letter: cell.letter,
                     index: cell.index,
                     status: cell.status,
                     awardRow: rowIndex,
                     isChecked: false,
                  });
               }

               // CASE: GREEN (Correct)
               else if (cell.status === "correct") {
                  points += SCORING.POINTS_PER_LETTER_FIRST_TRY;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${SCORING.POINTS_PER_LETTER_FIRST_TRY} 1st try`,
                     pointDeduction: SCORING.POINTS_PER_LETTER_FIRST_TRY,
                  });
                  wordsAwardedPoints.push({
                     letter: cell.letter,
                     index: cell.index,
                     status: cell.status,
                     awardRow: rowIndex,
                     isChecked: false,
                  });
               }
            },
         );

         rowPointDecisions.push({
            rowNumber: `Row ${rowIndex}`,
            totalRowPoints: points,
            decisions: localDecisions,
         });

         rows.push(points);
         totalBonus += points;
      } else {
         const relevantAwardedWords = wordsAwardedPoints.filter(
            (item) => item.awardRow < rowIndex,
         );

         let points = 0;
         const localDecisions: Array<{
            letter: string;
            status: string;
            pointDeduction: number;
         }> = [];

         const localAwardedPoints: Array<{
            letter: string;
            index: number | undefined;
            status: string;
            awardRow: number;
            isChecked: boolean;
         }> = [];

         for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
            const cell = row[cellIndex];
            const isSecondGuess = rowIndex === 1;

            // CASE: YELLOW (Present but wrong spot)
            if (cell.status === "present") {
               /* we will scan all wordsAwardedPoints with present status and return fist instance matching letter*/
               const awardedOldYellow = relevantAwardedWords.find(
                  (item) =>
                     item.status === "present" &&
                     !item.isChecked &&
                     item.letter === cell.letter,
               );

               const oldGreen = wordsAwardedPoints.find(
                  (item) =>
                     item.status === "correct" &&
                     item.letter === cell.letter &&
                     !item.isChecked,
               );

               /* letter not present or isChecked */
               let freshYellow = !awardedOldYellow ? true : false;

               if (oldGreen && freshYellow) {
                  freshYellow = false;
               }

               if (awardedOldYellow) {
                  awardedOldYellow.isChecked = true;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} [no deduction or addition as points have already been given]`,
                     pointDeduction: 0,
                  });
               }

               if (oldGreen) {
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} [no deduction or addition as points have already been given]`,
                     pointDeduction: 0,
                  });
               }

               /* award fresh points for a new yellow discovery*/
               if (freshYellow) {
                  points += isSecondGuess
                     ? SCORING.YELLOW_SCORE_SECOND_TRY
                     : SCORING.YELLOW_SCORE;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${isSecondGuess ? SCORING.YELLOW_SCORE_SECOND_TRY : SCORING.YELLOW_SCORE} ${isSecondGuess ? "2nd try" : ""} `,
                     pointDeduction: isSecondGuess
                        ? SCORING.YELLOW_SCORE_SECOND_TRY
                        : SCORING.YELLOW_SCORE,
                  });
               }

               localAwardedPoints.push({
                  letter: cell.letter,
                  index: cell.index,
                  status: cell.status,
                  awardRow: rowIndex,
                  isChecked: false,
               });
            }

            // CASE: BLACK (Absent)
            else if (cell.status === "absent") {
               // we will check if cell letter is an old absent
               // relevantAwardedWords has all absents up to row - 1

               const oldAbsent = relevantAwardedWords.find(
                  (item) =>
                     item.letter === cell.letter && item.status === "absent",
               );

               if (oldAbsent) {
                  oldAbsent.isChecked = true;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} [penalty for repeated use of absent letter]`,
                     pointDeduction: -SCORING.REPEATED_ABSENT_PENALTY,
                  });

                  points -= SCORING.REPEATED_ABSENT_PENALTY;
               }

               /* award fresh points for a new absent discovery*/
               if (!oldAbsent) {
                  points -= SCORING.ABSENT_PENALTY;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} -${SCORING.ABSENT_PENALTY}`,
                     pointDeduction: -SCORING.ABSENT_PENALTY,
                  });
               }

               localAwardedPoints.push({
                  letter: cell.letter,
                  index: cell.index,
                  status: cell.status,
                  awardRow: rowIndex,
                  isChecked: false,
               });
            }

            // CASE: GREEN (Correct)
            else if (cell.status === "correct") {
               const oldGreen = wordsAwardedPoints.find(
                  (item) =>
                     item.status === "correct" &&
                     item.letter === cell.letter &&
                     !item.isChecked,
               );
               const oldYellow = wordsAwardedPoints.find(
                  (item) =>
                     item.status === "present" &&
                     item.letter === cell.letter &&
                     !item.isChecked,
               );

               const oldPresent = oldGreen || oldYellow;

               if (oldPresent) {
                  oldPresent.isChecked = true;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} [points already awarded]`,
                     pointDeduction: 0,
                  });
               }

               if (!oldPresent) {
                  // award fresh points
                  points += isSecondGuess
                     ? SCORING.POINTS_PER_LETTER_SECOND_TRY
                     : SCORING.POINTS_PER_LETTER;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${isSecondGuess ? SCORING.POINTS_PER_LETTER_SECOND_TRY : SCORING.POINTS_PER_LETTER} ${isSecondGuess ? "2nd try" : ""}`,
                     pointDeduction: isSecondGuess
                        ? SCORING.POINTS_PER_LETTER_SECOND_TRY
                        : SCORING.POINTS_PER_LETTER,
                  });
               }
               localAwardedPoints.push({
                  letter: cell.letter,
                  index: cell.index,
                  status: cell.status,
                  awardRow: rowIndex,
                  isChecked: false,
               });
            }
         }

         rowPointDecisions.push({
            rowNumber: `Row ${rowIndex}`,
            totalRowPoints: points,
            decisions: localDecisions,
         });

         localAwardedPoints.forEach((item) => {
            wordsAwardedPoints.push(item);
         });

         rows.push(points);
         totalBonus += points;
      }
   }

   let localHint = 0;

   // DEDUCT HINT POINTS
   if (hintRecord && hintRecord?.row !== undefined) {
      const rowBonus = rows[hintRecord.row - 1];
      if (rowBonus !== undefined) {
         localHint -= SCORING.HINT_PENALTY;
      }
   }

   // 3. FINAL AGGREGATION
   const currentAttempts = guesses.length;
   const won = guesses[currentAttempts - 1]?.every(
      (c: { status: string }) => c.status === "correct",
   );
   const baseScore = won
      ? Math.floor(
           ((maxAttempts - currentAttempts + 1) / maxAttempts) *
              SCORING.BASE_SCORE_MAX,
        )
      : 0;
   const finalScore: number = baseScore + totalBonus + localHint;

   return {
      rows,
      base: baseScore,
      bonus: totalBonus,
      hint: localHint,
      decisions: rowPointDecisions,
      finalScore,
   };
};
