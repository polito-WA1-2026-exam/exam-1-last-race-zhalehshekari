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

export default router;

