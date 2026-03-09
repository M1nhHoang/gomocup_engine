"""
Example: Play Gomoku in the console against the Yixin/Embryo engine.

Usage:
    python play_console.py

Requirements:
    - engine.exe must be in the expected path or set ENGINE_PATH below.
"""

import os
import sys

# Add parent directory to path so the module can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gomocup_engine import GomocupEngine


def main():
    # ── Configuration ─────────────────────────────────────────
    BOARD_SIZE = 15
    ENGINE_PATH = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",  # Up one level from examples/
        "..",  # Up one level from gomocup_engine/
        "..",  # Up one level from python/
        "engine.exe",
    )

    # Or specify the path directly:
    # ENGINE_PATH = r"C:\path\to\engine.exe"

    if not os.path.isfile(ENGINE_PATH):
        print(f"Engine not found at: {ENGINE_PATH}")
        print("Please update ENGINE_PATH in this file.")
        return

    # ── Initialize ────────────────────────────────────────────
    with GomocupEngine(ENGINE_PATH) as engine:
        engine.start(BOARD_SIZE)

        info = engine.about()
        print(f"Engine: {info}\n")

        engine.configure(
            timeout_turn=3000,  # 3 seconds per move
            max_depth=10,       # Search depth 10
            rule=0,             # Freestyle
        )

        # ── Initialize board ──────────────────────────────────
        board = [["." for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        BLACK = "X"  # Engine
        WHITE = "O"  # Player

        def show_board():
            print()
            print("    " + "  ".join(f"{i:2d}" for i in range(BOARD_SIZE)))
            print("    " + "─" * (BOARD_SIZE * 4 - 1))
            for r in range(BOARD_SIZE):
                print(f" {r:2d}│ " + "   ".join(board[r]))
            print()

        def check_winner(bx, by, symbol):
            """Simple win check (5 in a row)."""
            directions = [(1, 0), (0, 1), (1, 1), (1, -1)]
            for dx, dy in directions:
                count = 1
                for sign in [1, -1]:
                    nx, ny = bx + dx * sign, by + dy * sign
                    while (
                        0 <= nx < BOARD_SIZE
                        and 0 <= ny < BOARD_SIZE
                        and board[ny][nx] == symbol
                    ):
                        count += 1
                        nx += dx * sign
                        ny += dy * sign
                if count >= 5:
                    return True
            return False

        # ── Engine goes first ─────────────────────────────────
        print("Engine (X) is thinking about the first move...")
        move = engine.begin()
        if move:
            board[move[1]][move[0]] = BLACK
            print(f"Engine plays: ({move[0]}, {move[1]})")
        show_board()

        # ── Game loop ─────────────────────────────────────────
        print("Enter your move as: x,y (e.g., 8,8)")
        print("Enter 'q' to quit, 'u' to undo (restart)\n")

        while True:
            try:
                user_input = input("Your move (x,y): ").strip()

                if user_input.lower() == "q":
                    print("Quitting game.")
                    break

                if user_input.lower() == "u":
                    engine.restart()
                    board = [["." for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
                    print("Board has been reset.")
                    move = engine.begin()
                    if move:
                        board[move[1]][move[0]] = BLACK
                        print(f"Engine plays: ({move[0]}, {move[1]})")
                    show_board()
                    continue

                parts = user_input.split(",")
                if len(parts) != 2:
                    print("Invalid format! Use: x,y (e.g., 8,8)")
                    continue

                hx, hy = int(parts[0].strip()), int(parts[1].strip())

                if not (0 <= hx < BOARD_SIZE and 0 <= hy < BOARD_SIZE):
                    print(f"Coordinates must be between 0 and {BOARD_SIZE - 1}!")
                    continue

                if board[hy][hx] != ".":
                    print("Cell already occupied! Choose another.")
                    continue

                # Place player's stone
                board[hy][hx] = WHITE
                print(f"You play: ({hx}, {hy})")

                if check_winner(hx, hy, WHITE):
                    show_board()
                    print("You win! Congratulations!")
                    break

                # Engine responds
                print("Engine is thinking...")
                move = engine.turn(hx, hy, timeout=30)
                if move:
                    board[move[1]][move[0]] = BLACK
                    print(f"Engine plays: ({move[0]}, {move[1]})")

                    if check_winner(move[0], move[1], BLACK):
                        show_board()
                        print("Engine wins! GG.")
                        break
                else:
                    print("Engine did not respond (timeout)!")

                show_board()

            except ValueError:
                print("Invalid format! Use: x,y (e.g., 8,8)")
            except KeyboardInterrupt:
                print("\nQuitting game.")
                break

    print("Game Over.")


if __name__ == "__main__":
    main()
