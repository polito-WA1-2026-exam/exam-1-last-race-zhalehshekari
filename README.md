# Exam #1: "Last Race"
## Student: s353869 SHEKARI ZHALEH

## React Client Application Routes

| Route | Access | Description |
|---|---|---|
| `/` | Anyone | Home page with game instructions and a "Log in to play" CTA. Anonymous users cannot access the game or ranking. |
| `/login` | Guest only | Login form (redirects already-logged-in users to `/game`). |
| `/game` | Logged in only | Full game flow: Phase 1 (map study), Phase 2 (90 s planning), Phase 3 (execution animation), Phase 4 (result screen). |
| `/ranking` | Logged in only | Global leaderboard sorted by score descending. Current user's rows are highlighted. |

Any unknown URL falls back to `/`.

---

## API Server

All routes are prefixed with `/api`.

### Authentication — `/api/sessions`

- **`POST /api/sessions`**
  - Body: `{ username: string, password: string }`
  - Response `200`: `{ id, username }` — session cookie set
  - Response `401`: `{ error: "Login failed." }`

- **`DELETE /api/sessions/current`**
  - No body required (session cookie used)
  - Response `200`: session destroyed

- **`GET /api/sessions/current`**
  - Response `200`: `{ id, username }` if authenticated
  - Response `401`: `{ error: "Not authenticated." }` if anonymous

### Game — `/api`

- **`GET /api/network`**
  - No auth required
  - Response `200`: `{ lines: [...], stations: [...], segments: [...] }`
    - Each `line`: `{ id, name, color }`
    - Each `station`: `{ id, name, is_interchange }`
    - Each `segment`: `{ id, line_id, from_station_id, to_station_id }`

- **`GET /api/game/start`**
  - No auth required
  - Picks a random start/destination pair with BFS distance ≥ 3
  - Response `200`: `{ start: {id, name, ...}, destination: {id, name, ...} }`

- **`POST /api/game/submit`**
  - Body: `{ startId: int, destinationId: int, route: [{ fromId, toId, lineId }, ...] }`
  - Validates: start/end match, segments connect head-to-tail, each segment exists on the declared line, line changes occur only at interchange stations
  - Response `200` (invalid): `{ valid: false, score: 0, events: [] }`
  - Response `200` (valid): `{ valid: true, score: int, events: [{ segmentFrom, segmentTo, description, coin_effect, coinsAfter }, ...] }`

- **`POST /api/scores`** *(auth required)*
  - Body: `{ score: int }` — must be ≥ 0
  - Response `201`: `{ message: "Score saved." }`
  - Response `401`: if not authenticated

- **`GET /api/ranking`** *(auth required)*
  - Response `200`: `[{ username, score, played_at }, ...]` — sorted by score DESC
  - Response `401`: if not authenticated

---

## Database Tables

| Table | Description |
|---|---|
| `users` | Registered players. Columns: `id`, `username` (unique), `password` (bcrypt hash). |
| `lines` | Transit lines. Columns: `id`, `name`, `color` (hex). 4 lines seeded: Red, Blue, Green, Yellow. |
| `stations` | Network stations. Columns: `id`, `name`, `is_interchange` (1 if served by > 1 line). 14 stations named after real Torino Metro Line 1 stops, 6 interchanges (≤ half the total, per spec). |
| `station_lines` | Many-to-many join: which lines stop at which station. Columns: `station_id`, `line_id`. |
| `segments` | Direct connections between consecutive stations on a line. Columns: `id`, `line_id`, `from_station_id`, `to_station_id`. 17 segments total. Traversal is bidirectional. |
| `events` | Random journey events. Columns: `id`, `description`, `coin_effect` (range −4 to +4). 9 events seeded. |
| `scores` | Saved game results (logged-in players only). Columns: `id`, `user_id`, `score`, `played_at` (UTC datetime). |

---

## Main React Components

- **`AuthContext`** (in `contexts/AuthContext.jsx`) — React context that holds the logged-in user object (`null` while loading, `false` when anonymous, user object when authenticated). Provides `login()` and `logout()` helpers.

- **`useAuth`** (in `contexts/useAuth.js`) — Custom hook to consume `AuthContext` anywhere in the tree.

- **`AppNavbar`** (in `components/AppNavbar.jsx`) — Responsive Bootstrap navbar. Shows *Play / Ranking / username / Logout* for authenticated users; *Login* link for guests.

- **`NetworkMap`** (in `components/NetworkMap.jsx`) — SVG transit map with hardcoded station positions. Accepts `showLines` (colored in Phase 1, all grey in Phase 2), `startId`/`destId`/`currentId` (colored station markers), and `routeSegments` (highlights built/processed segments in purple).

- **`GamePage`** (in `pages/GamePage.jsx`) — Main game orchestrator. Implements a 4-phase state machine:
  - *Phase 1 (setup)*: loads network, shows colored map, waits for "I'm Ready"
  - *Phase 2 (planning)*: 90 s countdown, segment selector filtered to valid next moves, undo, route trail
  - *Phase 3 (executing)*: submits route to API, reveals events one by one with 1.8 s delay, coin counter, map highlights processed segments
  - *Phase 4 (result)*: full event log, final score, Play Again / View Ranking actions

- **`LoginPage`** (in `pages/LoginPage.jsx`) — Controlled login form with loading spinner and error alert.

- **`RankingPage`** (in `pages/RankingPage.jsx`) — Fetches `/api/ranking` on mount, renders a dark-themed table with medal emojis for top 3 and a "you" badge on the current user's rows.

- **`HomePage`** (in `pages/HomePage.jsx`) — Public landing page with 4-card game instructions grid and a CTA button to login.

---

## Screenshot

![Screenshot](./img/screenshot.jpg)

## Users Credentials

| Username | Password |
|---|---|
| `zhaleh` | `zhaleh123` |
| `pouria` | `pouria123` |
| `ali` | `ali123` |

Zhaleh and Pouria have pre-seeded score history. Ali starts with no scores.

---

## Use of AI Tools
Briefly describe whether you used any AI tools (e.g., ChatGPT, GitHub Copilot, Claude) while working on this project, for which purposes (e.g., clarifying concepts, debugging, generating code), and how you verified or adapted their output.
If you did not use any AI tools, simply state so.
