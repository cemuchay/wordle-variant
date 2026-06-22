export interface CategoryQuestionConfig {
  proceduralWeight: number
  variantWeights: number[]
}

const DEFAULT_CONFIG: CategoryQuestionConfig = {
  proceduralWeight: 0.5,
  variantWeights: [1, 1, 1, 1, 1, 1],
}

const CATEGORY_QUESTION_CONFIG: Record<string, Partial<CategoryQuestionConfig>> = {
  maths: {
    proceduralWeight: 0.7,
    variantWeights: [3, 1, 1, 2, 1, 2],
  },
  english_language: {
    proceduralWeight: 0.6,
    variantWeights: [2.5, 1, 1, 2.5, 1, 2],
  },
  flag_bearer: {
    variantWeights: [3, 2, 1, 2, 1, 1],
  },
  capitals_clash: {
    variantWeights: [2, 2, 1.5, 1.5, 1, 1],
  },
  element_arena: {
    variantWeights: [2, 2, 1, 1.5, 2, 1],
  },
  animal_kingdom: {
    variantWeights: [2, 2, 1.5, 1, 1.5, 1],
  },
  cosmic_frontier: {
    variantWeights: [2, 1.5, 1, 1.5, 2, 1],
  },
  history_milestones: {
    variantWeights: [1.5, 1.5, 1, 1.5, 2.5, 1],
  },
  cinephile_trivia: {
    variantWeights: [2, 2, 1, 1.5, 2, 1],
  },
  currency_exchange: {
    variantWeights: [2, 2, 1.5, 1.5, 1, 1],
  },
  naija_celebs: {
    variantWeights: [2, 2, 1, 1.5, 2, 1],
  },
  elon_musk: {
    variantWeights: [2, 2, 1, 1.5, 2, 1],
  },
  naija_music: {
    variantWeights: [2, 2, 1, 1.5, 2, 1],
  },
  unn_lions: {
    variantWeights: [2, 2, 1.5, 1.5, 1, 1],
  },
  nysc_trivia: {
    variantWeights: [2, 2, 1.5, 1.5, 1, 1],
  },
  us_tech_trivia: {
    variantWeights: [2, 1.5, 1, 1.5, 2, 1],
  },
}

export function getQuestionConfig(category: string): CategoryQuestionConfig {
  const override = CATEGORY_QUESTION_CONFIG[category] || {}
  return {
    ...DEFAULT_CONFIG,
    ...override,
    variantWeights: override.variantWeights ?? DEFAULT_CONFIG.variantWeights,
  }
}
