import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from './db.js';

passport.use(new LocalStrategy((username, password, done) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return done(null, false, { message: 'Incorrect username.' });

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return done(null, false, { message: 'Incorrect password.' });

  const { password: _pw, ...safeUser } = user; // strip hash before returning
  return done(null, safeUser);
}));

// Store only user id in session; deserialize fetches full row per request.
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  if (!user) return done(new Error('User not found'));
  done(null, user);
});

export default passport;
