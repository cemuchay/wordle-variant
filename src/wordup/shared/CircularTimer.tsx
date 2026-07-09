import { useState, useEffect, useRef } from "react";

interface CircularTimerProps {
   maxTime: number;
   currentIdx: number;
   colorClass?: string;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const CircularTimer = ({
   maxTime,
   currentIdx,
   colorClass = "text-correct",
}: CircularTimerProps) => {
   const circleRef = useRef<SVGCircleElement | null>(null);
   const startTimeRef = useRef<number>(0);
   const intervalRef = useRef<number | null>(null);
   const [displayTime, setDisplayTime] = useState(maxTime);

   useEffect(() => {
      const now = Date.now();
      startTimeRef.current = now;
      setDisplayTime(maxTime);

      const circle = circleRef.current;
      if (!circle) return;

      circle.style.transition = "none";
      circle.style.strokeDashoffset = "0";

      void circle.getBoundingClientRect();

      circle.style.transition = `stroke-dashoffset ${maxTime}s linear`;
      circle.style.strokeDashoffset = String(CIRCUMFERENCE);

      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
         const elapsed = (Date.now() - startTimeRef.current) / 1000;
         const remaining = Math.max(0, maxTime - elapsed);
         setDisplayTime(remaining);
          if (remaining <= 0 && intervalRef.current !== null) {
             window.clearInterval(intervalRef.current);
          }
      }, 100);

      return () => {
         if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      };
   }, [currentIdx, maxTime]);

   const seconds = Math.ceil(displayTime);

   return (
      <div className="relative w-16 h-16">
         <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
               cx="50" cy="50" r={RADIUS}
               fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"
            />
            <circle
               ref={circleRef}
               cx="50" cy="50" r={RADIUS}
               fill="none" stroke="currentColor" strokeWidth="6"
               strokeLinecap="round"
               strokeDasharray={CIRCUMFERENCE}
               strokeDashoffset={0}
               transform="rotate(-90 50 50)"
               className={colorClass}
            />
         </svg>
         <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-lg tabular-nums">
               {seconds}
            </span>
         </div>
      </div>
   );
};
