const BASE = 'http://localhost:3001/api';

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

// Auth
export const login = (username, password) =>
  fetch(`${BASE}/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(handleResponse);

export const logout = () =>
  fetch(`${BASE}/sessions/current`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(res => { if (!res.ok) throw new Error('Logout failed'); });

export const getSession = () =>
  fetch(`${BASE}/sessions/current`, { credentials: 'include' })
    .then(handleResponse);

// Game
export const getNetwork = () =>
  fetch(`${BASE}/network`, { credentials: 'include' })
    .then(handleResponse);

export const getGameStart = () =>
  fetch(`${BASE}/game/start`, { credentials: 'include' })
    .then(handleResponse);

export const submitRoute = (startId, destinationId, route) =>
  fetch(`${BASE}/game/submit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startId, destinationId, route }),
  }).then(handleResponse);

export const saveScore = (score) =>
  fetch(`${BASE}/scores`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  }).then(handleResponse);

export const getRanking = () =>
  fetch(`${BASE}/ranking`, { credentials: 'include' })
    .then(handleResponse);
