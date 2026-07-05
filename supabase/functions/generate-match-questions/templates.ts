import { seededShuffle } from "./utils.ts";

export interface MatrixTemplate {
   id: string;
   category: string;
   requiredKeys: string[];
   prompts: string[];
   explanations: string[];
}

export const QUESTION_TEMPLATES: MatrixTemplate[] = [
   // ═══════════════════════════════════════════════════════════
   // PHYSICS (10 templates)
   // ═══════════════════════════════════════════════════════════
   {
      id: "phys_formula",
      category: "physics",
      requiredKeys: ["formula", "definition"],
      prompts: [
         "Which physical law or concept is represented by the formula {formula}?",
         "In physics, what relation or principle does the formula {formula} describe?",
         "If you see the formula {formula} in a physics textbook, which concept does it refer to?",
         "Identify the physics principle that is mathematically formulated as {formula}:",
      ],
      explanations: [
         "The formula {formula} represents {label}, which is defined as: {definition}.",
         "In physics, {label} is mathematically expressed as {formula} ({definition}).",
      ],
   },
   {
      id: "phys_unit",
      category: "physics",
      requiredKeys: ["unit", "quantity"],
      prompts: [
         "What physical quantity is measured using the unit '{unit}'?",
         "In the SI system, the unit '{unit}' is used to measure which quantity?",
         "Which physical property corresponds to the measurement unit '{unit}'?",
         "If an instrument measures a value in '{unit}', what physical quantity is it recording?",
      ],
      explanations: [
         "{label} ({quantity}) is measured in '{unit}'.",
         "The standard unit of measurement for {label} is the '{unit}'.",
      ],
   },
   {
      id: "phys_constant",
      category: "physics",
      requiredKeys: ["constant_value", "symbol"],
      prompts: [
         "What is the approximate numerical value of the physics constant '{label}' ({symbol})?",
         "Which value represents the physical constant '{label}' (denoted by {symbol})?",
         "In physics equations, the constant '{label}' ({symbol}) is assigned which value?",
         "What is the standard value used for the physical constant {symbol} ({label})?",
      ],
      explanations: [
         "The constant '{label}' ({symbol}) has a value of approximately {constant_value}.",
         "In physics, the value of '{label}' ({symbol}) is defined as {constant_value}.",
      ],
   },
   {
      id: "phys_discovered",
      category: "physics",
      requiredKeys: ["discovered_by", "discovery_year"],
      prompts: [
         "Who discovered or formulated the concept of {label} in {discovery_year}?",
         "Which physicist is credited with the discovery of {label} in the year {discovery_year}?",
         "In {discovery_year}, who is famous for introducing or discovering {label}?",
         "The discovery of {label} in the year {discovery_year} is credited to which scientist?",
      ],
      explanations: [
         "{label} was discovered/formulated by {discovered_by} in {discovery_year}.",
         "In {discovery_year}, {discovered_by} successfully discovered or formulated {label}.",
      ],
   },
   {
      id: "phys_effect",
      category: "physics",
      requiredKeys: ["causes", "results_in"],
      prompts: [
         "What physical phenomenon causes {results_in} when {causes} occurs?",
         "When {causes} happens, it results in {results_in}. What is this effect called?",
         "Which physics concept describes how {causes} directly leads to {results_in}?",
         "Identify the effect or law that explains why {causes} results in {results_in}:",
      ],
      explanations: [
         "The {label} explains how {causes} results in {results_in}.",
         "Under {label}, the occurrence of {causes} directly results in {results_in}.",
      ],
   },
   {
      id: "phys_application",
      category: "physics",
      requiredKeys: ["primary_use", "field"],
      prompts: [
         "In the field of {field}, what is the primary application of {label}?",
         "Which concept is widely used in {field} for the purpose of {primary_use}?",
         "What is {label} primarily utilized for within the domain of {field}?",
         "Within {field}, which physical system or tool is used for {primary_use}?",
      ],
      explanations: [
         "In {field}, {label} is primarily used for {primary_use}.",
         "{label} finds its major application in {field} for {primary_use}.",
      ],
   },
   {
      id: "phys_law_relation",
      category: "physics",
      requiredKeys: ["relates_a", "relates_b"],
      prompts: [
         "What physical law or principle relates {relates_a} to {relates_b}?",
         "Which concept in physics describes the direct relationship between {relates_a} and {relates_b}?",
         "If you want to calculate the relation between {relates_a} and {relates_b}, which law do you use?",
         "Identify the law that connects {relates_a} with {relates_b}:",
      ],
      explanations: [
         "{label} describes the relationship between {relates_a} and {relates_b}.",
         "The connection between {relates_a} and {relates_b} is governed by {label}.",
      ],
   },
   {
      id: "phys_instrument",
      category: "physics",
      requiredKeys: ["measured_by"],
      prompts: [
         "Which scientific instrument is used to measure {label}?",
         "If a scientist wants to measure {label}, which device should they use?",
         "What is the standard measurement tool or device for {label}?",
         "Identify the instrument specifically designed to measure {label}:",
      ],
      explanations: [
         "{label} is standardly measured using a {measured_by}.",
         "A {measured_by} is the primary instrument used for detecting or measuring {label}.",
      ],
   },
   {
      id: "phys_state_transition",
      category: "physics",
      requiredKeys: ["initial_state", "final_state"],
      prompts: [
         "What is the term for the phase transition of {label} from a {initial_state} to a {final_state}?",
         "When a substance transitions from a {initial_state} state to a {final_state} state, what is this process called?",
         "Which term describes the physical change of state from {initial_state} directly to {final_state}?",
         "Identify the term for phase change where a {initial_state} becomes a {final_state}:",
      ],
      explanations: [
         "{label} is the phase transition from a {initial_state} to a {final_state}.",
         "The transition of state from {initial_state} to {final_state} is known as {label}.",
      ],
   },
   {
      id: "phys_particle",
      category: "physics",
      requiredKeys: ["charge", "spin"],
      prompts: [
         "Which subatomic particle or state has a charge of {charge} and a spin of {spin}?",
         "Identify the particle characterized by a charge of {charge} and spin {spin}:",
         "If a quantum particle has spin {spin} and electric charge {charge}, what is it?",
         "Which particle matches the quantum properties of {charge} charge and {spin} spin?",
      ],
      explanations: [
         "{label} has an electric charge of {charge} and a quantum spin of {spin}.",
         "The properties of {label} include a charge of {charge} and a spin of {spin}.",
      ],
   },

   // ═══════════════════════════════════════════════════════════
   // CHEMISTRY (10 templates)
   // ═══════════════════════════════════════════════════════════
   {
      id: "chem_atomic_no",
      category: "chemistry",
      requiredKeys: ["atomic_number", "symbol"],
      prompts: [
         "Which chemical element has the symbol '{symbol}' and atomic number {atomic_number}?",
         "Identify the element with atomic number {atomic_number} (chemical symbol '{symbol}'):",
         "If you look at the periodic table under atomic number {atomic_number}, which element has the symbol '{symbol}'?",
         "What is the name of the element represented by the symbol '{symbol}' (atomic number {atomic_number})?",
      ],
      explanations: [
         "{label} has the chemical symbol '{symbol}' and atomic number {atomic_number}.",
         "Atomic number {atomic_number} corresponds to {label} ({symbol}).",
      ],
   },
   {
      id: "chem_group_block",
      category: "chemistry",
      requiredKeys: ["group", "block"],
      prompts: [
         "In which periodic group and orbital block is the element {label} located?",
         "What is the periodic table group and block classification for {label}?",
         "The element {label} belongs to which group and orbital block?",
         "Identify the group and block coordinates of {label} on the periodic table:",
      ],
      explanations: [
         "{label} is located in group {group} and belongs to the '{block}' block.",
         "On the periodic table, {label} resides in group {group} within the {block}-block.",
      ],
   },
   {
      id: "chem_discovered",
      category: "chemistry",
      requiredKeys: ["discovered_by", "discovery_year"],
      prompts: [
         "Which chemist is credited with discovering the element {label} in the year {discovery_year}?",
         "Who discovered {label} in {discovery_year}?",
         "In what year did {discovered_by} discover the chemical element {label}?",
         "The element {label} was first discovered by {discovered_by} in which year?",
      ],
      explanations: [
         "{label} was discovered by {discovered_by} in {discovery_year}.",
         "The credit for discovering {label} in {discovery_year} goes to {discovered_by}.",
      ],
   },
   {
      id: "chem_named_after",
      category: "chemistry",
      requiredKeys: ["named_after"],
      prompts: [
         "What or who was the chemical element {label} named after?",
         "The name of the element {label} is derived from which source?",
         "Which element gets its name from {named_after}?",
         "Originating from '{named_after}', which chemical element's name is this?",
      ],
      explanations: [
         "{label} was named after '{named_after}'.",
         "The name of the element {label} honors or originates from '{named_after}'.",
      ],
   },
   {
      id: "chem_abundance",
      category: "chemistry",
      requiredKeys: ["abundance", "state"],
      prompts: [
         "Which element is a {state} at room temperature and has a '{abundance}' cosmic abundance?",
         "At standard temperature, which element is a {state} with '{abundance}' abundance in the universe?",
         "Identify the element that exists as a {state} and has '{abundance}' abundance:",
         "Which element is classified as a {state} with a cosmic abundance rated as '{abundance}'?",
      ],
      explanations: [
         "{label} is a {state} with '{abundance}' abundance in the universe.",
         "Cosmically, {label} is a '{abundance}' abundance element existing as a {state}.",
      ],
   },
   {
      id: "chem_use",
      category: "chemistry",
      requiredKeys: ["primary_use"],
      prompts: [
         "What is the primary industrial or commercial use of the element {label}?",
         "Which chemical element is widely used in applications like {primary_use}?",
         "In manufacturing and technology, what is the element {label} majorly utilized for?",
         "For which of the following applications ({primary_use}) is {label} commonly used?",
      ],
      explanations: [
         "{label} is primarily used for {primary_use}.",
         "The main commercial application of {label} is in {primary_use}.",
      ],
   },
   {
      id: "chem_boiling_point",
      category: "chemistry",
      requiredKeys: ["boiling_point", "melting_point"],
      prompts: [
         "Which element melting at {melting_point}°C and boiling at {boiling_point}°C is this?",
         "Identify the element with a melting point of {melting_point}°C and a boiling point of {boiling_point}°C:",
         "Which chemical substance has a transition melting point of {melting_point}°C and boiling point of {boiling_point}°C?",
         "What element has the thermal characteristics of melting at {melting_point}°C and boiling at {boiling_point}°C?",
      ],
      explanations: [
         "{label} melts at {melting_point}°C and boils at {boiling_point}°C.",
         "The melting and boiling points of {label} are {melting_point}°C and {boiling_point}°C respectively.",
      ],
   },
   {
      id: "chem_category",
      category: "chemistry",
      requiredKeys: ["chemical_category", "state"],
      prompts: [
         "What is the chemical category of {label}, which exists as a {state} at room temperature?",
         "How is {label} classified in chemical categories (existing as a {state})?",
         "Identify the chemical family and room-temperature state of {label}:",
         "Is {label} classified as a {chemical_category} (state: {state})?",
      ],
      explanations: [
         "{label} is classified as a {chemical_category} and is a {state} at room temperature.",
         "The element {label} belongs to the {chemical_category} family and is a {state}.",
      ],
   },
   {
      id: "chem_valence",
      category: "chemistry",
      requiredKeys: ["valence_electrons"],
      prompts: [
         "How many valence electrons are present in an atom of {label}?",
         "What is the number of outer shell (valence) electrons in the element {label}?",
         "An atom of {label} has how many valence electrons available for bonding?",
         "Identify the valence electron count for the element {label}:",
      ],
      explanations: [
         "{label} has {valence_electrons} valence electrons in its outer shell.",
         "The valence shell of {label} contains {valence_electrons} electrons.",
      ],
   },
   {
      id: "chem_ion_charge",
      category: "chemistry",
      requiredKeys: ["common_ion_charge"],
      prompts: [
         "What is the most common ion charge formed by the element {label} in chemical reactions?",
         "When forming ionic compounds, what charge does the element {label} typically acquire?",
         "Identify the common oxidation state or ion charge of {label}:",
         "Which charge is most characteristic of the stable ion of {label}?",
      ],
      explanations: [
         "{label} commonly forms an ion with a charge of {common_ion_charge}.",
         "The standard stable ion charge for {label} is {common_ion_charge}.",
      ],
   },

   // ═══════════════════════════════════════════════════════════
   // MATHS (10 templates)
   // ═══════════════════════════════════════════════════════════
   {
      id: "math_formula_def",
      category: "maths",
      requiredKeys: ["formula", "definition"],
      prompts: [
         "Which mathematical relation or theorem is represented by the formula {formula}?",
         "What mathematical rule does the equation {formula} define?",
         "If you write the equation {formula}, what concept are you calculating?",
         "Identify the mathematical relation formulated as {formula}:",
      ],
      explanations: [
         "The formula {formula} represents the {label} ({definition}).",
         "The {label} is mathematically expressed as {formula}.",
      ],
   },
   {
      id: "math_template_use",
      category: "maths",
      requiredKeys: ["formula", "example_template"],
      prompts: [
         "Which formula or rule resolves the mathematical relationship: '{example_template}'?",
         "What mathematical theorem describes the calculation: '{example_template}'?",
         "Which theorem applies to the following problem template: '{example_template}'?",
         "Identify the mathematical rule used to solve: '{example_template}':",
      ],
      explanations: [
         "The relation '{example_template}' is solved using the {label} ({formula}).",
         "We apply the {label} ({formula}) to solve '{example_template}'.",
      ],
   },
   {
      id: "math_branches",
      category: "maths",
      requiredKeys: ["branch"],
      prompts: [
         "Which branch of mathematics does the theorem '{label}' belong to?",
         "The concept of '{label}' is studied under which mathematical branch?",
         "Under which field of mathematics would you study the '{label}'?",
         "Identify the primary branch of mathematics for '{label}':",
      ],
      explanations: [
         "'{label}' is studied under the branch of {branch}.",
         "In mathematics, {label} belongs to the field of {branch}.",
      ],
   },
   {
      id: "math_geometric_sides",
      category: "maths",
      requiredKeys: ["sides_count"],
      prompts: [
         "In geometry, how many sides does a '{label}' have?",
         "What is the number of sides in a geometric '{label}'?",
         "If a polygon is classified as a '{label}', how many sides does it possess?",
         "Identify the side count of a '{label}':",
      ],
      explanations: [
         "A {label} has exactly {sides_count} sides.",
         "By definition, a geometric {label} has {sides_count} sides.",
      ],
   },
   {
      id: "math_angles_sum",
      category: "maths",
      requiredKeys: ["sum_of_angles"],
      prompts: [
         "What is the sum of the interior angles of a '{label}'?",
         "In Euclidean geometry, the interior angles of a '{label}' always sum to how many degrees?",
         "What is the total sum of angles inside a '{label}'?",
         "Identify the sum of interior angles for a geometric '{label}':",
      ],
      explanations: [
         "The interior angles of a {label} sum to {sum_of_angles} degrees.",
         "A {label} has a total interior angle sum of {sum_of_angles}.",
      ],
   },
   {
      id: "math_dimensions",
      category: "maths",
      requiredKeys: ["dimensions"],
      prompts: [
         "How many dimensions does a geometric '{label}' occupy?",
         "In spatial geometry, a '{label}' exists in how many dimensions?",
         "What is the dimensional measurement of a '{label}'?",
         "Identify the number of dimensions for the object '{label}':",
      ],
      explanations: [
         "A {label} is a {dimensions}-dimensional object.",
         "The spatial dimensions of a {label} are {dimensions}.",
      ],
   },
   {
      id: "math_constant_approx",
      category: "maths",
      requiredKeys: ["approximate_value"],
      prompts: [
         "What is the approximate numerical value of the mathematical constant '{label}'?",
         "Which value represents the mathematical constant '{label}'?",
         "In algebra and calculus, the constant '{label}' is approximately equal to what?",
         "What is the standard approximation of the constant '{label}'?",
      ],
      explanations: [
         "'{label}' is approximately equal to {approximate_value}.",
         "The mathematical constant '{label}' has an approximate value of {approximate_value}.",
      ],
   },
   {
      id: "math_operations",
      category: "maths",
      requiredKeys: ["inverse_operation"],
      prompts: [
         "What is the mathematical inverse operation of '{label}'?",
         "Which arithmetic or algebraic operation directly reverses '{label}'?",
         "If you perform '{label}', which operation undoes it?",
         "Identify the inverse operation of '{label}':",
      ],
      explanations: [
         "The inverse of '{label}' is '{inverse_operation}'.",
         "The operation '{inverse_operation}' directly reverses '{label}'.",
      ],
   },
   {
      id: "math_identity_element",
      category: "maths",
      requiredKeys: ["identity_element"],
      prompts: [
         "What is the identity element for the operation '{label}'?",
         "In algebra, which number acts as the identity element for '{label}'?",
         "Performing the operation '{label}' with which element leaves a number unchanged?",
         "Identify the identity element corresponding to '{label}':",
      ],
      explanations: [
         "The identity element for '{label}' is {identity_element}.",
         "Under '{label}', the number {identity_element} is the identity element.",
      ],
   },
   {
      id: "math_history",
      category: "maths",
      requiredKeys: ["originated_by"],
      prompts: [
         "Which ancient or modern mathematician is credited with inventing or originating the '{label}'?",
         "Who is the historical mathematical figure behind the '{label}'?",
         "The invention or discovery of '{label}' is attributed to whom?",
         "Identify the mathematician who originated the '{label}':",
      ],
      explanations: [
         "The '{label}' was originated by the mathematician {originated_by}.",
         "{originated_by} is credited with the formulation of the '{label}'.",
      ],
   },

   // ═══════════════════════════════════════════════════════════
   // ENGLISH / LANGUAGE (10 templates)
   // ═══════════════════════════════════════════════════════════
   {
      id: "lang_definition",
      category: "english_language",
      requiredKeys: ["definition"],
      prompts: [
         'Which word matches this English definition: "{definition}"?',
         'What term is defined as: "{definition}"?',
         'Identify the vocab word that is defined as follows: "{definition}"',
         'In English grammar or vocabulary, what does the term "{label}" mean?',
      ],
      explanations: [
         '"{label}" matches the definition: "{definition}".',
         'The definition "{definition}" belongs to "{label}".',
      ],
   },
   {
      id: "lang_example",
      category: "english_language",
      requiredKeys: ["example"],
      prompts: [
         'Which literary or grammatical term is demonstrated by the example: "{example}"?',
         'What concept has this example: "{example}"?',
         'Identify the grammatical rule or figure of speech illustrated here: "{example}"',
         'Which term best fits the example: "{example}"?',
      ],
      explanations: [
         '"{example}" is a classic example of {label}.',
         'The example "{example}" illustrates the concept of {label}.',
      ],
   },
   {
      id: "lang_antonym",
      category: "english_language",
      requiredKeys: ["antonym"],
      prompts: [
         'What is the direct antonym (opposite) of the word "{label}"?',
         'Which word has the opposite meaning of "{label}"?',
         'In vocabulary, what is the antonym of "{label}"?',
         'Identify the antonym for the term "{label}":',
      ],
      explanations: [
         'The antonym of "{label}" is "{antonym}".',
         '"{label}" directly contrasts with "{antonym}".',
      ],
   },
   {
      id: "lang_synonym",
      category: "english_language",
      requiredKeys: ["synonym"],
      prompts: [
         'Which word is a direct synonym of "{label}"?',
         'What is another word that shares the same meaning as "{label}"?',
         'Identify the synonym of the term "{label}":',
         'In English vocabulary, which of these is synonymous with "{label}"?',
      ],
      explanations: [
         'A synonym of "{label}" is "{synonym}".',
         '"{label}" shares its meaning with the synonym "{synonym}".',
      ],
   },
   {
      id: "lang_part_of_speech",
      category: "english_language",
      requiredKeys: ["part_of_speech"],
      prompts: [
         'What part of speech is the word "{label}"?',
         'In English grammar, how is the word "{label}" classified?',
         'Identify the grammatical classification (part of speech) for "{label}":',
         'Which part of speech best describes "{label}"?',
      ],
      explanations: [
         '"{label}" is classified as a {part_of_speech}.',
         'Grammatically, "{label}" functions as a {part_of_speech}.',
      ],
   },
   {
      id: "lang_origin",
      category: "english_language",
      requiredKeys: ["word_origin"],
      prompts: [
         'What language is the word "{label}" derived from?',
         'What is the etymological origin of the term "{label}"?',
         'The word "{label}" originates from which ancient or modern language?',
         'Identify the language origin of the vocabulary word "{label}":',
      ],
      explanations: [
         '"{label}" originates from the {word_origin} language.',
         'The etymology of "{label}" traces back to {word_origin}.',
      ],
   },
   {
      id: "lang_idiom_meaning",
      category: "english_language",
      requiredKeys: ["idiom_meaning"],
      prompts: [
         'What is the actual meaning of the idiom "{label}"?',
         'If someone uses the idiom "{label}", what do they mean?',
         'Identify the figurative meaning of the phrase "{label}":',
         'Which definition best explains the common idiom "{label}"?',
      ],
      explanations: [
         'The idiom "{label}" means "{idiom_meaning}".',
         'Figuratively, "{label}" is used to describe "{idiom_meaning}".',
      ],
   },
   {
      id: "lang_confusion_reason",
      category: "english_language",
      requiredKeys: ["confusion_reason"],
      prompts: [
         'Why are the words "{label}" commonly confused in English?',
         'What is the primary source of confusion between "{label}"?',
         'Identify the linguistic explanation for confusing "{label}":',
         'What causes writers to frequently mix up "{label}"?',
      ],
      explanations: [
         '"{label}" are confused because: {confusion_reason}.',
         'The confusion surrounding "{label}" arises from: {confusion_reason}.',
      ],
   },
   {
      id: "lang_plural_form",
      category: "english_language",
      requiredKeys: ["plural_form"],
      prompts: [
         'What is the correct plural form of the word "{label}"?',
         'How do you write the plural of "{label}"?',
         'Identify the plural version of "{label}":',
         'In English grammar, which of these is the plural of "{label}"?',
      ],
      explanations: [
         'The plural of "{label}" is "{plural_form}".',
         'To make "{label}" plural, we write "{plural_form}".',
      ],
   },
   {
      id: "lang_derived_form",
      category: "english_language",
      requiredKeys: ["derived_form"],
      prompts: [
         'What is the noun or adjective form derived from the verb "{label}"?',
         'Which word is a direct derivation of "{label}"?',
         'Identify the derived word form of "{label}":',
         'In vocabulary building, which of these is derived from "{label}"?',
      ],
      explanations: [
         'The derived form of "{label}" is "{derived_form}".',
         '"{derived_form}" is directly derived from "{label}".',
      ],
   },

   // ═══════════════════════════════════════════════════════════
   // FOOTBALL (10 templates)
   // ═══════════════════════════════════════════════════════════
   {
      id: "foot_record_holder",
      category: "football",
      requiredKeys: ["record_holder", "record_value"],
      prompts: [
         "Who holds the record for {label}?",
         "Which football player or club holds the record of {record_value} for {label}?",
         "Identify the record holder for {label}:",
         "For {label}, which name is associated with the record of {record_value}?",
      ],
      explanations: [
         "{record_holder} holds the record for {label} with {record_value}.",
         "The record for {label} is held by {record_holder} ({record_value}).",
      ],
   },
   {
      id: "foot_team_nick",
      category: "football",
      requiredKeys: ["nickname", "stadium"],
      prompts: [
         "Which football club playing at {stadium} is famously nicknamed '{nickname}'?",
         "Which team has their home ground at {stadium} and is nicknamed '{nickname}'?",
         "Identify the club associated with the stadium {stadium} and the nickname '{nickname}':",
         "If a club is nicknamed '{nickname}' and plays at {stadium}, which club is it?",
      ],
      explanations: [
         "{label} plays at {stadium} and is nicknamed '{nickname}'.",
         "Famously nicknamed '{nickname}', {label} plays their home matches at {stadium}.",
      ],
   },
   {
      id: "foot_ucl_wins",
      category: "football",
      requiredKeys: ["ucl_titles", "country"],
      prompts: [
         "Which football club from {country} has won the UEFA Champions League {ucl_titles} times?",
         "Hailing from {country}, which team has claimed {ucl_titles} UCL trophies?",
         "Identify the club in {country} with exactly {ucl_titles} Champions League titles:",
         "Which team boasts {ucl_titles} UEFA Champions League titles and plays in {country}?",
      ],
      explanations: [
         "{label} of {country} has won the UCL {ucl_titles} times.",
         "With {ucl_titles} UCL titles, {label} is one of {country}'s most decorated clubs.",
      ],
   },
   {
      id: "foot_ballon_dor",
      category: "football",
      requiredKeys: ["ballon_dor_wins"],
      prompts: [
         "How many times has {label} won the prestigious Ballon d'Or award?",
         "What is the total number of Ballon d'Or titles claimed by {label}?",
         "Identify the number of times {label} has been crowned with the Ballon d'Or:",
         "How many Ballon d'Or trophies are in the cabinet of {label}?",
      ],
      explanations: [
         "{label} has won the Ballon d'Or {ballon_dor_wins} times.",
         "The Ballon d'Or has been awarded to {label} a record {ballon_dor_wins} times.",
      ],
   },
   {
      id: "foot_founded_year",
      category: "football",
      requiredKeys: ["founded_year", "country"],
      prompts: [
         "In which year was the football club {label} founded in {country}?",
         "What is the founding year of the club {label} (located in {country})?",
         "Which year marks the establishment of {label} in {country}?",
         "When was the team {label} formed in {country}?",
      ],
      explanations: [
         "{label} was founded in {country} in the year {founded_year}.",
         "The establishment of {label} in {country} occurred in {founded_year}.",
      ],
   },
   {
      id: "foot_manager",
      category: "football",
      requiredKeys: ["famous_manager", "manager_tenure"],
      prompts: [
         "Which manager led {label} during their iconic tenure ({manager_tenure})?",
         "Who was the legendary manager of {label} during the period {manager_tenure}?",
         "Identify the famous manager associated with {label} from {manager_tenure}:",
         "Under whose management did {label} compete during {manager_tenure}?",
      ],
      explanations: [
         "{famous_manager} managed {label} during {manager_tenure}.",
         "{label} was managed by the legendary {famous_manager} during {manager_tenure}.",
      ],
   },
   {
      id: "foot_league",
      category: "football",
      requiredKeys: ["domestic_league"],
      prompts: [
         "Which domestic league does the club {label} compete in?",
         "In which country's top division (league: {domestic_league}) does {label} play?",
         "Identify the primary domestic league for the club {label}:",
         "What is the home league of the football team {label}?",
      ],
      explanations: [
         "{label} competes in the {domestic_league}.",
         "The domestic league for {label} is the {domestic_league}.",
      ],
   },
   {
      id: "foot_rivalry",
      category: "football",
      requiredKeys: ["main_rival", "derby_name"],
      prompts: [
         "What is the famous name of the derby rivalry between {label} and {main_rival}?",
         "The match between {label} and {main_rival} is known as what?",
         "Which derby matches {label} against their main rival {main_rival}?",
         "Identify the rivalry name ({derby_name}) involving {label}:",
      ],
      explanations: [
         "The rivalry between {label} and {main_rival} is called {derby_name}.",
         "Known as the {derby_name}, this match pits {label} against {main_rival}.",
      ],
   },
   {
      id: "foot_top_scorer",
      category: "football",
      requiredKeys: ["all_time_top_scorer"],
      prompts: [
         "Who is the all-time top goal scorer in the history of the club {label}?",
         "Which legendary player holds the record for most goals scored for {label}?",
         "Identify the all-time top scorer of {label}:",
         "Whose name leads the scoring records of {label} as all-time top scorer?",
      ],
      explanations: [
         "The all-time top scorer of {label} is {all_time_top_scorer}.",
         "{all_time_top_scorer} has scored more goals for {label} than any other player.",
      ],
   },
   {
      id: "foot_kit_colors",
      category: "football",
      requiredKeys: ["home_kit_colors"],
      prompts: [
         "What are the traditional home kit colors of the club {label}?",
         "Which colors does {label} historically wear for their home matches?",
         "Identify the home kit colors of {label}:",
         "If you visit a home match of {label}, what primary colors will the team be wearing?",
      ],
      explanations: [
         "{label}'s home kit traditionally features {home_kit_colors}.",
         "The official home colors of {label} are {home_kit_colors}.",
      ],
   },
];

export function getRandomMatchingTemplate(
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   entity: any,
   category: string,
   rng: () => number,
   customTemplates?: MatrixTemplate[],
): MatrixTemplate | null {
   const templatesToUse =
      customTemplates && customTemplates.length > 0
         ? customTemplates
         : QUESTION_TEMPLATES;

   const matches = templatesToUse.filter((t) => {
      // Check if it belongs to the category
      if (t.category !== category) return false;
      // Check if the entity metadata contains all required keys
      const meta = entity.metadata || {};
      return t.requiredKeys.every((key) => {
         const val = meta[key];
         return val !== undefined && String(val).trim() !== "";
      });
   });

   if (matches.length === 0) return null;
   const shuffled = seededShuffle(matches, rng);
   return shuffled[0];
}
