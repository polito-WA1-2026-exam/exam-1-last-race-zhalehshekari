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

const lineRed    = insertLine.run('Red Line',    '#E53935').lastInsertRowid;
const lineBlue   = insertLine.run('Blue Line',   '#1E88E5').lastInsertRowid;
const lineGreen  = insertLine.run('Green Line',  '#43A047').lastInsertRowid;
const lineYellow = insertLine.run('Yellow Line', '#FDD835').lastInsertRowid;

console.log('Lines inserted.');

// ── Stations ─────────────────────────────────────────────────────────────────
// Network layout (15 stations, 5 interchanges)
//
//  Red:    Central ── Riverside ── Oakwood ── Lakeside ── Northgate
//  Blue:   Central ── Hilltop ── Westbridge ── Oakwood ── Eastfield ── Harbor
//  Green:  Riverside ── Meadow ── Junction ── Westbridge ── Southpark
//  Yellow: Lakeside ── Junction ── Hilltop ── Uptown ── Newtown
//
//  Interchanges: Central (R+B), Riverside (R+G), Oakwood (R+B),
//                Westbridge (B+G), Lakeside (R+Y), Hilltop (B+Y),
//                Junction (G+Y)

const insertStation = db.prepare(
  'INSERT INTO stations (name, is_interchange) VALUES (?, ?)'
);

// [name, is_interchange]
const stationDefs = [
  ['Central',    1],  // Red + Blue
  ['Riverside',  1],  // Red + Green
  ['Oakwood',    1],  // Red + Blue
  ['Lakeside',   1],  // Red + Yellow
  ['Northgate',  0],  // Red terminus
  ['Hilltop',    1],  // Blue + Yellow
  ['Westbridge', 1],  // Blue + Green
  ['Eastfield',  0],  // Blue
  ['Harbor',     0],  // Blue terminus
  ['Meadow',     0],  // Green
  ['Junction',   1],  // Green + Yellow
  ['Southpark',  0],  // Green terminus
  ['Uptown',     0],  // Yellow
  ['Newtown',    0],  // Yellow terminus
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
  [lineRed]:    ['Central', 'Riverside', 'Oakwood', 'Lakeside', 'Northgate'],
  [lineBlue]:   ['Central', 'Hilltop', 'Westbridge', 'Oakwood', 'Eastfield', 'Harbor'],
  [lineGreen]:  ['Riverside', 'Meadow', 'Junction', 'Westbridge', 'Southpark'],
  [lineYellow]: ['Lakeside', 'Junction', 'Hilltop', 'Uptown', 'Newtown'],
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

addSegments(lineRed,    ['Central', 'Riverside', 'Oakwood', 'Lakeside', 'Northgate']);
addSegments(lineBlue,   ['Central', 'Hilltop', 'Westbridge', 'Oakwood', 'Eastfield', 'Harbor']);
addSegments(lineGreen,  ['Riverside', 'Meadow', 'Junction', 'Westbridge', 'Southpark']);
addSegments(lineYellow, ['Lakeside', 'Junction', 'Hilltop', 'Uptown', 'Newtown']);

console.log('Segments inserted.');

// ── Events ──────────────────────────────────────────────────────────────────

const insertEvent = db.prepare(
  'INSERT INTO events (description, coin_effect) VALUES (?, ?)'
);

const events = [
  // positive
  ['You found a forgotten monthly pass on the seat!', 4],
  ['A kind commuter paid for your fare. Lucky day!', 3],
  ['Flash sale on the transit app — partial refund credited.', 2],
  ['The train skipped a closed station, cutting your time short.', 1],
  // neutral
  ['Smooth ride, no surprises. Nothing gained, nothing lost.', 0],
  // negative
  ['Unexpected detour: you had to buy a new single ticket.', -1],
  ['A delay meant you missed a connection and paid a penalty fare.', -2],
  ['Your contactless card failed; you paid cash at full price.', -3],
  ['Inspectors checked tickets — yours was invalid for this zone.', -4],
  // extra variety
  ['A street performer distracted you — you boarded the wrong car.', -1],
  ['You won a station raffle: free ride coupon!', 2],
  ['Signal failure caused a partial refund from the operator.', 1],
  ['Overcrowding meant a bus bridge with an extra charge.', -2],
  ['You helped a tourist and they gifted you a transit token.', 3],
  ['Your bag got caught in the door; small incident charge.', -1],
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
  { username: 'alice',   password: 'alice123'   },
  { username: 'bob',     password: 'bob123'     },
  { username: 'charlie', password: 'charlie123' },
];

const userIds = {};
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
  userIds[u.username] = insertUser.run(u.username, hash).lastInsertRowid;
}

console.log('Users inserted.');

// ── Scores (pre-existing history for leaderboard) ──────────────────────────

const insertScore = db.prepare(
  "INSERT INTO scores (user_id, score, played_at) VALUES (?, ?, ?)"
);

// alice and bob have existing game history
const history = [
  // alice: 3 past games
  { username: 'alice', score: 18, played_at: '2026-05-20 10:00:00' },
  { username: 'alice', score: 22, played_at: '2026-05-22 15:30:00' },
  { username: 'alice', score: 9,  played_at: '2026-05-25 09:00:00' },
  // bob: 3 past games
  { username: 'bob',   score: 25, played_at: '2026-05-21 11:00:00' },
  { username: 'bob',   score: 14, played_at: '2026-05-23 17:00:00' },
  { username: 'bob',   score: 30, played_at: '2026-05-28 20:00:00' },
];

for (const entry of history) {
  insertScore.run(userIds[entry.username], entry.score, entry.played_at);
}

console.log('Seed scores inserted.');
console.log('\nDatabase seeded successfully!');
