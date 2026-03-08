"""
Gomocup protocol engine wrapper.

Provides the GomocupEngine class to communicate with any Gomocup-compatible
AI engine (Yixin, Embryo, Piskvork engines, etc.) via stdin/stdout.
"""

import subprocess
import threading
import queue
import time
import os
from enum import IntEnum
from typing import Optional, Tuple, List


class Rule(IntEnum):
    """Gomoku rule variants."""
    FREESTYLE = 0       # No restrictions – 5 in a row wins
    STANDARD = 1        # Standard Renju (forbidden moves for Black)
    FREE_RENJU = 2      # Free Renju


class GameType(IntEnum):
    """Game type hint sent to the engine."""
    HUMAN_VS_HUMAN = 0
    HUMAN_VS_AI = 1
    AI_VS_AI = 2
    TOURNAMENT = 3


class Player(IntEnum):
    """Player identifiers used in the BOARD command."""
    OWN = 1             # Engine's own stones
    OPPONENT = 2        # Opponent's stones
    OWN_SWAP = 3        # Engine's stones placed via swap rule


class EngineError(Exception):
    """Raised when the engine returns an error or fails to respond."""
    pass


class GomocupEngine:
    """
    Communicates with a Gomocup-protocol compatible engine via stdin/stdout.

    Tested with: Yixin/Embryo engine, and compatible with any engine
    following the Gomocup (Piskvork) protocol specification.

    Attributes:
        engine_path:  Absolute path to the engine executable.
        working_dir:  Working directory for the engine process.
        board_size:   Current board size (set after start()).
        is_running:   Whether the engine process is alive.
    """

    def __init__(self, engine_path: str, working_dir: str = None):
        """
        Initialize the engine wrapper.

        Args:
            engine_path: Path to the engine executable (.exe).
            working_dir: Working directory for the engine process.
                         Defaults to the directory containing engine_path.
                         Must contain required data files (*.dat, config.c, etc.).
        """
        self.engine_path = os.path.abspath(engine_path)
        self.working_dir = working_dir or os.path.dirname(self.engine_path)
        self.board_size = 0

        self._proc: Optional[subprocess.Popen] = None
        self._queue: queue.Queue = queue.Queue()
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False
        self._debug_callback = None

    # ══════════════════════════════════════════════════════════════════
    #  LIFECYCLE
    # ══════════════════════════════════════════════════════════════════

    def start(self, board_size: int = 15) -> bool:
        """
        Launch the engine process and initialize the board.

        Args:
            board_size: Board dimension, range 10–22. Common values: 15, 19, 20.

        Returns:
            True if the engine responded with OK.

        Raises:
            FileNotFoundError: If engine_path does not exist.
            EngineError: If the engine fails to start.
        """
        if not os.path.isfile(self.engine_path):
            raise FileNotFoundError(f"Engine not found: {self.engine_path}")

        if self._proc and self._proc.poll() is None:
            self.stop()

        self._queue = queue.Queue()
        self._proc = subprocess.Popen(
            [self.engine_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=self.working_dir,
        )
        self._running = True
        self._reader_thread = threading.Thread(target=self._read_stdout, daemon=True)
        self._reader_thread.start()

        self._send(f"START {board_size}")
        ok = self._wait_ok()
        if ok:
            self.board_size = board_size
        return ok

    def stop(self):
        """Send the END command and terminate the engine process."""
        self._running = False
        if self._proc and self._proc.poll() is None:
            try:
                self._send("END")
                time.sleep(0.3)
                self._proc.terminate()
                self._proc.wait(timeout=3)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None

    def restart(self) -> bool:
        """
        Reset the board to empty without restarting the engine process.

        Returns:
            True if the engine responded with OK.
        """
        self._send("RESTART")
        return self._wait_ok()

    @property
    def is_running(self) -> bool:
        """True if the engine process is alive."""
        return self._proc is not None and self._proc.poll() is None

    # ══════════════════════════════════════════════════════════════════
    #  ENGINE INFO
    # ══════════════════════════════════════════════════════════════════

    def about(self) -> Optional[str]:
        """
        Get the engine identification string.

        Returns:
            String like: name="Embryo", version="1.0.5", author="...", country="CZ"
            or None on timeout.
        """
        self._send("ABOUT")
        return self._read_line(timeout=5)

    # ══════════════════════════════════════════════════════════════════
    #  CONFIGURATION
    # ══════════════════════════════════════════════════════════════════

    def configure(
        self,
        timeout_turn: int = 5000,
        timeout_match: int = 100000,
        max_depth: int = 100,
        max_node: int = 1_000_000_000,
        rule: int = Rule.FREESTYLE,
        game_type: int = GameType.HUMAN_VS_AI,
    ):
        """
        Configure engine search parameters.

        Args:
            timeout_turn:  Max thinking time per move in milliseconds.
            timeout_match: Max total game time in milliseconds.
            max_depth:     Max search depth in plies (half-moves).
            max_node:      Max number of nodes to search.
            rule:          Game rule variant (use Rule enum or int 0/1/2).
            game_type:     Game type hint (use GameType enum or int 0–3).

        Important:
            * Always set max_depth to a reasonable value (e.g. 5–20).
              The engine may IGNORE timeout_turn if max_depth is very large.
            * Lower max_depth = faster but weaker play.
            * Higher max_depth = stronger but may take very long.
        """
        self._send(f"INFO timeout_turn {timeout_turn}")
        self._send(f"INFO timeout_match {timeout_match}")
        self._send(f"INFO max_depth {max_depth}")
        self._send(f"INFO max_node {max_node}")
        self._send(f"INFO rule {int(rule)}")
        self._send(f"INFO game_type {int(game_type)}")

    def set_info(self, key: str, value) -> None:
        """
        Send a single INFO parameter to the engine.

        Args:
            key:   Parameter name (e.g. "timeout_turn", "max_depth").
            value: Parameter value.
        """
        self._send(f"INFO {key} {value}")

    # ══════════════════════════════════════════════════════════════════
    #  GAME PLAY
    # ══════════════════════════════════════════════════════════════════

    def begin(self, timeout: int = 30) -> Optional[Tuple[int, int]]:
        """
        Ask the engine to make the first move (as Black).

        Use this when the engine should play first on an empty board.

        Args:
            timeout: Max seconds to wait for the engine's response.

        Returns:
            (x, y) tuple of the engine's chosen move, or None on timeout.
        """
        self._send("BEGIN")
        return self._wait_move(timeout)

    def turn(self, x: int, y: int, timeout: int = 30) -> Optional[Tuple[int, int]]:
        """
        Send the opponent's move and wait for the engine's response.

        Args:
            x:       Column of the opponent's move (0-based).
            y:       Row of the opponent's move (0-based).
            timeout: Max seconds to wait for the engine's response.

        Returns:
            (x, y) tuple of the engine's response move, or None on timeout.
        """
        self._send(f"TURN {x},{y}")
        return self._wait_move(timeout)

    def board(
        self,
        moves: List[Tuple[int, int, int]],
        timeout: int = 30,
    ) -> Optional[Tuple[int, int]]:
        """
        Set the entire board position and get the engine's next move.

        This is an alternative to BEGIN + multiple TURNs.
        Useful when restoring a game position from history.

        Args:
            moves:   List of (x, y, player) tuples describing the board.
                     player values: 1 = engine's stones (OWN),
                                    2 = opponent's stones (OPPONENT),
                                    3 = engine's stones via swap (OWN_SWAP).
            timeout: Max seconds to wait.

        Returns:
            (x, y) tuple of the engine's move, or None on timeout.

        Example:
            # Black(engine) at (7,7), White(opponent) at (8,8)
            move = engine.board([(7, 7, Player.OWN), (8, 8, Player.OPPONENT)])
        """
        self._send("BOARD")
        for x, y, player in moves:
            self._send(f"{x},{y},{int(player)}")
        self._send("DONE")
        return self._wait_move(timeout)

    # ══════════════════════════════════════════════════════════════════
    #  DEBUG CALLBACK
    # ══════════════════════════════════════════════════════════════════

    def on_debug(self, callback):
        """
        Register a callback for DEBUG/MESSAGE lines from the engine.

        Args:
            callback: Function(line: str) called for each DEBUG/MESSAGE line.
                      Set to None to disable.
        """
        self._debug_callback = callback

    # ══════════════════════════════════════════════════════════════════
    #  CONTEXT MANAGER
    # ══════════════════════════════════════════════════════════════════

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
        return False

    # ══════════════════════════════════════════════════════════════════
    #  INTERNAL METHODS
    # ══════════════════════════════════════════════════════════════════

    def _send(self, cmd: str):
        """Send a command line to the engine via stdin."""
        if not self._proc or self._proc.poll() is not None:
            raise EngineError("Engine process is not running")
        self._proc.stdin.write((cmd + "\r\n").encode("ascii"))
        self._proc.stdin.flush()

    def _read_stdout(self):
        """Background thread: continuously reads lines from engine stdout."""
        while self._running:
            try:
                line = self._proc.stdout.readline()
                if not line:
                    break
                decoded = line.decode("ascii", errors="replace").rstrip()
                if self._debug_callback and (
                    decoded.startswith("DEBUG") or decoded.startswith("MESSAGE")
                ):
                    self._debug_callback(decoded)
                self._queue.put(decoded)
            except Exception:
                break

    def _read_line(self, timeout: float = 5) -> Optional[str]:
        """Read the next non-DEBUG line from output."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                line = self._queue.get(timeout=0.5)
                if not line.startswith("DEBUG"):
                    return line
            except queue.Empty:
                continue
        return None

    def _wait_ok(self, timeout: float = 5) -> bool:
        """Wait for the engine to respond with 'OK'."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                line = self._queue.get(timeout=0.5)
                if line == "OK":
                    return True
                if line.startswith("ERROR"):
                    raise EngineError(f"Engine error: {line}")
            except queue.Empty:
                continue
        return False

    def _wait_move(self, timeout: float = 30) -> Optional[Tuple[int, int]]:
        """
        Wait until the engine outputs a move in 'x,y' format.
        Skips DEBUG, MESSAGE, and OK lines.

        Returns:
            (x, y) tuple or None on timeout.
        """
        start = time.time()
        while time.time() - start < timeout:
            try:
                line = self._queue.get(timeout=1)
                if line.startswith("DEBUG") or line.startswith("MESSAGE") or line == "OK":
                    continue
                parts = line.split(",")
                if len(parts) == 2:
                    try:
                        return (int(parts[0].strip()), int(parts[1].strip()))
                    except ValueError:
                        pass
            except queue.Empty:
                continue
        return None
