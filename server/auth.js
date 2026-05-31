import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from './db.js';

// verify username + password against the DB
passport.use(new LocalStrategy((username, password, done) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return done(null, false, { message: 'Incorrect username.' });

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return done(null, false, { message: 'Incorrect password.' });

  // strip the hash before returning the user object
  const { password: _pw, ...safeUser } = user;
  return done(null, safeUser);
}));

// store only the user id in the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// reload full user from the id on every request
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  if (!user) return done(new Error('User not found'));
  done(null, user);
});

export default passport;
