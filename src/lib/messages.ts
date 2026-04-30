export const getWinMessage = (attempts: number): string => {
   const variations: Record<number, string[]> = {
      1: [
         "Cheater. Or a time traveler. Either way, reported.",
         "No freaking way",
         "First try? sus.",
         "I see you've met the editor and got some `intel`.",
         "Statistically impossible. Stop lying to yourself.",
         `nerd.. sighs`,
      ],
      2: [
         "Insane luck. Go buy a lottery ticket immediately.",
         "Show off. It’s just a game, calm down.",
         "Purely accidental. Don't let it go to your head.",
         "Two tries? You’re peaking. it's all downhill from here.",
         "Absolute fluke. Do it again tomorrow, I dare you.",
      ],
      3: [
         "Solid effort. You're actually kind of good at this.",
         "Impressive. Still not a 2, but we'll take it.",
         "The 'I have a degree but no social life' .",
         "Look at you, using that expensive brain of yours.",
         "Three? That’s almost respectable. Almost.",
      ],
      4: [
         "Standard. The human embodiment of room-temperature water.",
         "Aggressively average. You are the 'Default Settings' of people.",
         "Four is the participation trophy of Wordle scores.",
         "Mid. Just... purely mid.",
         "You got it. Eventually. Like a slow internet connection.",
      ],
      5: [
         "Living on the edge, aren't we? Barely passed.",
         "Cutting it a bit close. Heart rate check?",
         "Stressful to watch. Please do better tomorrow.",
         "The academic equivalent of a D-minus.",
         "You were one typo away from total failure. Think about that.",
      ],
      6: [
         "Yikes. 6/6 isn't a win, it's a miracle you're alive.",
         "Clutching at straws. That was painful to witness.",
         "The 'Last Minute Homework' energy is strong here.",
         "Embarrassing, but technically a win. Barely.",
         "You finished. So does a turtle in a marathon.",
      ],
   };

   const pool = variations[attempts] || [
      "Finally. I was about to turn myself off.",
   ];
   return pool[Math.floor(Math.random() * pool.length)];
};

export const getLossMessage = (word: string): string => {
   const losses = [
      `Ouch. The word was ${word}. Stick to Tic-Tac-Toe.`,
      `Pathetic. ${word} was right there.`,
      `Even my source code knew it was ${word}.`,
      `Game Over. You're the reason we have 'Easy Mode' in other games.`,
      `Better luck next time. Maybe try a 2-letter word version?`,
      "don't cry",
   ];
   return losses[Math.floor(Math.random() * losses.length)];
};
