const SIZE = 7;
const CELL_COUNT = SIZE * SIZE;
const CENTER_INDEX = 24;

const COLORS = [
  { key: "yellow", hex: "#E69F00", name: "Keltainen" },
  { key: "gray",   hex: "#7A7A7A", name: "Harmaa" },
  { key: "white",  hex: "#F0F0F0", name: "Valkoinen" },
  { key: "blue",   hex: "#004C8C", name: "Sininen" },        // tummennettu
  { key: "orange", hex: "#D55E00", name: "Oranssi" },
  { key: "purple", hex: "#CC79A7", name: "Violetti" },
  { key: "sky",    hex: "#9BD7FF", name: "Vaaleansininen" }, // vaalennettu
  { key: "teal",   hex: "#009E73", name: "Turkoosi" }
];

const DIFFICULTY_POINTS = {
  easy: 6,
  normal: 5,
  hard: 4
};

let board = Array(CELL_COUNT).fill(null);
let moves = 0;
let currentPlayer = 0;
let playerCount = 2;
let difficulty = "normal";
let emptyIndex = CENTER_INDEX;
let history = [];

const boardEl = document.getElementById("board");
const playerCountEl = document.getElementById("playerCount");
const difficultyEl = document.getElementById("difficulty");
const playerLabelEl = document.getElementById("playerLabel");
const moveLabelEl = document.getElementById("moveLabel");
const centerLabelEl = document.getElementById("centerLabel");
const shapeLabelEl = document.getElementById("shapeLabel");
const scoreLabelEl = document.getElementById("scoreLabel");
const messageBoxEl = document.getElementById("messageBox");
const btnNew = document.getElementById("btnNew");
const btnUndo = document.getElementById("btnUndo");
const btnCheck = document.getElementById("btnCheck");

btnNew.addEventListener("click", newGame);
btnUndo.addEventListener("click", undoMove);
btnCheck.addEventListener("click", checkSolvedManual);
playerCountEl.addEventListener("change", newGame);
difficultyEl.addEventListener("change", newGame);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function newGame() {
  playerCount = Number(playerCountEl.value);
  difficulty = difficultyEl.value;
  moves = 0;
  currentPlayer = 0;
  history = [];
  board = generateStartBoard();
  emptyIndex = CENTER_INDEX;
  setMessage("Uusi peli aloitettu. Pidä keskikohta tyhjänä, jos haluat lisäpisteet.");
  render();
}

function generateStartBoard() {
  const counts = Object.fromEntries(COLORS.map(c => [c.key, 6]));
  const result = Array(CELL_COUNT).fill(null);
  result[CENTER_INDEX] = null;

  const order = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (i !== CENTER_INDEX) order.push(i);
  }
  shuffle(order);

  const ok = placeRec(0, order, result, counts);
  if (!ok) {
    throw new Error("Aloitusasettelun generointi epäonnistui.");
  }
  return result;
}

function placeRec(pos, order, result, counts) {
  if (pos >= order.length) return true;

  const idx = order[pos];
  const neighborColors = getNeighbors(idx)
    .map(n => result[n])
    .filter(Boolean);

  const options = COLORS
    .map(c => c.key)
    .filter(key => counts[key] > 0 && !neighborColors.includes(key));

  shuffle(options);

  for (const key of options) {
    result[idx] = key;
    counts[key]--;

    if (forwardCheck(order, pos + 1, result, counts) && placeRec(pos + 1, order, result, counts)) {
      return true;
    }

    result[idx] = null;
    counts[key]++;
  }
  return false;
}

function forwardCheck(order, startPos, result, counts) {
  for (let p = startPos; p < order.length; p++) {
    const idx = order[p];
    if (result[idx] !== null) continue;

    const neighborColors = getNeighbors(idx)
      .map(n => result[n])
      .filter(Boolean);

    const hasAny = COLORS.some(c => counts[c.key] > 0 && !neighborColors.includes(c.key));
    if (!hasAny) return false;
  }
  return true;
}

function render() {
  boardEl.innerHTML = "";
  board.forEach((colorKey, idx) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";
    cell.setAttribute("aria-label", colorKey ? `Kuula ${colorKey}` : "Tyhjä kohta");

    if (idx === emptyIndex) {
      cell.classList.add("empty");
    } else {
      cell.classList.add("clickable");
      cell.addEventListener("click", () => moveMarble(idx));
    }

    if (colorKey) {
      const marble = document.createElement("div");
      marble.className = "marble";
      marble.style.background = COLORS.find(c => c.key === colorKey).hex;
      cell.appendChild(marble);
    }

    boardEl.appendChild(cell);
  });

  const scoreInfo = getScoreInfo();
  playerLabelEl.textContent = `${currentPlayer + 1} / ${playerCount}`;
  moveLabelEl.textContent = String(moves);
  centerLabelEl.textContent = emptyIndex === CENTER_INDEX ? "Kyllä" : "Ei";
  shapeLabelEl.textContent = `${scoreInfo.uniqueShapeCount} kpl`;
  scoreLabelEl.textContent = `${scoreInfo.score} p`;
  btnUndo.disabled = history.length === 0;
}

function moveMarble(fromIndex) {
  if (fromIndex === emptyIndex) return;

  history.push({
    board: board.slice(),
    emptyIndex,
    moves,
    currentPlayer
  });

  board[emptyIndex] = board[fromIndex];
  board[fromIndex] = null;
  emptyIndex = fromIndex;
  moves++;
  currentPlayer = (currentPlayer + 1) % playerCount;

  render();

  if (isSolved()) {
    const scoreInfo = getScoreInfo();
    setMessage(
      `Ratkaistu! Eri muotoja: ${scoreInfo.uniqueShapeCount}, ` +
      `keskikolo: ${scoreInfo.centerBonus} p, ` +
      `siirrot: ${moves}, lopputulos: ${scoreInfo.score} p.`,
      true
    );
  } else {
    setMessage(`Pelaaja ${currentPlayer + 1} vuorossa.`);
  }
}

function undoMove() {
  const prev = history.pop();
  if (!prev) return;
  board = prev.board.slice();
  emptyIndex = prev.emptyIndex;
  moves = prev.moves;
  currentPlayer = prev.currentPlayer;
  setMessage("Edellinen siirto peruttu.");
  render();
}

function checkSolvedManual() {
  if (isSolved()) {
    const scoreInfo = getScoreInfo();
    setMessage(
      `Kyllä. Peli on ratkaistu. Lopputulos tällä hetkellä ${scoreInfo.score} pistettä.`,
      true
    );
  } else {
    setMessage("Ei vielä ratkaistu. Kaikkien samanväristen kuulien pitää muodostaa yksi yhtenäinen ryhmä.");
  }
}

function isSolved() {
  for (const color of COLORS.map(c => c.key)) {
    const positions = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (board[i] === color) positions.push(i);
    }
    if (positions.length === 0) continue;
    const reached = floodFillColor(positions[0], color);
    if (reached.length !== positions.length) return false;
  }
  return true;
}

function floodFillColor(start, color) {
  const stack = [start];
  const seen = new Set();
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i) || board[i] !== color) continue;
    seen.add(i);
    for (const n of getNeighbors(i)) {
      if (!seen.has(n) && board[n] === color) stack.push(n);
    }
  }
  return [...seen];
}

function getScoreInfo() {
  const pointPerShape = DIFFICULTY_POINTS[difficulty];
  const shapeKeys = [];

  for (const color of COLORS.map(c => c.key)) {
    const positions = [];

    for (let i = 0; i < CELL_COUNT; i++) {
      if (board[i] === color) positions.push(i);
    }

    if (positions.length === 0) continue;

    const reached = floodFillColor(positions[0], color);

    // Lasketaan muoto mukaan vain, jos kaikki tämän värin kuulat
    // ovat samassa yhtenäisessä ortogonaalisessa ryhmässä
    if (reached.length === positions.length) {
      shapeKeys.push(getCanonicalShapeKey(positions));
    }
  }

  const uniqueShapeCount = new Set(shapeKeys).size;
  const centerBonus = emptyIndex === CENTER_INDEX ? 5 : 0;
  const score = uniqueShapeCount * pointPerShape + centerBonus - moves;

  return { uniqueShapeCount, centerBonus, score };
}
function getCanonicalShapeKey(indices) {
  const coords = indices.map(i => [i % SIZE, Math.floor(i / SIZE)]);

  const transforms = [
    ([x, y]) => [ x,  y],
    ([x, y]) => [ x, -y],
    ([x, y]) => [-x,  y],
    ([x, y]) => [-x, -y],
    ([x, y]) => [ y,  x],
    ([x, y]) => [ y, -x],
    ([x, y]) => [-y,  x],
    ([x, y]) => [-y, -x],
  ];

  const keys = transforms.map(tf => {
    const pts = coords.map(tf);
    const minX = Math.min(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1]));
    const norm = pts
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    return norm.map(([x, y]) => `${x},${y}`).join("|");
  });

  keys.sort();
  return keys[0];
}

function getNeighbors(i) {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < SIZE - 1) out.push(i + 1);
  if (y > 0) out.push(i - SIZE);
  if (y < SIZE - 1) out.push(i + SIZE);
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setMessage(text, win = false) {
  messageBoxEl.textContent = text;
  messageBoxEl.classList.toggle("win", !!win);
  messageBoxEl.classList.toggle("warn", !win && /ei|peruttu|kesk/i.test(text));
}

newGame();
