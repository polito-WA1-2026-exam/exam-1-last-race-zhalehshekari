import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import passport from './auth.js';
import authRoutes from './routes/authRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import db from './db.js';

// Auto-seed database if missing or empty
try {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  let needsSeeding = !tableCheck;
  if (!needsSeeding) {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    if (!userCount || userCount.count === 0) {
      needsSeeding = true;
    }
  }
  if (needsSeeding) {
    console.log('Database is empty or missing tables. Running auto-seeding...');
    const { seedDatabase } = await import('./seed.js');
    seedDatabase();
  }
} catch (err) {
  console.log('Error checking database status, attempting to seed:', err);
  try {
    const { seedDatabase } = await import('./seed.js');
    seedDatabase();
  } catch (seedErr) {
    console.error('Auto-seeding failed:', seedErr);
  }
}

const app = express();
const port = 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());

app.use(session({
  secret: 'wa1-last-race-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/sessions', authRoutes);
app.use('/api', gameRoutes);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});