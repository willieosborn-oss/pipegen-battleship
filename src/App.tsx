import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createGame,
  fireShot,
  chooseAiShot,
  type Coord,
  type FireResult,
} from './engine';
import { Grid } from './ui/Grid';
import { ShipTracker } from './ui/ShipTracker';
import { StatusBar } from './ui/StatusBar';
import {
  AI_GRID_TITLE,
  EVENT_HIT,
  EVENT_LOSS,
  EVENT_MISS,
  EVENT_WIN,
  MOUNT_LOG,
  NEW_GAME,
  PLAYER_GRID_TITLE,
  TITLE,
  TURN_AI,
  TURN_PLAYER,
  eventSunk,
} from './ui/copy';
import './App.css';

/** Delay before the temporary AI fires its shot, in milliseconds. */
const AI_DELAY_MS = 600;

/**
 * Map a fire result to the exact status-bar copy. Win/loss (read from the
 * returned `winner` field, never by scanning the board) take precedence over
 * the hit/miss/sunk copy.
 */
function describeResult(res: FireResult): string {
  if (res.winner === 'player') return EVENT_WIN;
  if (res.winner === 'ai') return EVENT_LOSS;
  switch (res.result) {
    case 'hit':
      return EVENT_HIT;
    case 'miss':
      return EVENT_MISS;
    case 'sunk':
      return eventSunk(res.shipName!);
    default:
      return '';
  }
}

function App() {
  const [game, setGame] = useState(() => createGame());
  const [event, setEvent] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log(MOUNT_LOG);
  }, []);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clear any pending AI timer if the component unmounts.
  useEffect(() => clearPendingTimer, [clearPendingTimer]);

  const handlePlayerFire = useCallback(
    (coord: Coord) => {
      // Ignore all input while the AI's delayed shot is pending or the game is over.
      if (aiPending || game.winner !== null) return;

      const playerRes = fireShot(game, 'player', coord);
      if (playerRes.result === 'invalid') return;

      setGame(playerRes.newState);
      setEvent(describeResult(playerRes));

      if (playerRes.winner !== null) return; // Player won: no AI turn.

      // Hand the turn to the temporary AI after a fixed delay.
      setAiPending(true);
      timerRef.current = setTimeout(() => {
        const aiCoord = chooseAiShot(playerRes.newState);
        const aiRes = fireShot(playerRes.newState, 'ai', aiCoord);
        setGame(aiRes.newState);
        setEvent(describeResult(aiRes));
        setAiPending(false);
        timerRef.current = null;
      }, AI_DELAY_MS);
    },
    [aiPending, game],
  );

  const handleNewGame = useCallback(() => {
    clearPendingTimer();
    setGame(createGame());
    setEvent('');
    setAiPending(false);
  }, [clearPendingTimer]);

  const turnLabel =
    game.winner !== null ? '' : aiPending ? TURN_AI : TURN_PLAYER;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">{TITLE}</h1>
        <button type="button" className="new-game" onClick={handleNewGame}>
          {NEW_GAME}
        </button>
      </header>

      <StatusBar turnLabel={turnLabel} event={event} />

      <main className="boards">
        <div className="board-column">
          <Grid
            title={PLAYER_GRID_TITLE}
            board={game.playerBoard}
            showShips
            canFire={false}
          />
          <ShipTracker title={PLAYER_GRID_TITLE} board={game.playerBoard} />
        </div>

        <div className="board-column">
          <Grid
            title={AI_GRID_TITLE}
            board={game.aiBoard}
            showShips={false}
            canFire={game.winner === null && !aiPending}
            onFire={handlePlayerFire}
          />
          <ShipTracker title={AI_GRID_TITLE} board={game.aiBoard} />
        </div>
      </main>
    </div>
  );
}

export default App;
