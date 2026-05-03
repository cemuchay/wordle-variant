export const getWinMessage = (attempts: number): string => {
   const variations: Record<number, string[]> = {
      1: [
         "Cheater. Or a time traveler. Either way, reported.",
         "No freaking way",
         "First try? sus.",
         "I see you've met the editor and got some `intel`.",
         "Statistically impossible. Stop lying to yourself.",
         `nerd.. sighs`,
         "sus!!!!",
      ],
      2: [
         "Insane luck. Go buy a lottery ticket immediately.",
         "Show off. It’s just a game, calm down.",
         "Purely accidental. Don't let it get to your head.",
         "Two tries? You’re peaking. it's all downhill from here.",
         "Absolute fluke. Do it again tomorrow, I dare you.",
          "very sus",
      ],
      3: [
         "Solid effort. You're actually kind of good at this.",
         "Impressive. Still not a 2, but we'll take it.",
         "The 'I have a degree but no social life' .",
         "Look at you, using that expensive brain of yours.",
         "Three? That’s almost respectable. Almost.",
         "3/6? Sharp brain, suspicious personality.",
         "You got it in three. Somewhere, your village people are confused.",
         "Nice one. so make we clap for you?",
         "3 tries? You sabi book, but can you cook?",
         "You're smart small, no let it enter your head.",
         "3/6. Evidence that overthinking sometimes pays rent.",
         "You solved it in three like person wey dey argue with Google.",
         "Not bad. You clearly peaked in group projects.",
         "3 tries? Brain dey work, character still loading.",
         "You got 3/6. Congratulations, local champion of unnecessary intelligence.",
      ],
      4: [
         "Standard. The human embodiment of room-temperature water.",
         "Aggressively average. You are the 'Default Settings' of people.",
         "Four is the participation trophy of Wordle scores.",
         "Mid. Just... purely mid.",
         "You got it. Eventually. Like a slow internet connection.",
         "4/6? Premium mediocrity with confidence.",
         "You solved it in four. Nigerian parents call it wasted potential.",
         "Not bad, not great. Pure center table behavior.",
         "4 tries? The exact score of person wey says 'I nearly got it.'",
         "You came through eventually like NEPA light.",
         "4/6. Consistently average; a rare talent.",
         "This score screams 'I know somebody that knows somebody.'",
         "Four tries? Brain dey boot slowly but e dey boot.",
         "You solved it with the urgency of Lagos traffic.",
         "4/6. The official score of people who say 'make I just check one thing' for 2 hours.",
      ],
      5: [
         "Living on the edge, aren't we? Barely passed.",
         "Cutting it a bit close. Heart rate check?",
         "Stressful to watch. Please do better tomorrow.",
         "The academic equivalent of a D-minus.",
         "You were one typo away from total failure. Think about that.",
         "5/6? You like suspense more than success.",
         "You solved it late like assignment submitted 11:59.",
         "This score came with sweat, prayer, and low battery.",
         "5 tries? Brain dey work on installment plan.",
         "You arrived eventually like mechanic wey say 'two minutes'.",
         "5/6. Victory with embarrassing evidence attached.",
         "You won, but nobody is clapping loudly, infact nobody dey clap.",
         "This result screams 'I know it, it's on the tip of my tongue.'",
         "5 tries? Even your ancestors nearly gave up.",
         "You passed by the grace of autocomplete and vibes.",
      ],
      6: lastGuess,
      7: lastGuess,
   };

   const pool = variations[attempts] || [
      "Finally. I was about to turn myself off.",
   ];
   return pool[Math.floor(Math.random() * pool.length)];
};

const lastGuess = [
   "Yikes. 6/6 isn't a win, it's a miracle you're alive.",
   "Clutching at straws. That was painful to witness.",
   "The 'Last Minute Homework' energy is strong here.",
   "Embarrassing, but technically a win. Barely.",
   "You finished. So does a turtle in a marathon.",
   "6/6? You didn't solve it, you survived it.",
   "Last try win. Nollywood comeback of the year.",
   "You came through like generator after blackout.",
   "6 tries? Brain dey buffer with poor network.",
   "Victory entered through the back door.",
   "You solved it by force, not by talent.",
   "This score has 'let me just jam anything' energy.",
   "6/6. Even the word is disappointed.",
   "You won the way Nigeria fixes roads: eventually.",
   "That wasn't skill. That was divine intervention.",
   "6 tries? Your keyboard worked harder than you.",
   "You crossed the finish line crawling, but counts sha.",
   "This result smells like panic and random vowels.",
   "You got there late like African time with traffic.",
   "6/6. A win with heavy apologies attached.",
];

export const getLossMessage = (): string => {
   const losses = [
      `Ouch. The word was easy sha. Stick to ludo.`,
      `Pathetic. it was right there....`,
      `Even my source code knew it was trivial.`,
      `Game Over. You're the reason we have 'Easy Mode' in other games.`,
      `Better luck next time. Maybe try a 2-letter word version?`,
      "don't cry",
   ];
   return losses[Math.floor(Math.random() * losses.length)];
};
