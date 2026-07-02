interface ScoreBarProps {
   score: number;
   latestCorrect: boolean | undefined;
   side: "left" | "right";
   themeColor: string;
}

const MAX_SCORE = 160;

export const ScoreBar = ({
   score,
   latestCorrect,
   side,
   themeColor,
}: ScoreBarProps) => {
   const heightPct = Math.min(100, (score / MAX_SCORE) * 100);

   const barColor = latestCorrect === true
      ? "bg-correct"
      : latestCorrect === false
         ? "bg-red-500"
         : themeColor;

   const posClass = side === "left" ? "left-2" : "right-2";

   return (
      <div className={`absolute top-4 bottom-4 ${posClass} w-1.5 bg-white/5 rounded-full overflow-hidden`}>
         <div
            className={`absolute bottom-0 w-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ height: `${heightPct}%` }}
         />
      </div>
   );
};
