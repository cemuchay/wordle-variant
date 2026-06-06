# Implementation Plan: Redo Grid Sizing via Fluid Aspect-Ratio Layout

Completely replace the hardcoded viewport-based (`vw`/`vh`) grid cell sizing system with a container-driven, fluid layout using CSS `aspect-ratio`. This ensures that the grid always scales to fill the maximum possible space on any device (including small iPhones and large desktops) without overflowing or cutting off.

## Proposed Changes

### Grid Component
#### [MODIFY] [Grid.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/Grid.tsx)
- Modify the `Cell` component:
  - Remove all conditional `sizeClass` string assignments and hardcoded sizes (like `w-[15vw]`, `sm:w-[6.5vh]`, etc.).
  - Set the cell's class to `w-full aspect-square flex items-center justify-center font-bold uppercase border-2 text-white transition-colors duration-300` plus a responsive text size (`text-base xs:text-lg sm:text-xl md:text-2xl`).
- Modify the `Grid` container:
  - Remove the inline style `width: 'max-content'`.
  - Apply a dynamic `aspect-ratio` inline style to the grid container based on `wordLength / maxAttempts`.
  - Let the grid container scale to `width: 100%`, `height: 100%`.
  - Set container limits on the outer wrapper:
    - Regular Gameplay limits: `w-full max-w-[min(90vw,calc(${wordLength}*70px))] max-h-[50vh] xs:max-h-[55vh] sm:max-h-[60vh] lg:max-h-[55vh]`
    - Challenge Gameplay limits: `w-full max-w-[min(85vw,calc(${wordLength}*50px))] max-h-[40vh] xs:max-h-[45vh] sm:max-h-[48vh]`
  - Pass `gameplayType` or `compact` down to style the gaps (`gap-1` or `gap-1.5` or `gap-2`).

### Layout & Page Containers
#### [MODIFY] [GameArea.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/layout/GameArea.tsx)
- Ensure the middle grid-wrapper flexbox container has a defined responsive height budget (`flex-1 min-h-0 w-full flex items-center justify-center`) so the grid can measure itself fluidly against it.

#### [MODIFY] [RegularGameplay.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/challenge/RegularGameplay.tsx)
- Clean up the grid wrapper container classes to enable the same fluid layout metrics inside the challenge screen.

## Verification Plan

### Manual Verification
1. Open the game in standard play. Try changing the word length override to 3, 5, and 7. Verify the grid dynamically rescales to stay centered and square, filling the screen width/height optimally.
2. Verify that there is zero vertical scrolling or overflow on small devices (e.g. iPhone SE / iPhone X responsive simulator).
3. Verify that desktop monitors display a centered, crisp board without oversized cells.
4. Run a full production build to ensure TypeScript types compile successfully.
