import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getNetwork, getGameStart, submitRoute, saveScore } from '../api';
import { useAuth } from '../contexts/AuthContext';
import NetworkMap from '../components/NetworkMap';

function GamePage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState('loading');
  const [network,        setNetwork]        = useState(null);
  const [gameData,       setGameData]       = useState(null);    // { start, destination }
  const [route,          setRoute]          = useState([]);       // [{ fromId, toId, lineId }]
  const [currentId,      setCurrentId]      = useState(null);
  const [timeLeft,       setTimeLeft]       = useState(90);
  const [result,         setResult]         = useState(null);    // server response
  const [eventIndex,     setEventIndex]     = useState(-1);      // which event is being shown
  const [displayedCoins, setDisplayedCoins] = useState(20);
  const [error,          setError]          = useState('');

  // refs so timer/callback closures always read fresh values
  const routeRef     = useRef([]);
  const gameDataRef  = useRef(null);
  const hasSubmitted = useRef(false);

  useEffect(() => { routeRef.current   = route;    }, [route]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);

  // ── Fetch network on mount ────────────────────────────────────────────────
  useEffect(() => {
    getNetwork()
      .then(data => { setNetwork(data); setPhase('setup'); })
      .catch(() => setError('Could not load the transit network.'));
  }, []);

  // ── Start planning ────────────────────────────────────────────────────────
  const startPlanning = async () => {
    setError('');
    try {
      const data = await getGameStart();
      setGameData(data);
      setCurrentId(data.start.id);
      setRoute([]);
      setTimeLeft(90);
      hasSubmitted.current = false;
      setPhase('planning');
    } catch {
      setError('Could not start the game. Please try again.');
    }
  };

  // ── Planning timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'planning' || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft]);

  // auto-submit when timer expires
  useEffect(() => {
    if (phase === 'planning' && timeLeft === 0) handleSubmit();
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit route ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setPhase('executing');
    setEventIndex(-1);
    setDisplayedCoins(20);

    const gd = gameDataRef.current;
    const r  = routeRef.current;

    try {
      const res = await submitRoute(gd.start.id, gd.destination.id, r);
      if (user && typeof res.score === 'number') {
        await saveScore(res.score).catch(() => {}); // non-fatal if fails
      }
      setResult(res);
    } catch {
      setError('Route submission failed.');
      setPhase('setup');
    }
  }, [user]);

  // ── Execution animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'executing' || !result) return;

    if (!result.valid) {
      // invalid route: show the invalid screen briefly then move to result
      const t = setTimeout(() => setPhase('result'), 2000);
      return () => clearTimeout(t);
    }

    if (eventIndex < result.events.length - 1) {
      // advance to the next event
      const delay = eventIndex === -1 ? 700 : 1800;
      const t = setTimeout(() => setEventIndex(i => i + 1), delay);
      return () => clearTimeout(t);
    }

    // all events shown — transition to result
    const t = setTimeout(() => setPhase('result'), 1200);
    return () => clearTimeout(t);
  }, [phase, eventIndex, result]);

  // sync the displayed coin counter as events are revealed
  useEffect(() => {
    if (eventIndex >= 0 && result?.events[eventIndex]) {
      setDisplayedCoins(result.events[eventIndex].coinsAfter);
    }
  }, [eventIndex, result]);

  // ── Segment helpers ───────────────────────────────────────────────────────
  const stationName = (id) =>
    network?.stations.find(s => s.id === id)?.name ?? String(id);

  const getAvailableMoves = () => {
    if (!network || currentId === null) return [];
    return network.segments
      .filter(s => s.from_station_id === currentId || s.to_station_id === currentId)
      .map(s => {
        const neighborId = s.from_station_id === currentId ? s.to_station_id : s.from_station_id;
        return { fromId: currentId, toId: neighborId, lineId: s.line_id };
      });
  };

  const addSegment = (move) => {
    setRoute(prev => [...prev, move]);
    setCurrentId(move.toId);
  };

  const undoSegment = () => {
    setRoute(prev => {
      const next = prev.slice(0, -1);
      setCurrentId(next.length > 0 ? next[next.length - 1].toId : gameData?.start.id ?? null);
      return next;
    });
  };

  const restart = () => {
    setResult(null);
    setRoute([]);
    setCurrentId(null);
    setEventIndex(-1);
    setDisplayedCoins(20);
    setPhase('setup');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="page-center">
        <Spinner animation="border" variant="light" />
        <p className="text-secondary mt-3">Loading network…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-center">
        <Alert variant="danger">{error}</Alert>
        <Button className="btn-accent" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // ── Phase 1: Setup ────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="game-setup">
        <div className="setup-header">
          <h1 className="h3 fw-bold mb-1">🗺️ Study the Network</h1>
          <p className="text-secondary mb-3">
            Learn the lines, stations, and interchanges before the race begins.
            Interchange stations (ringed circles) allow line changes.
          </p>
        </div>
        <NetworkMap network={network} showLines />
        <div className="setup-footer">
          <Button className="btn-accent px-5 py-2 mt-4" onClick={startPlanning}>
            I'm Ready →
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase 2: Planning ─────────────────────────────────────────────────────
  if (phase === 'planning') {
    const moves      = getAvailableMoves();
    const atDest     = currentId === gameData?.destination.id;
    const timerPct   = (timeLeft / 90) * 100;
    const timerColor = timeLeft > 30 ? '#22c55e' : timeLeft > 10 ? '#f59e0b' : '#ef4444';

    return (
      <div className="game-planning">
        {/* top bar: route goal + timer */}
        <div className="planning-topbar">
          <div className="route-goal">
            <span className="goal-station start-station">{gameData.start.name}</span>
            <span className="goal-arrow">→</span>
            <span className="goal-station dest-station">{gameData.destination.name}</span>
          </div>
          <div className="timer-block">
            <span className="timer-digits" style={{ color: timerColor }}>{timeLeft}s</span>
            <div className="timer-bar-track">
              <div
                className="timer-bar-fill"
                style={{ width: `${timerPct}%`, background: timerColor }}
              />
            </div>
          </div>
        </div>

        {/* map without line colors */}
        <NetworkMap
          network={network}
          showLines={false}
          startId={gameData.start.id}
          destId={gameData.destination.id}
          currentId={currentId}
          routeSegments={route}
        />

        {/* segment selector */}
        <div className="planning-controls">
          <div className="next-moves">
            <p className="small text-secondary mb-2 fw-semibold">
              {atDest
                ? '✅ Destination reached!'
                : `From ${stationName(currentId)}, go to:`}
            </p>
            <div className="moves-list">
              {!atDest && moves.map(move => (
                <button key={move.toId} className="move-btn" onClick={() => addSegment(move)}>
                  {stationName(move.toId)}
                </button>
              ))}
            </div>
          </div>

          {/* built route trail */}
          {route.length > 0 && (
            <div className="route-trail">
              <span className="route-station">{stationName(gameData.start.id)}</span>
              {route.map((r, i) => (
                <span key={i}>
                  <span className="route-arrow">→</span>
                  <span className="route-station">{stationName(r.toId)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="planning-actions">
            {route.length > 0 && (
              <button className="undo-btn" onClick={undoSegment}>↩ Undo</button>
            )}
            <Button className="btn-accent" disabled={!atDest} onClick={handleSubmit}>
              Submit Route
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 3: Executing ────────────────────────────────────────────────────
  if (phase === 'executing') {
    // waiting for API response
    if (!result) {
      return (
        <div className="page-center">
          <Spinner animation="border" variant="light" />
          <p className="text-secondary mt-3">Submitting your route…</p>
        </div>
      );
    }

    // invalid route screen
    if (!result.valid) {
      return (
        <div className="page-center">
          <div className="exec-invalid-card">
            <div className="exec-icon">🚫</div>
            <h2 className="h4 fw-bold">Invalid Route!</h2>
            <p className="text-secondary">Your route breaks the rules. All coins lost.</p>
            <div className="result-score" style={{ color: '#ef4444' }}>0</div>
          </div>
        </div>
      );
    }

    // valid route: step-by-step event reveal
    const currentEvent = eventIndex >= 0 ? result.events[eventIndex] : null;
    const processedSegs = result.events.slice(0, Math.max(0, eventIndex + 1)).map(e => ({
      fromId: e.segmentFrom, toId: e.segmentTo,
    }));

    return (
      <div className="game-executing">
        <div className="exec-header">
          <h2 className="h5 mb-0 fw-bold">🚇 Journey in progress…</h2>
          <span className="exec-progress">
            {Math.max(0, eventIndex + 1)} / {result.events.length} segments
          </span>
        </div>

        <NetworkMap
          network={network}
          showLines={false}
          startId={gameData?.start.id}
          destId={gameData?.destination.id}
          routeSegments={processedSegs}
        />

        <div className="exec-event-area">
          {currentEvent ? (
            <div className="exec-event-card">
              <div className="exec-segment-label">
                🚉 {stationName(currentEvent.segmentFrom)} → {stationName(currentEvent.segmentTo)}
              </div>
              <p className="exec-event-desc">"{currentEvent.description}"</p>
              <div className="exec-coins-row">
                <span className={`exec-effect ${currentEvent.coin_effect >= 0 ? 'positive' : 'negative'}`}>
                  {currentEvent.coin_effect >= 0 ? '+' : ''}{currentEvent.coin_effect} 🪙
                </span>
                <span className="exec-coins-total">{displayedCoins} coins remaining</span>
              </div>
            </div>
          ) : (
            <div className="exec-event-card loading-card">
              <Spinner animation="border" size="sm" variant="light" />
              <span className="ms-2 text-secondary">Boarding first segment…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase 4: Result ───────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div className="game-result">
        <div className="result-card">
          {result.valid ? (
            <>
              <div className="result-icon">🏁</div>
              <h2 className="h4 fw-bold mb-0">Journey Complete!</h2>
              <p className="text-secondary small mb-2">Final score</p>
              <div className="result-score">{result.score}</div>
              <p className="result-coins-label">coins</p>
            </>
          ) : (
            <>
              <div className="result-icon">❌</div>
              <h2 className="h4 fw-bold mb-0">Invalid Route</h2>
              <p className="text-secondary small mb-2">Score reset to 0</p>
              <div className="result-score" style={{ color: '#ef4444' }}>0</div>
              <p className="result-coins-label">coins</p>
            </>
          )}

          {/* event log — only for valid routes */}
          {result.valid && result.events.length > 0 && (
            <div className="event-log">
              <p className="event-log-title">Event log</p>
              {result.events.map((ev, i) => (
                <div key={i} className="event-log-row">
                  <span className="event-log-seg">
                    {stationName(ev.segmentFrom)} → {stationName(ev.segmentTo)}
                  </span>
                  <span className="event-log-desc">{ev.description}</span>
                  <span className={`event-log-effect ${ev.coin_effect >= 0 ? 'pos' : 'neg'}`}>
                    {ev.coin_effect >= 0 ? '+' : ''}{ev.coin_effect}
                  </span>
                  <span className="event-log-after">{ev.coinsAfter} 🪙</span>
                </div>
              ))}
            </div>
          )}

          <div className="result-actions">
            <Button className="btn-accent px-4" onClick={restart}>Play Again</Button>
            {user && (
              <Button variant="outline-light" onClick={() => navigate('/ranking')}>
                View Ranking
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default GamePage;
