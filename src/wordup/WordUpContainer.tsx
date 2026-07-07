import { ModeSelect } from "./mode-select";
import { LiveView } from "./live";
import { AsyncView } from "./async";

interface WordUpContainerProps {
   wordupMode: "live" | "async" | null;
   setWordupMode: (mode: "live" | "async" | null) => void;
   onTutorial: () => void;
   onBack?: () => void;
}

export const WordUpContainer = ({
   wordupMode,
   setWordupMode,
   onTutorial,
   onBack,
}: WordUpContainerProps) => {
   if (wordupMode === null) {
      return (
         <ModeSelect
            onSelect={(mode) => setWordupMode(mode)}
            onTutorial={onTutorial}
            onBack={onBack}
         />
      );
   }

   if (wordupMode === "live") {
      return (
         <LiveView
            onBack={() => setWordupMode(null)}
            onSwitchMode={setWordupMode}
            onTutorial={onTutorial}
         />
      );
   }

   return (
      <AsyncView
         onBack={() => setWordupMode(null)}
         onSwitchMode={setWordupMode}
         onTutorial={onTutorial}
      />
   );
};

export default WordUpContainer;
