/**
 * Example: Play Gomoku in the console against the Rapfi engine.
 *
 * Usage:
 *   node play-console.js
 *
 * Requirements:
 *   - Rapfi engine binaries must be in the engine/ folder.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const readlineModule = require('readline');
const { GomocupEngine } = require('../src/gomocup-engine');

const BOARD_SIZE = 15;

// Auto-detect platform and resolve engine path
function getEnginePath() {
  const engineDir = path.join(__dirname, '..', '..', 'engine');
  if (process.platform === 'win32') {
    return path.join(engineDir, 'pbrain-rapfi-windows-sse.exe');
  } else if (process.platform === 'darwin') {
    return path.join(engineDir, 'pbrain-rapfi-macos-apple-silicon');
  } else {
    return path.join(engineDir, 'pbrain-rapfi-linux-clang-sse');
  }
}

const ENGINE_PATH = getEnginePath();
// Or specify directly:
// const ENGINE_PATH = 'C:\\path\\to\\pbrain-rapfi-windows-sse.exe';

const BLACK = 'X'; // Engine
const WHITE = 'O'; // Player

function showBoard(board) {
  console.log();
  const header = '    ' + Array.from({ length: BOARD_SIZE }, (_, i) =>
    String(i).padStart(2)
  ).join('  ');
  console.log(header);
  console.log('    ' + '─'.repeat(BOARD_SIZE * 4 - 1));
  for (let r = 0; r < BOARD_SIZE; r++) {
    console.log(` ${String(r).padStart(2)}│ ${board[r].join('   ')}`);
  }
  console.log();
}

function checkWinner(board, bx, by, symbol) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) {
    let count = 1;
    for (const sign of [1, -1]) {
      let nx = bx + dx * sign;
      let ny = by + dy * sign;
      while (
        nx >= 0 && nx < BOARD_SIZE &&
        ny >= 0 && ny < BOARD_SIZE &&
        board[ny][nx] === symbol
      ) {
        count++;
        nx += dx * sign;
        ny += dy * sign;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  if (!fs.existsSync(ENGINE_PATH)) {
    console.log(`Engine not found at: ${ENGINE_PATH}`);
    console.log('Please update ENGINE_PATH in this file.');
    return;
  }

  const rl = readlineModule.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const engine = new GomocupEngine(ENGINE_PATH);

  try {
    await engine.start(BOARD_SIZE);

    const info = await engine.about();
    console.log(`Engine: ${info}\n`);

    engine.configure({
      timeoutTurn: 3000,  // 3 seconds per move
      maxDepth: 10,       // Search depth 10
      rule: 0,            // Freestyle
    });

    // Initialize board
    let board = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill('.')
    );

    // Engine goes first
    console.log('Engine (X) is thinking about the first move...');
    let move = await engine.begin();
    if (move) {
      board[move.y][move.x] = BLACK;
      console.log(`Engine plays: (${move.x}, ${move.y})`);
    }
    showBoard(board);

    console.log("Enter your move as: x,y (e.g., 8,8)");
    console.log("Enter 'q' to quit, 'u' to undo (restart)\n");

    // Game loop
    let playing = true;
    while (playing) {
      const userInput = await askQuestion(rl, 'Your move (x,y): ');

      if (userInput.toLowerCase() === 'q') {
        console.log('Quitting game.');
        break;
      }

      if (userInput.toLowerCase() === 'u') {
        await engine.restart();
        board = Array.from({ length: BOARD_SIZE }, () =>
          Array(BOARD_SIZE).fill('.')
        );
        console.log('Board has been reset.');
        move = await engine.begin();
        if (move) {
          board[move.y][move.x] = BLACK;
          console.log(`Engine plays: (${move.x}, ${move.y})`);
        }
        showBoard(board);
        continue;
      }

      const parts = userInput.split(',');
      if (parts.length !== 2) {
        console.log('Invalid format! Use: x,y (e.g., 8,8)');
        continue;
      }

      const hx = parseInt(parts[0].trim(), 10);
      const hy = parseInt(parts[1].trim(), 10);

      if (isNaN(hx) || isNaN(hy)) {
        console.log('Invalid format! Use: x,y (e.g., 8,8)');
        continue;
      }

      if (hx < 0 || hx >= BOARD_SIZE || hy < 0 || hy >= BOARD_SIZE) {
        console.log(`Coordinates must be between 0 and ${BOARD_SIZE - 1}!`);
        continue;
      }

      if (board[hy][hx] !== '.') {
        console.log('Cell already occupied! Choose another.');
        continue;
      }

      // Place player's stone
      board[hy][hx] = WHITE;
      console.log(`You play: (${hx}, ${hy})`);

      if (checkWinner(board, hx, hy, WHITE)) {
        showBoard(board);
        console.log('You win! Congratulations!');
        break;
      }

      // Engine responds
      console.log('Engine is thinking...');
      move = await engine.turn(hx, hy, 30000);
      if (move) {
        board[move.y][move.x] = BLACK;
        console.log(`Engine plays: (${move.x}, ${move.y})`);

        if (checkWinner(board, move.x, move.y, BLACK)) {
          showBoard(board);
          console.log('Engine wins! GG.');
          break;
        }
      } else {
        console.log('Engine did not respond (timeout)!');
      }

      showBoard(board);
    }
  } finally {
    await engine.stop();
    rl.close();
  }

  console.log('Game Over.');
}

main().catch(console.error);
