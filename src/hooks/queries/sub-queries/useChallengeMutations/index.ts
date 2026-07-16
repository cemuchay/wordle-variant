import createChallengeHook from "./createChallenge";
import deleteChallengeHook from "./deleteChallenge";
import joinChallengeHook from "./joinChallenge";
import startChallengeHook from "./startChallenge";
import submitMarathonResultHook from "./submitMarathonResult";
import submitResultHook from "./submitResult";
import updateChallengeHook from "./updateChallenge";

const useChallengeMutationsSub = () => {
   const createChallenge = createChallengeHook();
   const submitResult = submitResultHook();
   const joinChallenge = joinChallengeHook();
   const submitMarathonResult = submitMarathonResultHook();
   const startChallenge = startChallengeHook();
   const updateChallenge = updateChallengeHook();
   const deleteChallenge = deleteChallengeHook();

   return {
      createChallenge,
      submitResult,
      joinChallenge,
      startChallenge,
      submitMarathonResult,
      updateChallenge,
      deleteChallenge,
   };
};

export default useChallengeMutationsSub;
