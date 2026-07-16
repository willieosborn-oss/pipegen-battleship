/**
 * Verbatim UI copy for PipeGen Battleship.
 *
 * These strings are fixed product copy. Use them exactly; do not invent
 * alternatives. Event helpers return the exact status-bar text for each result.
 */

import type { ShipName } from '../engine';

export const TITLE = 'PipeGen Battleship';

export const PLAYER_GRID_TITLE = 'Your Book of Business';
export const AI_GRID_TITLE = 'Competitor Territory';

export const EVENT_HIT = 'Meeting booked!';
export const EVENT_MISS = 'Gone dark.';
export const eventSunk = (shipName: ShipName): string => `Closed won: ${shipName}`;

export const EVENT_WIN = "Quota hit. President's Club.";
export const EVENT_LOSS = 'Pipeline dried up. Rebuild the book?';

export const TURN_PLAYER = 'Your dial';
export const TURN_AI = 'AI is prospecting...';

export const FOOTER = 'An SDR never fires at the same account twice.';

export const NEW_GAME = 'New Quarter';

export const MOUNT_LOG =
  'Hi Cognition team. This game was built with Devin. Bug doc and session links in the repo README.';
