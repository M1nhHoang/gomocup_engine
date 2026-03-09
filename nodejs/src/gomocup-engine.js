/**
 * Gomocup protocol engine wrapper for Node.js.
 *
 * Provides the GomocupEngine class to communicate with any Gomocup-compatible
 * AI engine (Yixin, Embryo, Piskvork engines, etc.) via stdin/stdout.
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const readline = require('readline');

/** Gomoku rule variants. */
const Rule = Object.freeze({
  FREESTYLE: 0,    // No restrictions – 5 in a row wins
  STANDARD: 1,     // Standard Renju (forbidden moves for Black)
  FREE_RENJU: 2,   // Free Renju
});

/** Game type hint sent to the engine. */
const GameType = Object.freeze({
  HUMAN_VS_HUMAN: 0,
  HUMAN_VS_AI: 1,
  AI_VS_AI: 2,
  TOURNAMENT: 3,
});

/** Player identifiers used in the BOARD command. */
const Player = Object.freeze({
  OWN: 1,          // Engine's own stones
  OPPONENT: 2,     // Opponent's stones
  OWN_SWAP: 3,     // Engine's stones placed via swap rule
});

class EngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EngineError';
  }
}

/**
 * Communicates with a Gomocup-protocol compatible engine via stdin/stdout.
 *
 * Tested with: Yixin/Embryo engine, and compatible with any engine
 * following the Gomocup (Piskvork) protocol specification.
 */
class GomocupEngine extends EventEmitter {
  /**
   * Initialize the engine wrapper.
   *
   * @param {string} enginePath - Path to the engine executable (.exe).
   * @param {string} [workingDir] - Working directory for the engine process.
   *   Defaults to the directory containing enginePath.
   *   Must contain required data files (*.dat, config.c, etc.).
   */
  constructor(enginePath, workingDir) {
    super();
    this.enginePath = path.resolve(enginePath);
    this.workingDir = workingDir || path.dirname(this.enginePath);
    this.boardSize = 0;

    this._proc = null;
    this._rl = null;
    this._lineQueue = [];
    this._lineResolvers = [];
    this._running = false;
    this._debugCallback = null;
  }

  // ══════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  /**
   * Launch the engine process and initialize the board.
   *
   * @param {number} [boardSize=15] - Board dimension, range 10–22. Common: 15, 19, 20.
   * @returns {Promise<boolean>} True if the engine responded with OK.
   * @throws {Error} If engine file does not exist.
   * @throws {EngineError} If the engine fails to start.
   */
  async start(boardSize = 15) {
    if (!fs.existsSync(this.enginePath)) {
      throw new Error(`Engine not found: ${this.enginePath}`);
    }

    if (this._proc) {
      await this.stop();
    }

    this._lineQueue = [];
    this._lineResolvers = [];

    this._proc = spawn(this.enginePath, [], {
      cwd: this.workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this._running = true;

    this._rl = readline.createInterface({ input: this._proc.stdout });
    this._rl.on('line', (line) => this._onLine(line));

    this._proc.on('exit', () => {
      this._running = false;
    });

    this._proc.on('error', (err) => {
      this._running = false;
      this.emit('error', err);
    });

    this._send(`START ${boardSize}`);
    const ok = await this._waitOk();
    if (ok) {
      this.boardSize = boardSize;
    }
    return ok;
  }

  /**
   * Send the END command and terminate the engine process.
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    if (this._proc) {
      try {
        this._send('END');
      } catch (_) {}

      await new Promise((resolve) => {
        const proc = this._proc;
        const timer = setTimeout(() => {
          try { proc.kill(); } catch (_) {}
          resolve();
        }, 3000);

        proc.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });

        setTimeout(() => {
          try { proc.kill('SIGTERM'); } catch (_) {}
        }, 300);
      });

      if (this._rl) {
        this._rl.close();
        this._rl = null;
      }
      this._proc = null;
    }
  }

  /**
   * Reset the board to empty without restarting the engine process.
   * @returns {Promise<boolean>} True if the engine responded with OK.
   */
  async restart() {
    this._send('RESTART');
    return this._waitOk();
  }

  /**
   * Whether the engine process is alive.
   * @returns {boolean}
   */
  get isRunning() {
    return this._proc !== null && this._running;
  }

  // ══════════════════════════════════════════════════════════════════
  //  ENGINE INFO
  // ══════════════════════════════════════════════════════════════════

  /**
   * Get the engine identification string.
   * @returns {Promise<string|null>} e.g. name="Embryo", version="1.0.5", ...
   */
  async about() {
    this._send('ABOUT');
    return this._readLine(5000);
  }

  // ══════════════════════════════════════════════════════════════════
  //  CONFIGURATION
  // ══════════════════════════════════════════════════════════════════

  /**
   * Configure engine search parameters.
   *
   * IMPORTANT: Always set maxDepth to a reasonable value (e.g. 5–20).
   * The engine may IGNORE timeoutTurn if maxDepth is very large.
   *
   * @param {Object} [options]
   * @param {number} [options.timeoutTurn=5000]  - Max thinking time per move (ms).
   * @param {number} [options.timeoutMatch=100000] - Max total game time (ms).
   * @param {number} [options.maxDepth=100] - Max search depth in plies.
   * @param {number} [options.maxNode=1000000000] - Max nodes to search.
   * @param {number} [options.rule=0] - Game rule (0=freestyle, 1=standard, 2=free renju).
   * @param {number} [options.gameType=1] - Game type (0–3).
   */
  configure({
    timeoutTurn = 5000,
    timeoutMatch = 100000,
    maxDepth = 100,
    maxNode = 1_000_000_000,
    rule = Rule.FREESTYLE,
    gameType = GameType.HUMAN_VS_AI,
  } = {}) {
    this._send(`INFO timeout_turn ${timeoutTurn}`);
    this._send(`INFO timeout_match ${timeoutMatch}`);
    this._send(`INFO max_depth ${maxDepth}`);
    this._send(`INFO max_node ${maxNode}`);
    this._send(`INFO rule ${rule}`);
    this._send(`INFO game_type ${gameType}`);
  }

  /**
   * Send a single INFO parameter to the engine.
   * @param {string} key - Parameter name (e.g. "timeout_turn", "max_depth").
   * @param {*} value - Parameter value.
   */
  setInfo(key, value) {
    this._send(`INFO ${key} ${value}`);
  }

  // ══════════════════════════════════════════════════════════════════
  //  GAME PLAY
  // ══════════════════════════════════════════════════════════════════

  /**
   * Ask the engine to make the first move (as Black).
   *
   * @param {number} [timeout=30000] - Max ms to wait for the engine's response.
   * @returns {Promise<{x: number, y: number}|null>} The engine's move, or null on timeout.
   */
  async begin(timeout = 30000) {
    this._send('BEGIN');
    return this._waitMove(timeout);
  }

  /**
   * Send the opponent's move and wait for the engine's response.
   *
   * @param {number} x - Column of the opponent's move (0-based).
   * @param {number} y - Row of the opponent's move (0-based).
   * @param {number} [timeout=30000] - Max ms to wait.
   * @returns {Promise<{x: number, y: number}|null>} The engine's response move, or null.
   */
  async turn(x, y, timeout = 30000) {
    this._send(`TURN ${x},${y}`);
    return this._waitMove(timeout);
  }

  /**
   * Set the entire board position and get the engine's next move.
   *
   * @param {Array<{x: number, y: number, player: number}>} moves
   *   Array of moves. player values: 1=OWN, 2=OPPONENT, 3=OWN_SWAP.
   * @param {number} [timeout=30000] - Max ms to wait.
   * @returns {Promise<{x: number, y: number}|null>} The engine's move, or null.
   *
   * @example
   * const move = await engine.board([
   *   { x: 7, y: 7, player: Player.OWN },
   *   { x: 8, y: 8, player: Player.OPPONENT },
   * ]);
   */
  async board(moves, timeout = 30000) {
    this._send('BOARD');
    for (const { x, y, player } of moves) {
      this._send(`${x},${y},${player}`);
    }
    this._send('DONE');
    return this._waitMove(timeout);
  }

  // ══════════════════════════════════════════════════════════════════
  //  DEBUG CALLBACK
  // ══════════════════════════════════════════════════════════════════

  /**
   * Register a callback for DEBUG/MESSAGE lines from the engine.
   * @param {Function|null} callback - Function(line) called for each debug line.
   */
  onDebug(callback) {
    this._debugCallback = callback;
  }

  // ══════════════════════════════════════════════════════════════════
  //  INTERNAL METHODS
  // ══════════════════════════════════════════════════════════════════

  /** @private Send a command line to the engine via stdin. */
  _send(cmd) {
    if (!this._proc || !this._running) {
      throw new EngineError('Engine process is not running');
    }
    this._proc.stdin.write(cmd + '\r\n');
  }

  /** @private Called for each line from engine stdout. */
  _onLine(rawLine) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) return;

    if (this._debugCallback && (line.startsWith('DEBUG') || line.startsWith('MESSAGE'))) {
      this._debugCallback(line);
    }

    // If someone is waiting for a line, resolve immediately
    if (this._lineResolvers.length > 0) {
      const resolver = this._lineResolvers.shift();
      resolver(line);
    } else {
      this._lineQueue.push(line);
    }
  }

  /**
   * @private Read the next non-DEBUG line from the output queue.
   * @param {number} timeout - Timeout in milliseconds.
   * @returns {Promise<string|null>}
   */
  _readLine(timeout = 5000) {
    return new Promise((resolve) => {
      // Check queue for a non-DEBUG line first
      while (this._lineQueue.length > 0) {
        const line = this._lineQueue.shift();
        if (!line.startsWith('DEBUG')) {
          resolve(line);
          return;
        }
      }

      const timer = setTimeout(() => {
        // Remove this resolver from the queue
        const idx = this._lineResolvers.indexOf(innerResolve);
        if (idx !== -1) this._lineResolvers.splice(idx, 1);
        resolve(null);
      }, timeout);

      const innerResolve = (line) => {
        if (line.startsWith('DEBUG')) {
          // Re-queue and wait for the next non-debug line
          if (this._lineResolvers.length === 0) {
            this._lineResolvers.push(innerResolve);
          }
          return;
        }
        clearTimeout(timer);
        resolve(line);
      };

      this._lineResolvers.push(innerResolve);
    });
  }

  /**
   * @private Wait for the engine to respond with 'OK'.
   * @param {number} [timeout=5000]
   * @returns {Promise<boolean>}
   */
  async _waitOk(timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const remaining = timeout - (Date.now() - start);
      if (remaining <= 0) break;
      const line = await this._readLine(remaining);
      if (line === null) return false;
      if (line === 'OK') return true;
      if (line.startsWith('ERROR')) {
        throw new EngineError(`Engine error: ${line}`);
      }
    }
    return false;
  }

  /**
   * @private Wait until the engine outputs a move in 'x,y' format.
   * @param {number} [timeout=30000]
   * @returns {Promise<{x: number, y: number}|null>}
   */
  async _waitMove(timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const remaining = timeout - (Date.now() - start);
      if (remaining <= 0) break;
      const line = await this._readLine(remaining);
      if (line === null) return null;
      if (line.startsWith('DEBUG') || line.startsWith('MESSAGE') || line === 'OK') {
        continue;
      }
      const parts = line.split(',');
      if (parts.length === 2) {
        const x = parseInt(parts[0].trim(), 10);
        const y = parseInt(parts[1].trim(), 10);
        if (!isNaN(x) && !isNaN(y)) {
          return { x, y };
        }
      }
    }
    return null;
  }
}

module.exports = {
  GomocupEngine,
  EngineError,
  Rule,
  GameType,
  Player,
};
