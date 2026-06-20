Implementation Plan: Smart Metadata Inference Engine

1. Objective
   Modify the generic edge function's question generation logic to support entities with varying, non-uniform metadata schemas within a single category. The system must infer appropriate question dimensions at runtime and dynamically filter the entity pool to generate high-quality, contextually uniform distractors (e.g., matching locations with locations, dates with dates), preventing mismatched options that degrade gameplay quality.

2. Technical Assessment & Impact Analysis
   Database (wordup_entities): Zero schema modifications required. Allows rows within the same type category to have distinct JSONB keys.

Client/UI Components: Zero changes. The UI will process the returned question, correct answer, and distractors identically.

Edge Function Layer: High impact. Refactors the single-key global scoring strategy (scoreKeys() / pickBestKey()) into a localized, runtime peer-filtering routine per round.

3. Architecture Shift
   [Old Flow: Global Key Constraint]
   Fetch Entities -> Analyze Global Keys -> Choose One Common Key -> Generate 7 Rounds

[New Flow: Localized Runtime Inference]
Fetch Entities -> Select Round Target -> Extract Target Keys -> Filter Pool for Peer Keys -> Generate Round 4. Execution Steps
Step 1: Replace Global Scoring Logic in Edge Function
Locate the block handling generic procedural generation inside the edge function. Remove the legacy code that calculates a single optimal key across the entire payload array. Replace it with a localized peer-filtering lookup sequence.

Step 2: Implement the Selection Algorithm
Integrate the following TypeScript logic to process each round's target entity.

TypeScript
interface WordUpEntity {
id: string;
type: string;
label: string;
metadata: Record<string, string>;
}

interface GeneratedQuestion {
question: string;
correctAnswer: string;
distractors: string[];
}

export function generateSmartQuestion(
target: WordUpEntity,
allEntities: WordUpEntity[],
difficulty: number
): GeneratedQuestion {
const availableKeys = Object.keys(target.metadata);

if (availableKeys.length === 0) {
throw new Error(`Entity "${target.label}" (ID: ${target.id}) contains empty metadata.`);
}

let chosenKey = "";
let validDistractorPool: WordUpEntity[] = [];

// Shuffle keys to distribute question types uniformly across sessions
const shuffledKeys = availableKeys.sort(() => Math.random() - 0.5);

// Find the first key that provides a contextually uniform pool of distractors
for (const key of shuffledKeys) {
const peers = allEntities.filter(
(e) => e.id !== target.id && e.metadata[key] !== undefined
);

    // Ensure at least 3 other entities share this key to generate valid options
    if (peers.length >= 3) {
      chosenKey = key;
      validDistractorPool = peers;
      break;
    }

}

// Fallback Rule: Relax constraints if no key meets the strict peer threshold
if (!chosenKey) {
chosenKey = availableKeys[0];
validDistractorPool = allEntities.filter((e) => e.id !== target.id);
}

const correctAnswer = target.metadata[chosenKey];

// Map values strictly from the chosen property to ensure uniform type matching
const uniqueDistractorValues = Array.from(
new Set(
validDistractorPool
.map((e) => e.metadata[chosenKey] || "Unknown")
.filter((val) => val !== correctAnswer && val !== "Unknown")
)
);

// Select 3 random peer distractors
const distractors = uniqueDistractorValues
.sort(() => Math.random() - 0.5)
.slice(0, 3);

// Guard against sparse pools to prevent array empty slots
while (distractors.length < 3) {
distractors.push(`Alternative ${target.label} Metric`);
}

// Clean formatting for snake*case metadata attributes
const readableKey = chosenKey.replace(/*/g, " ");

const question = difficulty <= 2
? `What is the ${readableKey} of ${target.label}?`
: `"${correctAnswer}" is the ${readableKey} of which option?`;

return {
question,
correctAnswer,
distractors,
};
}
Step 3: Handle Fallback Safety
When a target entity possesses a highly specific key unique to itself, the algorithm automatically cycles through alternative keys. If all options fail the peer threshold (e.g., an isolated entity with unique attributes), the engine safely steps down to its absolute fallback branch without throwing a runtime error.
