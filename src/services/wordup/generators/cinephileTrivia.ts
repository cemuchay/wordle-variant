import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "cinephile_trivia", label: "The Godfather", metadata: { year: 1972, director: "Francis Ford Coppola", genre: "Crime" }, difficulty: 1, tags: ["classic"] },
   { id: "2", type: "cinephile_trivia", label: "Titanic", metadata: { year: 1997, director: "James Cameron", genre: "Romance" }, difficulty: 1, tags: ["blockbuster"] },
   { id: "3", type: "cinephile_trivia", label: "Star Wars", metadata: { year: 1977, director: "George Lucas", genre: "Sci-Fi" }, difficulty: 1, tags: ["franchise"] },
   { id: "4", type: "cinephile_trivia", label: "The Matrix", metadata: { year: 1999, director: "The Wachowskis", genre: "Sci-Fi" }, difficulty: 1, tags: ["cult"] },
   { id: "5", type: "cinephile_trivia", label: "Jurassic Park", metadata: { year: 1993, director: "Steven Spielberg", genre: "Adventure" }, difficulty: 1, tags: ["blockbuster"] },
   { id: "6", type: "cinephile_trivia", label: "Pulp Fiction", metadata: { year: 1994, director: "Quentin Tarantino", genre: "Crime" }, difficulty: 2, tags: ["cult"] },
   { id: "7", type: "cinephile_trivia", label: "Inception", metadata: { year: 2010, director: "Christopher Nolan", genre: "Sci-Fi" }, difficulty: 2, tags: ["mind-bender"] },
   { id: "8", type: "cinephile_trivia", label: "Forrest Gump", metadata: { year: 1994, director: "Robert Zemeckis", genre: "Drama" }, difficulty: 1, tags: ["classic"] },
   { id: "9", type: "cinephile_trivia", label: "The Lion King", metadata: { year: 1994, director: "Roger Allers", genre: "Animation" }, difficulty: 1, tags: ["disney"] },
   { id: "10", type: "cinephile_trivia", label: "Spirited Away", metadata: { year: 2001, director: "Hayao Miyazaki", genre: "Animation" }, difficulty: 2, tags: ["anime"] },
   { id: "11", type: "cinephile_trivia", label: "The Dark Knight", metadata: { year: 2008, director: "Christopher Nolan", genre: "Action" }, difficulty: 1, tags: ["superhero"] },
   { id: "12", type: "cinephile_trivia", label: "Schindler's List", metadata: { year: 1993, director: "Steven Spielberg", genre: "Historical Drama" }, difficulty: 2, tags: ["classic"] },
   { id: "13", type: "cinephile_trivia", label: "Parasite", metadata: { year: 2019, director: "Bong Joon-ho", genre: "Thriller" }, difficulty: 2, tags: ["oscar"] },
   { id: "14", type: "cinephile_trivia", label: "Avatar", metadata: { year: 2009, director: "James Cameron", genre: "Sci-Fi" }, difficulty: 1, tags: ["blockbuster"] },
   { id: "15", type: "cinephile_trivia", label: "Casablanca", metadata: { year: 1942, director: "Michael Curtiz", genre: "Romance" }, difficulty: 3, tags: ["classic"] },
   { id: "16", type: "cinephile_trivia", label: "Interstellar", metadata: { year: 2014, director: "Christopher Nolan", genre: "Sci-Fi" }, difficulty: 2, tags: ["space"] },
   { id: "17", type: "cinephile_trivia", label: "The Wizard of Oz", metadata: { year: 1939, director: "Victor Fleming", genre: "Fantasy" }, difficulty: 2, tags: ["classic"] },
   { id: "18", type: "cinephile_trivia", label: "Fight Club", metadata: { year: 1999, director: "David Fincher", genre: "Drama" }, difficulty: 2, tags: ["cult"] },
   { id: "19", type: "cinephile_trivia", label: "Citizen Kane", metadata: { year: 1941, director: "Orson Welles", genre: "Drama" }, difficulty: 3, tags: ["classic"] },
   { id: "20", type: "cinephile_trivia", label: "Everything Everywhere All at Once", metadata: { year: 2022, director: "Daniels", genre: "Sci-Fi" }, difficulty: 3, tags: ["oscar"] },
];

export const cinephileTriviaGenerator: QuizGenerator = {
   id: "cinephile_trivia",
   weight: 1,
   supports(category: string) {
      return category === "cinephile_trivia";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];
      const correct = chosen.label;
      const year = chosen.metadata.year as number;
      const director = chosen.metadata.director as string;
      const genre = chosen.metadata.genre as string;

      const variant = Math.floor(rng() * 4);
      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => e.label);

      const options = seededShuffle([correct, ...distractors], rng);

      if (variant === 0) {
         return {
            id: seed,
            question: `Which movie was directed by ${director} and released in ${year}?`,
            options,
            answer: correct,
            metadata: { generatorId: "cinephile_trivia", entityId: chosen.id },
         };
      } else if (variant === 1) {
         const dirOptions = seededShuffle(
            [director, ...ENTITIES.filter((e) => e.label !== correct).sort(() => rng() - 0.5).slice(0, 3).map((e) => e.metadata.director as string)],
            rng
         );
         return {
            id: seed,
            question: `Who directed the movie "${correct}" (${year})?`,
            options: dirOptions,
            answer: director,
            metadata: { generatorId: "cinephile_trivia", entityId: chosen.id },
         };
      } else if (variant === 2) {
         const yearCandidates = [year - 1, year + 1, year - 3, year + 3, year - 5, year + 5]
            .filter((y) => y >= 1900 && y <= 2025 && y !== year)
            .slice(0, 3)
            .map(String);
         const yearOptions = seededShuffle([String(year), ...yearCandidates], rng);
         return {
            id: seed,
            question: `In what year was "${correct}" (directed by ${director}) released?`,
            options: yearOptions,
            answer: String(year),
            metadata: { generatorId: "cinephile_trivia", entityId: chosen.id },
         };
      } else {
         return {
            id: seed,
            question: `Which ${genre.toLowerCase()} film from ${year} features a plot involving "${correct.slice(0, 20)}..."?`,
            options,
            answer: correct,
            metadata: { generatorId: "cinephile_trivia", entityId: chosen.id },
         };
      }
   },
};
