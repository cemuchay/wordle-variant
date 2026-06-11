import { ANIMATION_DURATION } from "../constants/ui";

const returnAnimationTime = (wordLength: number) => {
   const buffer = 400;
   if (wordLength < 7) {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL + buffer;
   } else {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL_LONG + buffer;
   }
};

export default returnAnimationTime;
