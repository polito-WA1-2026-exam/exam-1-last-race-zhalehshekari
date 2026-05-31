import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import passport from './auth.js';
import authRoutes from './routes/authRoutes.js';

const app = express();
const port = 3001;

// allow requests from the React dev server with session cookies
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

// routes
app.use('/api/sessions', authRoutes);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});