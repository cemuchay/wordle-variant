import { SuperCategory, CATEGORY_SUPER_MAP } from "./types.ts";

export function formatQuestionPrompt(
   variant: number,
   label: string,
   key: string,
   correctValue: string,
   displayOrWrongValue: string,
   categoryType: string
): { prompt: string } {
   const keyLabel = key.replace(/_/g, " ").trim();
   const k = key.toLowerCase();
   const superCategory = CATEGORY_SUPER_MAP[categoryType] ?? "science_facts";

   // 1. Language Arts overrides
   if (superCategory === "language_arts") {
      if (k === "synonym" || k === "antonym" || k === "definition") {
         if (variant === 0) {
            if (k === "synonym") return { prompt: `Which of the following is a synonym of the word "${label}"?` };
            if (k === "antonym") return { prompt: `Which of the following is an antonym of the word "${label}"?` };
            return { prompt: `What is the dictionary definition of the word "${label}"?` };
         }
         if (variant === 1) {
            if (k === "synonym") return { prompt: `Which of these words is a synonym of "${correctValue}"?` };
            if (k === "antonym") return { prompt: `Which of these words is an antonym of "${correctValue}"?` };
            return { prompt: `Which of these words means "${correctValue}"?` };
         }
         if (variant === 3) {
            if (k === "synonym") return { prompt: `True or False: A synonym of "${label}" is "${displayOrWrongValue}".` };
            if (k === "antonym") return { prompt: `True or False: The opposite (antonym) of "${label}" is "${displayOrWrongValue}".` };
            return { prompt: `True or False: "${label}" is defined as "${displayOrWrongValue}".` };
         }
         if (variant === 5) {
            if (k === "synonym") return { prompt: `The word "${label}" does NOT mean "${displayOrWrongValue}". What is its correct synonym?` };
            if (k === "antonym") return { prompt: `The opposite of "${label}" is NOT "${displayOrWrongValue}". What is its correct antonym?` };
            return { prompt: `The word "${label}" is NOT defined as "${displayOrWrongValue}". What is its correct definition?` };
         }
      }
   }

   // 2. Figure of Speech/Concepts (English / Math fundamentals)
   if (k === "example" || k === "famous_for" || k === "contrast") {
      if (variant === 0) {
         if (k === "example") return { prompt: `Which of the following is an example of "${label}"?` };
         if (k === "famous_for") return { prompt: `What is "${label}" famously known for?` };
         return { prompt: `What concept directly contrasts with "${label}"?` };
      }
      if (variant === 1) {
         if (k === "example") return { prompt: `Which concept has "${correctValue}" as an example?` };
         if (k === "famous_for") return { prompt: `Which of these options is famously known for "${correctValue}"?` };
         return { prompt: `Which concept contrasts with "${correctValue}"?` };
      }
      if (variant === 3) {
         if (k === "example") return { prompt: `True or False: An example of "${label}" is "${displayOrWrongValue}".` };
         if (k === "famous_for") return { prompt: `True or False: "${label}" is famously known for "${displayOrWrongValue}".` };
         return { prompt: `True or False: "${label}" contrasts with "${displayOrWrongValue}".` };
      }
      if (variant === 5) {
         if (k === "example") return { prompt: `"${displayOrWrongValue}" is NOT a correct example of "${label}". What is?` };
         if (k === "famous_for") return { prompt: `"${label}" is NOT famously known for "${displayOrWrongValue}". What is the correct fact?` };
         return { prompt: `"${label}" does NOT contrast with "${displayOrWrongValue}". What concept does?` };
      }
   }

   // Standard noun helpers
   const isLoc = k === "country" || k === "continent" || k === "location" || k === "city" || k === "state" || k === "capital";
   const isTime = k.includes("year") || k.includes("date") || k.includes("founded") || k.includes("released") || k.includes("created") || k.includes("acquired");
   
   // 3. Biography (e.g. Elon Musk, actors, celebrities)
   if (superCategory === "biography") {
      if (variant === 0) {
         if (k.includes("born") || k.includes("birth")) return { prompt: `When was the iconic ${label} born?` };
         if (k.includes("died") || k.includes("death")) return { prompt: `In what year did the legendary ${label} pass away?` };
         if (k.includes("nationality") || k.includes("country")) return { prompt: `Which country does ${label} originate from?` };
         if (k.includes("famous") || k.includes("achievement") || k.includes("known")) return { prompt: `What is ${label} most famously celebrated for?` };
         if (k.includes("company") || k.includes("founded") || k.includes("enterprise")) return { prompt: `Which major enterprise or venture was founded by ${label}?` };
      }
      if (variant === 1) {
         if (k.includes("born") || k.includes("birth")) return { prompt: `Which person was born in ${correctValue}?` };
         if (k.includes("nationality") || k.includes("country")) return { prompt: `Which of these famous figures hails from ${correctValue}?` };
         if (k.includes("company") || k.includes("founded") || k.includes("enterprise")) return { prompt: `Which of these innovators founded ${correctValue}?` };
      }
      if (variant === 3) {
         return { prompt: `True or False: ${label} is associated with "${displayOrWrongValue}" for the attribute ${keyLabel}.` };
      }
      if (variant === 5) {
         return { prompt: `${label} is NOT famous/associated with "${displayOrWrongValue}" for ${keyLabel}. What is correct?` };
      }
   }

   // 4. Creative Works (e.g. Harry Potter, Movie trivia, Afrobeats)
   if (superCategory === "creative_work") {
      if (variant === 0) {
         if (k.includes("author") || k.includes("writer") || k.includes("written")) return { prompt: `Who is the creative mind that wrote the novel "${label}"?` };
         if (k.includes("director") || k.includes("directed")) return { prompt: `Who sat in the director's chair for the film "${label}"?` };
         if (k.includes("star") || k.includes("cast") || k.includes("actor")) return { prompt: `Which actor played a prominent role in "${label}"?` };
         if (k.includes("genre") || k.includes("style")) return { prompt: `Which genre does "${label}" belong to?` };
         if (k.includes("released") || k.includes("year")) return { prompt: `In what year did "${label}" make its public debut?` };
      }
      if (variant === 1) {
         if (k.includes("author") || k.includes("writer") || k.includes("written")) return { prompt: `Which masterpiece was penned by ${correctValue}?` };
         if (k.includes("director") || k.includes("directed")) return { prompt: `Which film was directed by the acclaimed ${correctValue}?` };
      }
      if (variant === 3) {
         return { prompt: `True or False: "${label}" was released or created in/by "${displayOrWrongValue}".` };
      }
      if (variant === 5) {
         return { prompt: `"${label}" was NOT released or created in/by "${displayOrWrongValue}". What is the correct match?` };
      }
   }

   // 5. Science & Facts (Default QuizUp phrasing)
   let verb = "done";
   if (k.includes("founded")) verb = "founded";
   else if (k.includes("established")) verb = "established";
   else if (k.includes("released")) verb = "released";
   else if (k.includes("published")) verb = "published";
   else if (k.includes("created")) verb = "created";
   else if (k.includes("born")) verb = "born";

   if (variant === 0) {
      if (isLoc) {
         if (k === "capital") return { prompt: `If you traveled to ${label}, which city would you visit as its capital?` };
         return { prompt: `Which ${keyLabel} is the location ${label} situated in?` };
      }
      if (isTime) {
         if (verb !== "done") return { prompt: `In what year was ${label} ${verb}?` };
         return { prompt: `What is the historical year/date associated with ${label}''s ${keyLabel}?` };
      }
      return { prompt: `What is the ${keyLabel} of ${label}?` };
   }

   if (variant === 1) {
      if (isLoc) {
         if (k === "capital") return { prompt: `Which country or territory has ${correctValue} as its official capital?` };
         return { prompt: `Which of these options is located in ${correctValue}?` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `Which of these options was ${verb} in the year ${correctValue}?` };
      }
      return { prompt: `Which of these options has the ${keyLabel} "${correctValue}"?` };
   }

   if (variant === 3) {
      if (isLoc) {
         if (k === "capital") return { prompt: `True or False: The capital of ${label} is ${displayOrWrongValue}.` };
         return { prompt: `True or False: ${label} is located in ${displayOrWrongValue}.` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `True or False: ${label} was ${verb} in ${displayOrWrongValue}.` };
      }
      return { prompt: `True or False: The ${keyLabel} of ${label} is "${displayOrWrongValue}".` };
   }

   if (variant === 5) {
      if (isLoc) {
         if (k === "capital") return { prompt: `The capital of ${label} is NOT ${displayOrWrongValue}. What is the correct capital?` };
         return { prompt: `${label} is NOT located in ${displayOrWrongValue}. Which ${keyLabel} is it actually in?` };
      }
      if (isTime && verb !== "done") {
         return { prompt: `${label} was NOT ${verb} in ${displayOrWrongValue}. What is the correct year?` };
      }
      return { prompt: `The statement "${label}'s ${keyLabel} is ${displayOrWrongValue}" is incorrect. What is the correct ${keyLabel}?` };
   }

   return { prompt: `What is the ${keyLabel} of ${label}?` };
}
