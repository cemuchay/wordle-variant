import { ANIMATION_DURATION } from "../constants/ui";
import { ANIMATION } from "../constants/game";
import { useAppStore, type TileRevealStyle } from "../store/useAppStore";

export const SLOW_TILE_REVEAL_MS = 450;

export const getTileRevealStyle = (): TileRevealStyle => {
   return useAppStore.getState().preferences.tileRevealStyle || "normal";
};

const returnAnimationTime = (wordLength: number, style?: TileRevealStyle) => {
   const revealStyle = style ?? getTileRevealStyle();
   if (revealStyle === "instant") {
      return 0;
   }
   if (revealStyle === "slow") {
      return wordLength * SLOW_TILE_REVEAL_MS + ANIMATION.REVEAL_BUFFER;
   }
   if (wordLength < 7) {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL + ANIMATION.REVEAL_BUFFER;
   } else {
      return wordLength * ANIMATION_DURATION.TILE_REVEAL_LONG + ANIMATION.REVEAL_BUFFER;
   }
};

export default returnAnimationTime;
