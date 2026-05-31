import { Router } from 'express';
import passport from '../auth.js';

const router = Router();

// POST /api/sessions — login
router.post('/', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Login failed.' });

    req.login(user, (err) => {
      if (err) return next(err);
      res.json(user);
    });
  })(req, res, next);
});

// DELETE /api/sessions/current — logout
router.delete('/current', (req, res) => {
  req.logout(() => {
    res.sendStatus(200);
  });
});

// GET /api/sessions/current — get logged-in user info
router.get('/current', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated.' });
  res.json(req.user);
});

export default router;
