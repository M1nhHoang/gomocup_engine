"""
gomocup_engine — Python wrapper for Gomocup-protocol AI engines.

Quick start:
    from gomocup_engine import GomocupEngine

    engine = GomocupEngine("path/to/engine.exe")
    engine.start(board_size=15)
    engine.configure(timeout_turn=2000, max_depth=10)

    move = engine.begin()        # Engine plays first
    move = engine.turn(8, 8)     # You play, engine responds
    engine.stop()
"""

from .engine import GomocupEngine, EngineError, Rule, GameType, Player

__all__ = [
    "GomocupEngine",
    "EngineError",
    "Rule",
    "GameType",
    "Player",
]

__version__ = "1.0.0"
