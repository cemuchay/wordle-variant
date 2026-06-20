📋 Phase 1: Database Migration
Run this script to set up the core knowledge infrastructure.

SQL
-- Up migration
CREATE TABLE wordup_entities (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
type VARCHAR(50) NOT NULL,
label VARCHAR(255) NOT NULL,
metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
tags TEXT[] DEFAULT '{}',
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_entities_type_difficulty ON wordup_entities(type, difficulty);

CREATE TABLE wordup_match_payloads (
match_id VARCHAR(255) PRIMARY KEY,
encrypted_payload TEXT NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
🏗️ Phase 2: Codebase Framework Changes

1. Create Data Contracts (src/types/generators.ts)
   Define the standard interface shared by both procedural and legacy question schemas.

TypeScript
export interface BaseQuestion {
id: string;
question: string;
options: string[];
answer: string;
explanation?: string;
metadata?: {
generatorId: string;
entityId?: string;
};
}

export interface QuizGenerator {
id: string;
weight: number;
supports(category: string): boolean;
generate(seed: string, entity?: any): BaseQuestion;
} 2. Update Categories List (src/constants.ts)
Append the 10 new procedural categories to your existing categories array/dictionary.

TypeScript
export const WORDUP_CATEGORIES = [
// ... Keep existing legacy categories untouched
{ id: 'capitals_clash', type: 'procedural', label: 'Capital Cities' },
{ id: 'currency_exchange', type: 'procedural', label: 'Currencies' },
{ id: 'flag_bearer', type: 'procedural', label: 'Flags' },
{ id: 'mental_math_blitz', type: 'procedural', label: 'Mental Math' },
{ id: 'sequence_solver', type: 'procedural', label: 'Number Sequences' },
{ id: 'element_arena', type: 'procedural', label: 'Periodic Table' },
{ id: 'animal_kingdom', type: 'procedural', label: 'Animal Kingdom' },
{ id: 'cosmic_frontier', type: 'procedural', label: 'Space & Astronomy' },
{ id: 'cinephile_trivia', type: 'procedural', label: 'Movies & Media' },
{ id: 'history_milestones', type: 'procedural', label: 'History Eras' }
];
🧠 Phase 3: The Routing Registry 3. Build the Coordinator (src/services/wordup/generatorRegistry.ts)
Implement the conditional routing to bypass database lookups entirely for legacy word categories.

TypeScript
import { QuizGenerator, BaseQuestion } from '../../types/generators';
import { generateLegacyWordQuestion } from './legacyWordEngine'; // Existing engine

export class GeneratorRegistry {
private static proceduralGenerators: Map<string, QuizGenerator> = new Map();

static register(generator: QuizGenerator) {
this.proceduralGenerators.set(generator.id, generator);
}

static async compileMatchQuestions(
category: string,
seed: string,
fetchEntities: (type: string, count: number) => Promise<any[]>
): Promise<BaseQuestion[]> {
const questions: BaseQuestion[] = [];

    // Guard Clause: Route legacy word categories to original client logic
    const isLegacy = ['mixed', '5_letters', 'vowel_drop', 'anagram_scrambled'].includes(category);
    if (isLegacy) {
      for (let r = 1; r <= 7; r++) {
        questions.push(generateLegacyWordQuestion(category, `${seed}-${r}`));
      }
      return questions;
    }

    // Procedural Routing
    const activeGenerators = Array.from(this.proceduralGenerators.values()).filter(g => g.supports(category));
    const entities = await fetchEntities(category, 7);

    for (let i = 0; i < 7; i++) {
      const gen = activeGenerators[i % activeGenerators.length];
      questions.push(gen.generate(`${seed}-${i}`, entities[i]));
    }

    return questions;

}
}
⚡ Phase 4: Serverless Execution Layer 4. Wire the Supabase Edge Function (supabase/functions/generate-match-questions/index.ts)
Handle generation, deterministic key handling, database commitment, and structural downstream JSON responses.

TypeScript
import { GeneratorRegistry } from './generatorRegistry';
import { encryptPayload, generateSecureSessionKey } from './cryptoUtils';

export default async function handleRequest(req: Request) {
const { matchId, category, seed } = await req.json();

const rawQuestions = await GeneratorRegistry.compileMatchQuestions(
category,
seed,
async (type, count) => {
// Query procedural assets from the entities table
const { data } = await supabaseClient
.from('wordup_entities')
.select('\*')
.eq('type', type)
.limit(count);
return data || [];
}
);

const encryptionKey = generateSecureSessionKey(matchId);
const encryptedQuestions = encryptPayload(JSON.stringify(rawQuestions), encryptionKey);

// Sync to existing match records schema
await supabaseClient
.from('wordup_matches')
.update({
encrypted_questions: encryptedQuestions,
encryption_key: encryptionKey,
status: 'countdown'
})
.eq('id', matchId);

return new Response(
JSON.stringify({ matchId, encryptedQuestions, encryptionKey }),
{ headers: { "Content-Type": "application/json" } }
);
}

🗺️ System Data Flow[1. Client Initialization]
│
▼
[2. Edge Function Invocation] ──► Checks Category Type
│
├──► (If Legacy Word Category) ──► Run Legacy Client Engine (Bypass DB)
│
└──► (If New Procedural Topic) ──► Query `wordup_entities` (7 Rows)
│
▼
[3. Generator Engine]
(Applies deterministic seed to entities)
│
▼
[4. Encryption Layer]
(Encrypts with session key via AES-GCM)
│
▼
[5. Client Delivery] ◄─────────────────── Updates `wordup_matches` table
🏃‍♂️ Step-by-Step Agent Execution PathStep 1: The Request ListenerThe Edge Function receives a POST request containing matchId, category, and a unique seed.The Engine interrogates the incoming category identifier string.Step 2: Conditional Strategy RoutingBranch A (Legacy Match): If the category matches a local word-game variant (e.g., 5_letters, vowel_drop), the engine drops directly into the legacy generator function. It produces 7 questions instantly using client-side string manipulation arrays and skips database item fetching entirely.Branch B (Procedural Match): If the category matches a new topic, the function fires a structured query to the wordup_entities table:SQLSELECT \* FROM wordup_entities WHERE type = category LIMIT 7;
Step 3: Deterministic Generation (The Pure Function)The 7 raw database entities are passed into the matched topic QuizGenerator.The generator instantiates a pseudo-random number generator (PRNG) using the combination of matchId + roundNumber as the unique entropy seed.Distractor Compilation: The generator extracts the label as the correct answer. To populate the remaining 3 grid slots (options), it applies a deterministic rule:Numeric content: Mutates the correct key dynamically using variations like $\pm1$, $\pm5$, or $\pm10$.Text metadata: Samples from the other 6 queried entities to guarantee valid, contextual distractors (e.g., mixing other European capitals if the target is Paris).The generator array shuffles the final 4 choices deterministically so the correct answer isn't always in the same position, then spits out a clean BaseQuestion object schema.Step 4: Secure Payload LockingThe Edge Function generates a single-use string token (encryption_key).The array of 7 finalized questions is flattened into a single JSON string stringified array and encrypted using AES-GCM.The function commits a single SQL write transaction directly back to your existing production wordup_matches table matching the row's ID:SQLUPDATE wordup_matches
SET encrypted_questions = [Encrypted String], encryption_key = [Key], status = 'countdown'
WHERE id = matchId;
Step 5: Client IngestionThe payload returns to the client application across the established Supabase Broadcast WebSocket pipeline.The front-end calls its existing decryption methods with the supplied session key, parsing the clean arrays straight into the presentation grid elements within BattleView.tsx.
