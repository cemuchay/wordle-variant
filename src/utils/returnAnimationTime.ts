import { ANIMATION_DURATION } from "../constants/ui";
import { ANIMATION } from "../constants/game";

const returnAnimationTime = (wordLength: number) => {
   if (wordLength < 7) {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL + ANIMATION.REVEAL_BUFFER;
   } else {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL_LONG + ANIMATION.REVEAL_BUFFER;
   }
};

export default returnAnimationTime;
