# gomocup_engine

A cross-platform wrapper for Gomocup-protocol Gomoku/Renju AI engines, bundled with the **[Rapfi](https://github.com/dhbloo/rapern-gomoku)** engine — one of the strongest open-source Gomoku/Renju engines.

Available in **Python** and **Node.js**.

## Project Structure

```
gomocup_engine/
├── engine/                    # Rapfi engine binaries (all platforms)
│   ├── pbrain-rapfi-windows-sse.exe
│   ├── pbrain-rapfi-linux-clang-sse
│   ├── pbrain-rapfi-macos-apple-silicon
│   ├── config.toml            # Engine configuration
│   ├── model210901.bin         # Neural network weights
│   └── mix9svq*.bin.lz4       # NNUE model files
├── python/                    # Python wrapper
│   ├── gomocup_engine/
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   └── examples/
│   │       └── play_console.py
│   ├── setup.py
│   ├── pyproject.toml
│   └── README.md
└── nodejs/                    # Node.js wrapper
    ├── src/
    │   └── gomocup-engine.js
    ├── examples/
    │   └── play-console.js
    ├── package.json
    └── README.md
```

## Gomoku Rules

Gomoku is played on a 15×15 board. Two players alternate placing stones — **Black** goes first. The goal is to get **5 or more stones in a row** (horizontally, vertically, or diagonally).

### Rule Variants (Gomocup `rule` parameter)

| Value | Name | Description |
|-------|------|-------------|
| `0` | **Freestyle** | No restrictions. First player to get 5+ in a row wins. Overlines (6+) also count as a win. |
| `1` | **Standard Renju** | Black has **forbidden moves**: double-three, double-four, and overline (6+). White has no restrictions. This makes the game more balanced. |
| `2` | **Free Renju** | A variant of Renju with relaxed restrictions. |
| `4` | **Caro (Vietnamese rules)** | Exactly 5 in a row wins. If both ends are blocked, it does NOT count. Overlines (6+) do not win. |

### First-Mover Advantage

In **Freestyle Gomoku** (rule=0), **Black has a mathematically proven forced win** on a 15×15 board — meaning with perfect play, Black always wins regardless of White's responses. In practice, engines playing Black win the vast majority of games.

To address this imbalance, competitive Gomoku uses:

- **Standard Renju** (rule=1): Black's forbidden moves restrict opening strategies.
- **Swap rule**: After Black's first move, White can choose to swap colors.
- **Swap2 rule**: After 3 opening stones, the opponent can: (a) play as White, (b) swap and play as Black, or (c) place 2 more stones and let the first player choose color.

### Recommendation

- Use **rule=0** (Freestyle) for casual play or AI vs AI testing.
- Use **rule=1** (Standard Renju) for balanced competitive play.
- Use **rule=4** (Caro) for Vietnamese-style Gomoku.

## Quick Start

### Python

```python
from gomocup_engine import GomocupEngine

with GomocupEngine("engine/pbrain-rapfi-windows-sse.exe") as engine:
    engine.start(15)
    engine.configure(timeout_turn=2000, max_depth=10)
    move = engine.begin()        # Engine plays first
    move = engine.turn(8, 8)     # You play, engine responds
```

See [python/README.md](python/README.md) for full documentation.

### Node.js

```js
const { GomocupEngine } = require('./nodejs/src/gomocup-engine');

const engine = new GomocupEngine('engine/pbrain-rapfi-windows-sse.exe');
await engine.start(15);
engine.configure({ timeoutTurn: 2000, maxDepth: 10 });
let move = await engine.begin();     // Engine plays first
move = await engine.turn(8, 8);      // You play, engine responds
await engine.stop();
```

See [nodejs/README.md](nodejs/README.md) for full documentation.

## Engine Binaries

The `engine/` folder contains pre-built Rapfi binaries for all platforms:

| Platform | Binary | Instruction Set |
|----------|--------|-----------------|
| Windows | `pbrain-rapfi-windows-sse.exe` | SSE (most compatible) |
| Windows | `pbrain-rapfi-windows-avx2.exe` | AVX2 (faster, modern CPUs) |
| Linux | `pbrain-rapfi-linux-clang-sse` | SSE (most compatible) |
| Linux | `pbrain-rapfi-linux-clang-avx2` | AVX2 (faster, modern CPUs) |
| macOS | `pbrain-rapfi-macos-apple-silicon` | Apple Silicon (M1/M2/M3) |

Use the **SSE** variant for maximum compatibility, or **AVX2** for better performance on modern CPUs (2013+).

## Important Notes

1. **Always set `max_depth` / `maxDepth`** to a reasonable value (5–20). The engine may ignore timeout settings if depth is too large.
2. **Do not send commands while the engine is thinking.** Wait for the move response first.
3. **Choose the right binary for your platform.** Windows uses `.exe`, Linux/macOS use the platform-specific binaries directly.
4. **Engine data files** (`config.toml`, `*.bin`, `*.bin.lz4`) must be in the same directory as the engine binary.

## License

This wrapper module is released under the MIT license.
The Rapfi engine is licensed under the [GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.html).
