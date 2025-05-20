
export const DEFAULT_TARGET_SCORE = 100;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4; // Max players for a single game, not tournament
export const PENALTY_POINTS = 10;

export const LOCAL_STORAGE_KEYS = {
  CACHED_PLAYERS: 'frenchDomino_cachedPlayers',
  ACTIVE_GAMES_LIST: 'frenchDomino_activeGamesList',
  GAME_STATE_PREFIX: 'frenchDomino_gameState_', // Append gameId
  ACTIVE_TOURNAMENTS_LIST: 'frenchDomino_activeTournamentsList',
  TOURNAMENT_STATE_PREFIX: 'frenchDomino_tournamentState_', // Append tournamentId
};

// Default K-factors for tournament scoring
export const DEFAULT_WIN_BONUS_K = 0.20;
export const DEFAULT_BUST_PENALTY_K = 0.40;
export const DEFAULT_PG_KICKER_K = 0.05;
