# gomocup-engine (Node.js)

A Node.js module for integrating Gomoku/Renju AI engines (Rapfi or any Gomocup-compatible engine) into your applications.

> **Note:** This module is a **wrapper only** — it does NOT include the engine binary.
> Place Rapfi (or another Gomocup-compatible engine) in the `engine/` folder.
> The engine executable must reside alongside its data files (`config.toml`, `*.bin`, `*.bin.lz4`).

## Installation

### Option 1: Copy directly
Copy the `nodejs/` folder into your project, then require:

```js
const { GomocupEngine } = require('./path/to/gomocup-engine/src/gomocup-engine');
```

### Option 2: Install via npm (local)
```bash
cd path/to/nodejs
npm link
# Then in your project:
npm link gomocup-engine
```

---

## Quick Start

```js
const { GomocupEngine } = require('gomocup-engine');

async function main() {
  const engine = new GomocupEngine('engine/pbrain-rapfi-windows-sse.exe');
  await engine.start(15);
  engine.configure({ timeoutTurn: 2000, maxDepth: 10, rule: 0 });

  // Engine plays first (as Black)
  let move = await engine.begin();       // → { x: 7, y: 7 }

  // You play at (8,8), engine responds
  move = await engine.turn(8, 8);        // → { x: 6, y: 7 }

  // Continue until game ends...
  move = await engine.turn(5, 5);        // → { x, y }

  await engine.stop();
}

main().catch(console.error);
```

---

## API Reference

### `new GomocupEngine(enginePath, workingDir?)`

Create a new engine wrapper instance.

| Parameter | Description |
|---|---|
| `enginePath` | Path to the engine executable. |
| `workingDir` | Working directory for the engine process. Defaults to the directory containing the executable. |

### Lifecycle

| Method | Description | Returns |
|---|---|---|
| `start(boardSize?)` | Launch engine and initialize the board (size: 10–22, default 15). | `Promise<boolean>` |
| `stop()` | Send END command and terminate the engine process. | `Promise<void>` |
| `restart()` | Reset the board without restarting the process. | `Promise<boolean>` |
| `about()` | Get engine identification string. | `Promise<string\|null>` |
| `isRunning` | Whether the engine process is alive. | `boolean` (getter) |

### Configuration

```js
engine.configure({
  timeoutTurn: 2000,         // Max time per move (ms)
  timeoutMatch: 100000,      // Max total game time (ms)
  maxDepth: 10,              // Max search depth (plies)
  maxNode: 1_000_000_000,    // Max nodes to search
  rule: 0,                   // 0=freestyle, 1=standard renju, 2=free renju
  gameType: 1,               // 0=human-human, 1=human-AI, 2=AI-AI
});
```

Or set individual parameters:
```js
engine.setInfo('timeout_turn', 3000);
engine.setInfo('max_depth', 15);
```

> **Warning:** Always set `maxDepth` to a reasonable value (5–20).
> The engine may **ignore `timeoutTurn`** if `maxDepth` is too large.

### Game Play

#### Method 1: `begin()` + `turn()` (move by move)

```js
let move = await engine.begin();         // → { x: 7, y: 7 }
move = await engine.turn(8, 8);          // → { x: 6, y: 7 }
move = await engine.turn(5, 5);          // → { x, y }
```

#### Method 2: `board()` (set full position)

```js
const { Player } = require('gomocup-engine');

const move = await engine.board([
  { x: 7, y: 7, player: Player.OWN },
  { x: 8, y: 8, player: Player.OPPONENT },
  { x: 6, y: 7, player: Player.OWN },
]);
```

### Debug Callback

```js
engine.onDebug((line) => console.log(`[ENGINE] ${line}`));
```

---

## Constants

```js
const { Rule, GameType, Player } = require('gomocup-engine');

Rule.FREESTYLE    // 0
Rule.STANDARD     // 1
Rule.FREE_RENJU   // 2

GameType.HUMAN_VS_HUMAN  // 0
GameType.HUMAN_VS_AI     // 1
GameType.AI_VS_AI        // 2
GameType.TOURNAMENT      // 3

Player.OWN        // 1 — Engine's stones
Player.OPPONENT   // 2 — Opponent's stones
Player.OWN_SWAP   // 3 — Engine's stones via swap
```

---

## Integration Examples

### Console App

See `examples/play-console.js` for a complete interactive console game.

### Express / Web API

```js
const express = require('express');
const { GomocupEngine } = require('gomocup-engine');

const app = express();
app.use(express.json());

const engine = new GomocupEngine('engine/pbrain-rapfi-windows-sse.exe');

(async () => {
  await engine.start(15);
  engine.configure({ maxDepth: 8 });

  app.post('/move', async (req, res) => {
    const { x, y } = req.body;
    const move = await engine.turn(x, y, 10000);
    if (move) {
      res.json({ engine_x: move.x, engine_y: move.y });
    } else {
      res.json({ error: 'timeout' });
    }
  });

  app.listen(3000, () => console.log('Server on port 3000'));
})();
```

---

## Important Notes

1. **Always set `maxDepth`** — The engine may ignore `timeoutTurn` when `maxDepth` is very large.
2. **Engine blocks while thinking** — Do not send commands while the engine is computing. Wait for the move response before sending the next command.
3. **Working directory** — The engine executable must be in a directory containing its data files (`config.toml`, `*.bin`, `*.bin.lz4`).
4. **Node.js >= 14** — Uses `child_process.spawn`, `readline`, and modern JS features.
5. **Platform** — Use the appropriate binary for your OS (Windows `.exe`, Linux, or macOS).
6. **Engine included** — Rapfi binaries for all platforms are in the `engine/` folder.

---

## Module Structure

```
nodejs/
├── src/
│   └── gomocup-engine.js   # Core engine wrapper
├── examples/
│   └── play-console.js      # Interactive console game example
├── package.json
└── README.md                # This file
```

## License

MIT. The Yixin/Embryo engine is copyrighted by its author and licensed for non-commercial use only.
