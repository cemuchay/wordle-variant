/* eslint-disable @typescript-eslint/no-explicit-any */
import { SCORING } from "../../constants/game";

export const calculateSkillIndexJuly2026 = ({
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   attempts,
   maxAttempts,
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   usedHint,
   guesses,
   hintRecord,
}: {
   attempts: number;
   maxAttempts: number;
   usedHint: boolean;
   guesses: any[][];
   hintRecord?: { index: number; letter: string; row?: number } | null;
}) => {
   if (!guesses || guesses.length === 0)
      return {
         rows: [],
         base: 0,
         bonus: 0,
         hint: 0,
         decisions: [],
         finalScore: 0,
      };

   const getJuly2026Points = (rIdx: number, stat: "correct" | "present") => {
      if (stat === "correct") {
         if (rIdx === 0) return 65;
         if (rIdx === 1) return 55;
         if (rIdx === 2) return 45;
         if (rIdx === 3) return 35;
         if (rIdx === 4) return 25;
         return 20; // Row >= 5
      } else {
         if (rIdx === 0) return 50;
         if (rIdx === 1) return 40;
         if (rIdx === 2) return 30;
         if (rIdx === 3) return 20;
         if (rIdx === 4) return 15;
         return 10; // Row >= 5
      }
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

   for (let rowIndex = 0; rowIndex < guesses.length; rowIndex++) {
      const row = guesses[rowIndex];

      if (rowIndex === 0) {
         let points = 0;
         const localDecisions: Array<{
            letter: string;
            status: string;
            pointDeduction: number;
         }> = [];

         row.forEach(
            (cell: { letter: string; index?: number; status: string }) => {
               if (cell.status === "present") {
                  const yScore = getJuly2026Points(0, "present");
                  points += yScore;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${yScore} 1st try`,
                     pointDeduction: yScore,
                  });
                  wordsAwardedPoints.push({
                     letter: cell.letter,
                     index: cell.index,
                     status: cell.status,
                     awardRow: rowIndex,
                     isChecked: false,
                  });
               } else if (cell.status === "absent") {
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
               } else if (cell.status === "correct") {
                  const gScore = getJuly2026Points(0, "correct");
                  points += gScore;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${gScore} 1st try`,
                     pointDeduction: gScore,
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

            if (cell.status === "present") {
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

               let freshYellow = !awardedOldYellow;

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

               if (freshYellow) {
                  const yellowScore = getJuly2026Points(rowIndex, "present");
                  points += yellowScore;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${yellowScore}`,
                     pointDeduction: yellowScore,
                  });
               }

               // Regression check: Green to Yellow
               const wasPrevGreenLetter = guesses
                  .slice(0, rowIndex)
                  .some((prevRow) =>
                     prevRow.some(
                        (prevCell) =>
                           prevCell.letter === cell.letter &&
                           prevCell.status === "correct",
                     ),
                  );
               if (wasPrevGreenLetter) {
                  points -= 5;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `regression: green to yellow -5`,
                     pointDeduction: -5,
                  });
               }

               // Regression check: Yellow same spot
               const wasPrevYellowAtSameSpot = guesses
                  .slice(0, rowIndex)
                  .some(
                     (prevRow) =>
                        prevRow[cellIndex]?.letter === cell.letter &&
                        prevRow[cellIndex]?.status === "present",
                  );
               if (wasPrevYellowAtSameSpot) {
                  points -= 5;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `regression: yellow same spot -5`,
                     pointDeduction: -5,
                  });
               }

               localAwardedPoints.push({
                  letter: cell.letter,
                  index: cell.index,
                  status: cell.status,
                  awardRow: rowIndex,
                  isChecked: false,
               });
            } else if (cell.status === "absent") {
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

               if (!oldAbsent) {
                  points -= SCORING.ABSENT_PENALTY;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} -${SCORING.ABSENT_PENALTY}`,
                     pointDeduction: -SCORING.ABSENT_PENALTY,
                  });
               }

               // Regression check: Green to Black
               const wasPrevGreen = guesses
                  .slice(0, rowIndex)
                  .some((prevRow) => prevRow[cellIndex]?.status === "correct");
               if (wasPrevGreen) {
                  points -= 15;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `regression: green to black -15`,
                     pointDeduction: -15,
                  });
               }

               // Regression check: Yellow to Black
               const wasPrevYellow = guesses
                  .slice(0, rowIndex)
                  .some((prevRow) =>
                     prevRow.some(
                        (prevCell) =>
                           prevCell.letter === cell.letter &&
                           prevCell.status === "present",
                     ),
                  );
               if (wasPrevYellow) {
                  points -= 10;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `regression: yellow to black -10`,
                     pointDeduction: -10,
                  });
               }

               localAwardedPoints.push({
                  letter: cell.letter,
                  index: cell.index,
                  status: cell.status,
                  awardRow: rowIndex,
                  isChecked: false,
               });
            } else if (cell.status === "correct") {
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
                  const greenScore = getJuly2026Points(rowIndex, "correct");
                  points += greenScore;
                  localDecisions.push({
                     letter: cell.letter,
                     status: `${cell.status} +${greenScore}`,
                     pointDeduction: greenScore,
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
   if (hintRecord && hintRecord?.row !== undefined) {
      const rowBonus = rows[hintRecord.row - 1];
      if (rowBonus !== undefined) {
         localHint -= SCORING.HINT_PENALTY;
      }
   }

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
