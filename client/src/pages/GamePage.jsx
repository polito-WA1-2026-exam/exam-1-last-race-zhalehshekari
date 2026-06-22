import { useState, useEffect, useRef } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getNetwork, getGameStart, submitRoute, saveScore } from '../api';
import { useAuth } from '../contexts/useAuth';
import NetworkMap from '../components/NetworkMap';

// Fisher-Yates shuffle — module-level to keep Math.random() out of render.
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function GamePage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  // State
  const [phase,        setPhase]        = useState('loading');
  const [network,      setNetwork]      = useState(null);
  const [gameData,     setGameData]     = useState(null);
  const [route,        setRoute]        = useState([]);     // [{ fromId, toId, lineId }]
  const [currentId,    setCurrentId]    = useState(null);
  const [timeLeft,     setTimeLeft]     = useState(90);
  const [result,       setResult]       = useState(null);
  const [eventIndex,   setEventIndex]   = useState(-1);
  const [shuffledSegs, setShuffledSegs] = useState([]);
  const [error,        setError]        = useState('');

  // Refs — keep latest values accessible inside async/timer closures.
  const routeRef     = useRef([]);
  const gameDataRef  = useRef(null);
  const userRef      = useRef(user);
  const hasSubmitted = useRef(false);

  useEffect(() => { routeRef.current    = route;    }, [route]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);
  useEffect(() => { userRef.current     = user;     }, [user]);

  // Submit route (defined before effects that reference it).
  const handleSubmit = async () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setPhase('executing');
    setEventIndex(-1);

    const gd = gameDataRef.current;
    const r  = routeRef.current;

    try {
      const res = await submitRoute(gd.start.id, gd.destination.id, r);
      if (userRef.current && typeof res.score === 'number') {
        await saveScore(res.score).catch(() => {}); // non-fatal
      }
      setResult(res);
    } catch {
      setError('Route submission failed.');
      setPhase('setup');
    }
  };

  // Load network map data on mount.
  useEffect(() => {
    getNetwork()
      .then(data => { setNetwork(data); setPhase('setup'); })
      .catch(() => setError('Could not load the transit network.'));
  }, []);

  // Countdown timer — auto-submits at 0.
  useEffect(() => {
    if (phase !== 'planning' || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase === 'planning' && timeLeft === 0) handleSubmit();
  }, [phase, timeLeft]);


  // Step-by-step execution animation.
  useEffect(() => {
    if (phase !== 'executing' || !result) return;

    if (!result.valid) {
      const t = setTimeout(() => navigate('/result', { state: { result, gameData: gameDataRef.current, network } }), 2000);
      return () => clearTimeout(t);
    }

    if (eventIndex < result.events.length - 1) {
      const delay = eventIndex === -1 ? 700 : 1800;
      const t = setTimeout(() => setEventIndex(i => i + 1), delay);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => navigate('/result', { state: { result, gameData: gameDataRef.current, network } }), 1200);
    return () => clearTimeout(t);
  }, [phase, eventIndex, result, navigate, network]);

  // Helpers
  const stationName = (id) =>
    network?.stations.find(s => s.id === id)?.name ?? String(id);

  // True if this segment (either direction) is already in the route.
  const isSegmentUsed = (seg) =>
    route.some(r =>
      (r.fromId === seg.from_station_id && r.toId === seg.to_station_id) ||
      (r.fromId === seg.to_station_id   && r.toId === seg.from_station_id)
    );

  // Append a segment to the route, resolving travel direction from currentId.
  // Disconnected clicks are stored in DB order and rejected by the server.
  const clickSegment = (seg) => {
    if (isSegmentUsed(seg)) return;

    let fromId, toId;
    if (seg.from_station_id === currentId) {
      fromId = seg.from_station_id;
      toId   = seg.to_station_id;
    } else if (seg.to_station_id === currentId) {
      fromId = seg.to_station_id;
      toId   = seg.from_station_id;
    } else {
      fromId = seg.from_station_id;
      toId   = seg.to_station_id;
    }

    setRoute(prev => [...prev, { fromId, toId, lineId: seg.line_id }]);
    setCurrentId(toId);
  };

  const undoSegment = () => {
    const next = route.slice(0, -1);
    setRoute(next);
    setCurrentId(next.length > 0 ? next[next.length - 1].toId : gameData?.start.id ?? null);
  };

  const startPlanning = async () => {
    setError('');
    try {
      const data = await getGameStart();
      setGameData(data);
      setCurrentId(data.start.id);
      setRoute([]);
      setTimeLeft(90);
      hasSubmitted.current = false;
      setShuffledSegs(shuffleArray(network.segments));
      setPhase('planning');
    } catch {
      setError('Could not start the game. Please try again.');
    }
  };

  // Current coin balance shown during execution animation.
  const displayedCoins = eventIndex >= 0 && result?.events[eventIndex]
    ? result.events[eventIndex].coinsAfter
    : 20;

  // Render

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

        {/* two-column body: map left, controls right */}
        <div className="planning-body">
          {/* map — stations only, lines hidden */}
          <div className="planning-map-col">
            <NetworkMap
              network={network}
              showLines={false}
              startId={gameData.start.id}
              destId={gameData.destination.id}
              currentId={currentId}
              routeSegments={route}
            />
          </div>

          <div className="planning-controls">
            <p className="small text-secondary fw-semibold mb-2">
              Select segments to build your route:
            </p>
            <div className="seg-list">
              {shuffledSegs.map(seg => {
                const used = isSegmentUsed(seg);
                return (
                  <button
                    key={seg.id}
                    className={`seg-list-item ${used ? 'seg-used' : 'seg-connectable'}`}
                    onClick={() => clickSegment(seg)}
                    disabled={used}
                  >
                    <span className="seg-dot" />
                    {stationName(seg.from_station_id)}
                    <span className="seg-dash"> — </span>
                    {stationName(seg.to_station_id)}
                    {used && <span className="seg-check">✓</span>}
                  </button>
                );
              })}
            </div>


            <div className="planning-actions">
              {route.length > 0 && (
                <button className="undo-btn" onClick={undoSegment}>↩ Undo last</button>
              )}
              <Button className="btn-accent" onClick={handleSubmit}>
                Submit Route
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Phase 3: Executing
  if (phase === 'executing') {
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
        {/* full-width header */}
        <div className="exec-header">
          <h2 className="h5 mb-0 fw-bold">🚇 Journey in progress…</h2>
          <span className="exec-progress">
            {Math.max(0, eventIndex + 1)} / {result.events.length} segments
          </span>
        </div>

        {/* two-column body: map left, event panel right */}
        <div className="exec-body">
          <div className="exec-map-col">
            <NetworkMap
              network={network}
              showLines={false}
              startId={gameData?.start.id}
              destId={gameData?.destination.id}
              routeSegments={processedSegs}
            />
          </div>

          <div className="exec-panel-col">
            {/* coin counter */}
            <div className="exec-coins-banner">
              <span className="exec-coins-icon">🪙</span>
              <span className="exec-coins-value">{displayedCoins}</span>
              <span className="exec-coins-label">coins</span>
            </div>

            {/* current event card */}
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
                    <span className="exec-coins-total">{displayedCoins} remaining</span>
                  </div>
                </div>
              ) : (
                <div className="exec-event-card loading-card">
                  <Spinner animation="border" size="sm" variant="light" />
                  <span className="ms-2 text-secondary">Boarding first segment…</span>
                </div>
              )}
            </div>

            {/* mini progress dots */}
            <div className="exec-dots">
              {result.events.map((_, i) => (
                <span
                  key={i}
                  className={`exec-dot ${i <= eventIndex ? 'exec-dot-done' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default GamePage;
