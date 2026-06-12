/**
 * seed.js — run once to create the DB schema and insert initial data.
 * Usage: node seed.js
 */

import db from './db.js';
import bcrypt from 'bcrypt';

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  DROP TABLE IF EXISTS scores;
  DROP TABLE IF EXISTS events;
  DROP TABLE IF EXISTS station_lines;
  DROP TABLE IF EXISTS segments;
  DROP TABLE IF EXISTS stations;
  DROP TABLE IF EXISTS lines;
  DROP TABLE IF EXISTS users;

  -- Transit lines (e.g. Metro Red, Metro Blue …)
  CREATE TABLE lines (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL,
    color   TEXT NOT NULL   -- hex color, used by the client map
  );

  -- Stations in the network
  CREATE TABLE stations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    is_interchange INTEGER NOT NULL DEFAULT 0  -- 1 if served by >1 line
  );

  -- Which lines stop at which station (many-to-many)
  CREATE TABLE station_lines (
    station_id INTEGER NOT NULL REFERENCES stations(id),
    line_id    INTEGER NOT NULL REFERENCES lines(id),
    PRIMARY KEY (station_id, line_id)
  );

  -- Direct connections between consecutive stations on a line.
  -- Each row = one segment (ordered pair on a given line).
  -- "from_station → to_station" is undirected: both directions are valid.
  CREATE TABLE segments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    line_id         INTEGER NOT NULL REFERENCES lines(id),
    from_station_id INTEGER NOT NULL REFERENCES stations(id),
    to_station_id   INTEGER NOT NULL REFERENCES stations(id)
  );

  -- Journey events drawn randomly per segment during execution
  CREATE TABLE events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    coin_effect INTEGER NOT NULL  -- range -4 .. +4
  );

  -- Registered users
  CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL  -- bcrypt hash
  );

  -- Saved game scores (only logged-in users)
  CREATE TABLE scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    score      INTEGER NOT NULL,
    played_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('Tables created.');

// ── Lines ───────────────────────────────────────────────────────────────────

const insertLine = db.prepare('INSERT INTO lines (name, color) VALUES (?, ?)');

const lineRed = insertLine.run('Red Line', '#E53935').lastInsertRowid;
const lineBlue = insertLine.run('Blue Line', '#1E88E5').lastInsertRowid;
const lineGreen = insertLine.run('Green Line', '#43A047').lastInsertRowid;
const lineYellow = insertLine.run('Yellow Line', '#FDD835').lastInsertRowid;

console.log('Lines inserted.');

// ── Stations ─────────────────────────────────────────────────────────────────
// Network layout (14 stations, 6 interchanges) — Torino Metro Line 1 station names
// Interchange rule: interchanges must not exceed half the total station count.
// 6 / 14 ≈ 43%  ✓
//
//  Red:    Porta Susa ── Porta Nuova ── Dante ── Lingotto ── Fermi
//  Blue:   Porta Susa ── Re Umberto ── Vinzaglio ── Dante ── Paradiso ── Marche
//  Green:  Porta Nuova ── Massaua ── Nizza ── Vinzaglio ── Pozzo Strada
//  Yellow: Lingotto ── Nizza ── Re Umberto ── Monte Grappa ── Bernini
//
//  Interchanges (6): Porta Susa (R+B), Porta Nuova (R+G),
//                    Vinzaglio (B+G), Lingotto (R+Y),
//                    Re Umberto (B+Y), Nizza (G+Y)
//  Regular (8): Dante, Fermi, Paradiso, Marche, Massaua, Pozzo Strada, Monte Grappa, Bernini

const insertStation = db.prepare(
  'INSERT INTO stations (name, is_interchange) VALUES (?, ?)'
);

// [name, is_interchange]
const stationDefs = [
  ['Porta Susa', 1],  // Red + Blue  (interchange)
  ['Porta Nuova', 1],  // Red + Green (interchange)
  ['Dante', 0],  // Red + Blue  — NOT an interchange (demoted to keep count ≤ 50%)
  ['Lingotto', 1],  // Red + Yellow (interchange)
  ['Fermi', 0],  // Red terminus
  ['Re Umberto', 1],  // Blue + Yellow (interchange)
  ['Vinzaglio', 1],  // Blue + Green  (interchange)
  ['Paradiso', 0],  // Blue
  ['Marche', 0],  // Blue terminus
  ['Massaua', 0],  // Green
  ['Nizza', 1],  // Green + Yellow (interchange)
  ['Pozzo Strada', 0],  // Green terminus
  ['Monte Grappa', 0],  // Yellow
  ['Bernini', 0],  // Yellow terminus
];

const stationIds = {};
for (const [name, isInterchange] of stationDefs) {
  stationIds[name] = insertStation.run(name, isInterchange).lastInsertRowid;
}

console.log('Stations inserted.');

// ── Station ↔ Line membership ────────────────────────────────────────────────

const insertSL = db.prepare(
  'INSERT INTO station_lines (station_id, line_id) VALUES (?, ?)'
);

const lineStations = {
  [lineRed]: ['Porta Susa', 'Porta Nuova', 'Dante', 'Lingotto', 'Fermi'],
  [lineBlue]: ['Porta Susa', 'Re Umberto', 'Vinzaglio', 'Dante', 'Paradiso', 'Marche'],
  [lineGreen]: ['Porta Nuova', 'Massaua', 'Nizza', 'Vinzaglio', 'Pozzo Strada'],
  [lineYellow]: ['Lingotto', 'Nizza', 'Re Umberto', 'Monte Grappa', 'Bernini'],
};

for (const [lineId, names] of Object.entries(lineStations)) {
  for (const name of names) {
    insertSL.run(stationIds[name], Number(lineId));
  }
}

console.log('Station-line memberships inserted.');

// ── Segments (consecutive pairs on each line) ────────────────────────────────

const insertSegment = db.prepare(
  'INSERT INTO segments (line_id, from_station_id, to_station_id) VALUES (?, ?, ?)'
);

const addSegments = (lineId, names) => {
  for (let i = 0; i < names.length - 1; i++) {
    insertSegment.run(lineId, stationIds[names[i]], stationIds[names[i + 1]]);
  }
};

addSegments(lineRed, ['Porta Susa', 'Porta Nuova', 'Dante', 'Lingotto', 'Fermi']);
addSegments(lineBlue, ['Porta Susa', 'Re Umberto', 'Vinzaglio', 'Dante', 'Paradiso', 'Marche']);
addSegments(lineGreen, ['Porta Nuova', 'Massaua', 'Nizza', 'Vinzaglio', 'Pozzo Strada']);
addSegments(lineYellow, ['Lingotto', 'Nizza', 'Re Umberto', 'Monte Grappa', 'Bernini']);

console.log('Segments inserted.');

// ── Events ──────────────────────────────────────────────────────────────────

const insertEvent = db.prepare(
  'INSERT INTO events (description, coin_effect) VALUES (?, ?)'
);

const events = [
  ['Free pass found!', 4],  // +4
  ['Stranger paid fare.', 3],  // +3
  ['Discount applied.', 2],  // +2
  ['Train skipped stop.', 1],  // +1
  ['Smooth ride today.', 0],  //  0
  ['Bought extra ticket.', -1],  // -1
  ['Delay, missed train.', -2],  // -2
  ['Card declined, cash.', -3],  // -3
  ['Wrong zone ticket.', -4],  // -4
];

for (const [desc, effect] of events) {
  insertEvent.run(desc, effect);
}

console.log('Events inserted.');

// ── Users ───────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

const insertUser = db.prepare(
  'INSERT INTO users (username, password) VALUES (?, ?)'
);

const users = [
  { username: 'zhaleh', password: 'zhaleh123' },
  { username: 'pouria', password: 'pouria123' },
  { username: 'ali', password: 'ali123' },
];

const userIds = {};
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
  userIds[u.username] = insertUser.run(u.username, hash).lastInsertRowid;
}

console.log('Users inserted.');

console.log('\nDatabase seeded successfully!');
