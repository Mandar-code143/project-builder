// [P6 — MINIMAX AND ALPHA-BETA PRUNING] Selects optimal moves in a two-player game
// and cuts off branches that cannot affect the decision.

export type Cell = "X" | "O" | null;
export type Board = Cell[];

export const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function emptyBoard(): Board {
  return Array<Cell>(9).fill(null);
}

export function availableMoves(board: Board): number[] {
  return board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
}

export interface GameState {
  winner: "X" | "O" | null;
  winningLine: number[] | null;
  draw: boolean;
  over: boolean;
}

export function evaluateBoard(board: Board): GameState {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: line, draw: false, over: true };
    }
  }
  return {
    winner: null,
    winningLine: null,
    draw: availableMoves(board).length === 0,
    over: availableMoves(board).length === 0,
  };
}

export interface MinimaxRun {
  move: number | null;
  score: number;
  nodesEvaluated: number;
  cutoffs: number;
}

const WIN = 10;
const LOSS = -10;

/**
 * Recursive minimax with optional alpha-beta pruning. Terminal utility favors
 * faster wins and slower losses via a depth adjustment. Node evaluations and
 * cutoff counts are real measurements from the executed search.
 */
export function minimaxMove(
  board: Board,
  aiPlayer: "X" | "O",
  useAlphaBeta: boolean,
): MinimaxRun {
  let nodesEvaluated = 0;
  let cutoffs = 0;

  const other = (p: "X" | "O"): "X" | "O" => (p === "X" ? "O" : "X");

  const recurse = (
    current: Board,
    player: "X" | "O",
    depth: number,
    alpha: number,
    beta: number,
  ): number => {
    nodesEvaluated++;
    const state = evaluateBoard(current);
    if (state.over) {
      if (state.winner === aiPlayer) return WIN - depth;
      if (state.winner === other(aiPlayer)) return LOSS + depth;
      return 0; // draw
    }

    const maximizing = player === aiPlayer;
    let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    let a = alpha;
    let b = beta;

    for (const move of availableMoves(current)) {
      current[move] = player;
      const score = recurse(current, other(player), depth + 1, a, b);
      current[move] = null;

      if (maximizing) {
        best = Math.max(best, score);
        a = Math.max(a, score);
      } else {
        best = Math.min(best, score);
        b = Math.min(b, score);
      }
      // [P6] Cutoff: this branch cannot change the final decision.
      if (useAlphaBeta && b <= a) {
        cutoffs++;
        break;
      }
    }
    return best;
  };

  const state = evaluateBoard(board);
  if (state.over) {
    return { move: null, score: 0, nodesEvaluated: 0, cutoffs: 0 };
  }

  let bestMove: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let alpha = Number.NEGATIVE_INFINITY;
  const beta = Number.POSITIVE_INFINITY;

  for (const move of availableMoves(board)) {
    const trial = [...board];
    trial[move] = aiPlayer;
    const score = recurse(trial, "X" === aiPlayer ? "O" : "X", 1, alpha, beta);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
  }

  return { move: bestMove, score: bestScore, nodesEvaluated, cutoffs };
}
