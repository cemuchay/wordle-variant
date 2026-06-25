export function makeProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'user-test',
    rating: 600,
    xp: 0,
    games_played: 0,
    games_won: 0,
    games_lost: 0,
    games_tied: 0,
    rank_name: 'Bronze',
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeOpponentProfile(overrides: Record<string, any> = {}) {
  return makeProfile({ id: 'opponent-test', rating: 600, ...overrides });
}

export function makeGuestProfile(overrides: Record<string, any> = {}) {
  return { id: 'guest-test', username: 'GuestPlayer', avatar_url: '', ...overrides };
}
