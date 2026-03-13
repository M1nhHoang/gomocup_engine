# gomocup_engine

A Python module for integrating Gomoku/Renju AI engines (Rapfi or any Gomocup-compatible engine) into your applications.

> **Note:** This module is a **wrapper only** — it does NOT include the engine binary.
> Place Rapfi (or another Gomocup-compatible engine) in the `engine/` folder.
> The engine executable must reside alongside its data files (`config.toml`, `*.bin`, `*.bin.lz4`).

## Installation

### Option 1: Copy directly
Copy the `gomocup_engine/` folder into your project, then import:

```python
from gomocup_engine import GomocupEngine
```

### Option 2: Install via pip (local)
```bash
cd path/to/folder-containing-gomocup_engine
pip install .
```

After installation, you can import from anywhere:

```python
from gomocup_engine import GomocupEngine
```

---

## Quick Start

```python
from gomocup_engine import GomocupEngine

# Initialize — provide the path to your engine executable
engine = GomocupEngine("engine/pbrain-rapfi-windows-sse.exe")
engine.start(board_size=15)
engine.configure(timeout_turn=2000, max_depth=10, rule=0)

# Engine plays first (as Black)
move = engine.begin()              # → (7, 7)

# You play at (8,8), engine responds with its move
move = engine.turn(8, 8)           # → (6, 7)

# Continue until game ends...
move = engine.turn(5, 5)           # → (x, y)

# Clean up
engine.stop()
```

---

## API Reference

### `GomocupEngine(engine_path, working_dir=None)`

Create a new engine wrapper instance.

| Parameter | Description |
|---|---|
| `engine_path` | Path to the engine executable. |
| `working_dir` | Working directory for the engine process. Defaults to the directory containing the executable. Must contain data files (`config.toml`, `*.bin`, `*.bin.lz4`). |

### Lifecycle

| Method | Description | Returns |
|---|---|---|
| `start(board_size=15)` | Launch engine and initialize the board (size: 10–22). | `True` if OK |
| `stop()` | Send END command and terminate the engine process. | – |
| `restart()` | Reset the board without restarting the process. | `True` if OK |
| `about()` | Get engine identification string. | `str` |
| `is_running` | Whether the engine process is alive. | `bool` |

### Configuration

```python
engine.configure(
    timeout_turn=2000,       # Max time per move (ms)
    timeout_match=100000,    # Max total game time (ms)
    max_depth=10,            # Max search depth (plies)
    max_node=1_000_000_000,  # Max nodes to search
    rule=0,                  # 0=freestyle, 1=standard renju, 2=free renju
    game_type=1,             # 0=human-human, 1=human-AI, 2=AI-AI
)
```

Or set individual parameters:
```python
engine.set_info("timeout_turn", 3000)
engine.set_info("max_depth", 15)
```

> **Warning:** Always set `max_depth` to a reasonable value (5–20).
> The engine may **ignore `timeout_turn`** if `max_depth` is too large, causing extremely long computation times.

### Game Play

#### Method 1: `begin()` + `turn()` (move by move)

```python
# Engine makes the first move
move = engine.begin()            # → (7, 7)

# You play, engine responds
move = engine.turn(8, 8)         # → (6, 7)
move = engine.turn(5, 5)         # → (x, y)
```

#### Method 2: `board()` (set full position)

Useful when restoring a game from history or loading a saved state.

```python
from gomocup_engine import Player

# Set position: Black at (7,7) and (6,7), White at (8,8)
move = engine.board([
    (7, 7, Player.OWN),        # Engine's stones (Black)
    (8, 8, Player.OPPONENT),   # Opponent's stones (White)
    (6, 7, Player.OWN),        # Engine's stones (Black)
])
# Engine responds with its next move
```

### Context Manager

```python
with GomocupEngine("engine/pbrain-rapfi-windows-sse.exe") as engine:
    engine.start(15)
    engine.configure(max_depth=8)
    move = engine.begin()
    # ... play game ...
# engine.stop() is called automatically
```

### Debug Callback

Receive DEBUG/MESSAGE output from the engine:

```python
engine.on_debug(lambda line: print(f"[ENGINE] {line}"))
```

---

## Integration Examples

### Example 1: Console App

See `examples/play_console.py` for a complete interactive console game.

### Example 2: GUI App (Pygame, Tkinter, etc.)

```python
import threading
from gomocup_engine import GomocupEngine

class GomokuGame:
    def __init__(self):
        self.engine = GomocupEngine("engine/pbrain-rapfi-windows-sse.exe")
        self.engine.start(15)
        self.engine.configure(timeout_turn=2000, max_depth=10)
    
    def on_player_click(self, x, y):
        """Called when the player clicks on cell (x, y)."""
        # Run in a separate thread to avoid blocking the UI
        def think():
            move = self.engine.turn(x, y, timeout=30)
            if move:
                self.place_stone(move[0], move[1], "black")
        
        threading.Thread(target=think, daemon=True).start()
    
    def on_close(self):
        self.engine.stop()
```

### Example 3: Web API (Flask / FastAPI)

```python
from fastapi import FastAPI
from gomocup_engine import GomocupEngine

app = FastAPI()
engine = GomocupEngine("engine/pbrain-rapfi-windows-sse.exe")
engine.start(15)
engine.configure(max_depth=8)

@app.post("/move")
def make_move(x: int, y: int):
    move = engine.turn(x, y, timeout=10)
    if move:
        return {"engine_x": move[0], "engine_y": move[1]}
    return {"error": "timeout"}
```

---

## Coordinate System

```
     0  1  2  3  4  ... 14
  0  .  .  .  .  .      .
  1  .  .  .  .  .      .
  2  .  .  .  .  .      .
  3  .  .  .  .  .      .
  ...
 14  .  .  .  .  .      .
```

- **x** = column, **y** = row
- **0-based** indexing
- Center of a 15×15 board: **(7, 7)**

---

## Important Notes

1. **Always set `max_depth`** — The engine may ignore `timeout_turn` when `max_depth` is very large, leading to extremely long response times.

2. **Engine blocks while thinking** — Do not send commands while the engine is computing. Wait for the move response before sending the next command. To cancel, you can only kill the process.

3. **Working directory** — The engine executable must be in a directory containing its data files:
   - `base.dat`, `book*.dat` — Search data & opening book
   - `config.c` — Engine configuration

4. **Thread safety** — Each `GomocupEngine` instance runs a separate process. Use multiple instances for parallel games.

5. **Platform** — Engine `.exe` files only run on Windows. On Linux/Mac, use Wine or a natively compiled engine.

6. **Engine not included** — This module does **not** bundle any engine binary. You must supply your own Gomocup-compatible engine (e.g., Yixin/Embryo `engine.exe`).

---

## Module Structure

```
gomocup_engine/
├── __init__.py          # Exports: GomocupEngine, EngineError, Rule, GameType, Player
├── engine.py            # Core engine wrapper class
├── examples/
│   └── play_console.py  # Interactive console game example
├── README.md            # This file
├── setup.py             # pip install support
└── pyproject.toml       # Build metadata
```

## License

This wrapper module is released under the MIT license.
The Yixin/Embryo engine is copyrighted by its author (Kai Sun) and is licensed for non-commercial use only.
