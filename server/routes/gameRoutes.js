import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/network — full transit network (lines, stations, segments)
router.get('/network', (req, res) => {
  const lines    = db.prepare('SELECT * FROM lines').all();
  const stations = db.prepare('SELECT * FROM stations').all();
  const segments = db.prepare('SELECT * FROM segments').all();
  res.json({ lines, stations, segments });
});

export default router;
