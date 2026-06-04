import { Router } from 'express';
import db from '../db.js';

const router = Router();

// BFS on the undirected segment graph — returns shortest edge-count between two stations
function bfsDistance(segments, fromId, toId) {
  const adj = {};
  for (const seg of segments) {
    if (!adj[seg.from_station_id]) adj[seg.from_station_id] = [];
    if (!adj[seg.to_station_id])   adj[seg.to_station_id]   = [];
    adj[seg.from_station_id].push(seg.to_station_id);
    adj[seg.to_station_id].push(seg.from_station_id);
  }

  if (fromId === toId) return 0;

  const visited = new Set([fromId]);
  const queue   = [[fromId, 0]];

  while (queue.length > 0) {
    const [current, dist] = queue.shift();
    for (const neighbor of (adj[current] || [])) {
      if (neighbor === toId) return dist + 1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, dist + 1]);
      }
    }
  }
  return Infinity; // unreachable
}

// GET /api/network — full transit network (lines, stations, segments)
router.get('/network', (req, res) => {
  const lines    = db.prepare('SELECT * FROM lines').all();
  const stations = db.prepare('SELECT * FROM stations').all();
  const segments = db.prepare('SELECT * FROM segments').all();
  res.json({ lines, stations, segments });
});

// GET /api/game/start — pick a random start/destination pair with distance >= 3
router.get('/game/start', (req, res) => {
  const stations = db.prepare('SELECT * FROM stations').all();
  const segments = db.prepare('SELECT * FROM segments').all();

  // only stations that appear in at least one segment
  const connectedIds = new Set(segments.flatMap(s => [s.from_station_id, s.to_station_id]));
  const connected    = stations.filter(s => connectedIds.has(s.id));

  let start, destination, attempts = 0;
  do {
    start       = connected[Math.floor(Math.random() * connected.length)];
    destination = connected[Math.floor(Math.random() * connected.length)];
    attempts++;
    if (attempts > 200) return res.status(500).json({ error: 'Could not find a valid start/destination pair.' });
  } while (start.id === destination.id || bfsDistance(segments, start.id, destination.id) < 3);

  res.json({ start, destination });
});

// POST /api/game/submit — validate route and assign random events
// body: { startId, destinationId, route: [{ fromId, toId, lineId }, ...] }
//
// ─── VALIDATION ALGORITHM ───────────────────────────────────────────────────
//
// Step 1 – Boundary check
//   route[0].fromId  must equal startId
//   route[N-1].toId  must equal destinationId
//
// Step 2 – Continuity (head-to-tail)
//   For each consecutive pair (i, i+1):
//     route[i].toId === route[i+1].fromId
//   This guarantees the path has no gaps or teleports.
//
// Step 3 – Segment existence
//   Every segment {fromId, toId} must exist in the DB on the declared lineId.
//   Both traversal directions are valid (undirected graph).
//
// Step 4 – Interchange constraint (THE key rule)
//   When two consecutive segments are on DIFFERENT lines
//   (route[i].lineId !== route[i+1].lineId),
//   the connecting station (route[i].toId) MUST have is_interchange = 1.
//   If a line change happens at a regular station → invalid.
//
// All four checks must pass; any failure returns { valid: false, score: 0 }.
// ────────────────────────────────────────────────────────────────────────────
router.post('/game/submit', (req, res) => {
  const { startId, destinationId, route } = req.body;

  if (!startId || !destinationId || !Array.isArray(route) || route.length === 0) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const invalid = { valid: false, score: 0, events: [] };

  // 1. Check start and end match the declared stations
  if (route[0].fromId !== startId || route[route.length - 1].toId !== destinationId) {
    return res.json(invalid);
  }

  // 2. Check all segments connect head-to-tail
  for (let i = 0; i < route.length - 1; i++) {
    if (route[i].toId !== route[i + 1].fromId) return res.json(invalid);
  }

  // 3. Check each segment actually exists on the declared line (both directions allowed)
  const segCheck = db.prepare(`
    SELECT id FROM segments
    WHERE line_id = ?
      AND ((from_station_id = ? AND to_station_id = ?)
        OR (from_station_id = ? AND to_station_id = ?))
  `);
  for (const seg of route) {
    const found = segCheck.get(seg.lineId, seg.fromId, seg.toId, seg.toId, seg.fromId);
    if (!found) return res.json(invalid);
  }

  // 4. Line changes are only allowed at interchange stations
  for (let i = 0; i < route.length - 1; i++) {
    if (route[i].lineId !== route[i + 1].lineId) {
      const station = db.prepare('SELECT is_interchange FROM stations WHERE id = ?').get(route[i].toId);
      if (!station || !station.is_interchange) return res.json(invalid);
    }
  }

  // Valid route — pick one random event per segment
  const events = db.prepare('SELECT * FROM events').all();
  let coins = 20;
  const eventLog = [];

  for (const seg of route) {
    const event = events[Math.floor(Math.random() * events.length)];
    coins += event.coin_effect;
    eventLog.push({
      segmentFrom:  seg.fromId,
      segmentTo:    seg.toId,
      description:  event.description,
      coin_effect:  event.coin_effect,
      coinsAfter:   coins,       // can be negative mid-game; client shows it as-is
    });
  }

  res.json({ valid: true, score: Math.max(0, coins), events: eventLog });
});

// auth guard used by score and ranking routes
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated.' });
};

// POST /api/scores — save a score (auth required)
router.post('/scores', isLoggedIn, (req, res) => {
  const { score } = req.body;
  if (score === undefined || typeof score !== 'number' || score < 0) {
    return res.status(400).json({ error: 'Invalid score.' });
  }
  db.prepare('INSERT INTO scores (user_id, score) VALUES (?, ?)').run(req.user.id, score);
  res.status(201).json({ message: 'Score saved.' });
});

// GET /api/ranking — all scores ordered by score desc (auth required)
router.get('/ranking', isLoggedIn, (req, res) => {
  const ranking = db.prepare(`
    SELECT u.username, s.score, s.played_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC, s.played_at ASC
  `).all();
  res.json(ranking);
});

export default router;
