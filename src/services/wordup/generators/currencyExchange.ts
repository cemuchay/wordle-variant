import { type QuizGenerator, type BaseQuestion, type EntitySeed } from "../../../types/generators";
import { createSeededRandom, seededShuffle, hashSeed } from "../seededRandom";

const ENTITIES: EntitySeed[] = [
   { id: "1", type: "currency_exchange", label: "US Dollar", metadata: { code: "USD", symbol: "$", country: "United States" }, difficulty: 1, tags: ["major"] },
   { id: "2", type: "currency_exchange", label: "Euro", metadata: { code: "EUR", symbol: "€", country: "Eurozone" }, difficulty: 1, tags: ["major"] },
   { id: "3", type: "currency_exchange", label: "British Pound", metadata: { code: "GBP", symbol: "£", country: "United Kingdom" }, difficulty: 1, tags: ["major"] },
   { id: "4", type: "currency_exchange", label: "Japanese Yen", metadata: { code: "JPY", symbol: "¥", country: "Japan" }, difficulty: 1, tags: ["major"] },
   { id: "5", type: "currency_exchange", label: "Nigerian Naira", metadata: { code: "NGN", symbol: "₦", country: "Nigeria" }, difficulty: 2, tags: ["africa"] },
   { id: "6", type: "currency_exchange", label: "South African Rand", metadata: { code: "ZAR", symbol: "R", country: "South Africa" }, difficulty: 2, tags: ["africa"] },
   { id: "7", type: "currency_exchange", label: "Indian Rupee", metadata: { code: "INR", symbol: "₹", country: "India" }, difficulty: 2, tags: ["asia"] },
   { id: "8", type: "currency_exchange", label: "Chinese Yuan", metadata: { code: "CNY", symbol: "¥", country: "China" }, difficulty: 2, tags: ["asia"] },
   { id: "9", type: "currency_exchange", label: "Canadian Dollar", metadata: { code: "CAD", symbol: "$", country: "Canada" }, difficulty: 2, tags: ["major"] },
   { id: "10", type: "currency_exchange", label: "Australian Dollar", metadata: { code: "AUD", symbol: "$", country: "Australia" }, difficulty: 2, tags: ["major"] },
   { id: "11", type: "currency_exchange", label: "Swiss Franc", metadata: { code: "CHF", symbol: "Fr", country: "Switzerland" }, difficulty: 3, tags: ["europe"] },
   { id: "12", type: "currency_exchange", label: "Ghanaian Cedi", metadata: { code: "GHS", symbol: "₵", country: "Ghana" }, difficulty: 3, tags: ["africa"] },
   { id: "13", type: "currency_exchange", label: "Kenyan Shilling", metadata: { code: "KES", symbol: "KSh", country: "Kenya" }, difficulty: 3, tags: ["africa"] },
   { id: "14", type: "currency_exchange", label: "Mexican Peso", metadata: { code: "MXN", symbol: "$", country: "Mexico" }, difficulty: 3, tags: ["americas"] },
   { id: "15", type: "currency_exchange", label: "Brazilian Real", metadata: { code: "BRL", symbol: "R$", country: "Brazil" }, difficulty: 3, tags: ["americas"] },
   { id: "16", type: "currency_exchange", label: "Saudi Riyal", metadata: { code: "SAR", symbol: "﷼", country: "Saudi Arabia" }, difficulty: 4, tags: ["middle-east"] },
   { id: "17", type: "currency_exchange", label: "Turkish Lira", metadata: { code: "TRY", symbol: "₺", country: "Turkey" }, difficulty: 4, tags: ["europe"] },
   { id: "18", type: "currency_exchange", label: "Thai Baht", metadata: { code: "THB", symbol: "฿", country: "Thailand" }, difficulty: 4, tags: ["asia"] },
   { id: "19", type: "currency_exchange", label: "Icelandic Krona", metadata: { code: "ISK", symbol: "kr", country: "Iceland" }, difficulty: 5, tags: ["europe"] },
   { id: "20", type: "currency_exchange", label: "Zambian Kwacha", metadata: { code: "ZMW", symbol: "ZK", country: "Zambia" }, difficulty: 5, tags: ["africa"] },
];

export const currencyExchangeGenerator: QuizGenerator = {
   id: "currency_exchange",
   weight: 1,
   supports(category: string) {
      return category === "currency_exchange";
   },
   generate(seed: string, entity?: EntitySeed): BaseQuestion {
      const rng = createSeededRandom(hashSeed(seed));
      const idx = Math.floor(rng() * ENTITIES.length);
      const chosen = entity || ENTITIES[idx];

      const useReverse = Math.floor(rng() * 2) === 0;
      const correct = chosen.label;
      const code = chosen.metadata.code as string;
      const symbol = chosen.metadata.symbol as string;
      const country = chosen.metadata.country as string;

      const distractors = ENTITIES
         .filter((e) => e.label !== correct)
         .sort(() => rng() - 0.5)
         .slice(0, 3)
         .map((e) => useReverse ? e.metadata.code as string : e.label);

      const options = seededShuffle([useReverse ? code : correct, ...distractors], rng);

      return {
         id: seed,
         question: useReverse
            ? `Which country uses the currency code "${code}" (${symbol})?`
            : `What is the official currency of ${country}?`,
         options,
         answer: useReverse ? country : correct,
         explanation: `${country} uses the ${correct} (${code}, ${symbol}).`,
         metadata: { generatorId: "currency_exchange", entityId: chosen.id },
      };
   },
};
