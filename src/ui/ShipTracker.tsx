/**
 * Fleet status for one side: each of the five ships and whether it is sunk.
 *
 * Sunk status is derived from each ship's own `hits` array (visual/derived
 * state only). Win/loss is never inferred here.
 */

import type { Board } from '../engine';

interface ShipTrackerProps {
  readonly title: string;
  readonly board: Board;
}

export function ShipTracker({ title, board }: ShipTrackerProps) {
  return (
    <section className="tracker">
      <h3 className="tracker-title">{title}</h3>
      <ul className="tracker-list">
        {board.ships.map((ship) => {
          const sunk = ship.hits.every((h) => h);
          return (
            <li
              key={ship.name}
              className={`tracker-item${sunk ? ' tracker-item-sunk' : ''}`}
            >
              <span className="tracker-name">{ship.name}</span>
              <span className="tracker-status">{sunk ? 'Closed won' : 'Open'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
