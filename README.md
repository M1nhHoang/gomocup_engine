# gomocup_engine

A cross-platform wrapper for Gomocup-protocol Gomoku/Renju AI engines (Yixin, Embryo, etc.).

Available in **Python** and **Node.js**.

> **Note:** This module is a wrapper only — it does NOT include the engine binary.
> You must provide your own `engine.exe` (placed in this directory alongside `*.dat` and `config.c`).

## Project Structure

```
gomocup_engine/
├── engine.exe               # Your Gomocup-compatible engine binary (not included)
├── python/                  # Python wrapper
│   ├── gomocup_engine/
│   │   ├── __init__.py
│   │   ├── engine.py        # Core wrapper class
│   │   └── examples/
│   │       └── play_console.py
│   ├── setup.py
│   ├── pyproject.toml
│   └── README.md
└── nodejs/                  # Node.js wrapper
    ├── src/
    │   └── gomocup-engine.js  # Core wrapper class
    ├── examples/
    │   └── play-console.js
    ├── package.json
    └── README.md
```

## Quick Start

### Python

```python
from gomocup_engine import GomocupEngine

with GomocupEngine("path/to/engine.exe") as engine:
    engine.start(15)
    engine.configure(timeout_turn=2000, max_depth=10)
    move = engine.begin()        # Engine plays first
    move = engine.turn(8, 8)     # You play, engine responds
```

See [python/README.md](python/README.md) for full documentation.

### Node.js

```js
const { GomocupEngine } = require('./nodejs/src/gomocup-engine');

const engine = new GomocupEngine('path/to/engine.exe');
await engine.start(15);
engine.configure({ timeoutTurn: 2000, maxDepth: 10 });
let move = await engine.begin();     // Engine plays first
move = await engine.turn(8, 8);      // You play, engine responds
await engine.stop();
```

See [nodejs/README.md](nodejs/README.md) for full documentation.

## Important Notes

1. **Always set `max_depth` / `maxDepth`** to a reasonable value (5–20). The engine may ignore timeout settings if depth is too large.
2. **Do not send commands while the engine is thinking.** Wait for the move response first.
3. **Engine `.exe` files only run on Windows.** On Linux/Mac, use Wine.
4. **Engine not included.** You must supply your own Gomocup-compatible engine binary.

## License

This wrapper module is released under the MIT license.
The Yixin/Embryo engine is copyrighted by its author and licensed for non-commercial use only.
