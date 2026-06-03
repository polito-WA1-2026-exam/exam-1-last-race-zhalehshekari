import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { getNetwork, getGameStart, submitRoute, saveScore } from '../api';
import { useAuth } from '../contexts/AuthContext';
import NetworkMap from '../components/NetworkMap';

function GamePage() {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,    setPhase]    = useState('loading');
  const [network,  setNetwork]  = useState(null);
  const [gameData, setGameData] = useState(null);   // { start, destination }
  const [route,    setRoute]    = useState([]);      // [{ fromId, toId, lineId }]
  const [currentId, setCurrentId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const [result,   setResult]   = useState(null);   // server response after submit
  const [error,    setError]    = useState('');

  // refs to read latest values inside timer callbacks
  const routeRef    = useRef([]);
  const gameDataRef = useRef(null);
  const hasSubmitted = useRef(false);

  useEffect(() => { routeRef.current = route;    }, [route]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);

  // ── Load network on mount ──────────────────────────────────────────────────
  useEffect(() => {
    getNetwork()
      .then(data => { setNetwork(data); setPhase('setup'); })
      .catch(() => setError('Could not load the transit network.'));
  }, []);

  // ── Phase 1 → Phase 2 ──────────────────────────────────────────────────────
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

  // ── Timer (Phase 2) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'planning' || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft]);

  // auto-submit when timer hits 0
  useEffect(() => {
    if (phase === 'planning' && timeLeft === 0) handleSubmit();
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit route ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setPhase('executing');

    const gd = gameDataRef.current;
    const r  = routeRef.current;

    try {
      const res = await submitRoute(gd.start.id, gd.destination.id, r);
      // save score only if logged in and result is a number
      if (user && typeof res.score === 'number') {
        await saveScore(res.score).catch(() => {}); // non-fatal
      }
      setResult(res);
      setPhase('result');
    } catch {
      setError('Route submission failed.');
      setPhase('setup');
    }
  }, [user]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const stationName = (id) =>
    network?.stations.find(s => s.id === id)?.name ?? id;

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
        <Button className="btn-accent" onClick={() => window.location.reload()}>
          Retry
        </Button>
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
            Interchange stations (ringed circles) are where you can switch lines.
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
    const moves       = getAvailableMoves();
    const atDest      = currentId === gameData?.destination.id;
    const timerPct    = (timeLeft / 90) * 100;
    const timerColor  = timeLeft > 30 ? '#22c55e' : timeLeft > 10 ? '#f59e0b' : '#ef4444';

    return (
      <div className="game-planning">
        {/* Top bar: goal + timer */}
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

        {/* Map (no line colors) */}
        <NetworkMap
          network={network}
          showLines={false}
          startId={gameData.start.id}
          destId={gameData.destination.id}
          currentId={currentId}
          routeSegments={route}
        />

        {/* Segment selector + route */}
        <div className="planning-controls">
          <div className="next-moves">
            <p className="small text-secondary mb-2 fw-semibold">
              {atDest ? '✅ Destination reached!' : `From ${stationName(currentId)}, go to:`}
            </p>
            <div className="moves-list">
              {!atDest && moves.map(move => (
                <button
                  key={move.toId}
                  className="move-btn"
                  onClick={() => addSegment(move)}
                >
                  {stationName(move.toId)}
                </button>
              ))}
            </div>
          </div>

          {/* Built route display */}
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

          {/* Action buttons */}
          <div className="planning-actions">
            {route.length > 0 && (
              <button className="undo-btn" onClick={undoSegment}>↩ Undo</button>
            )}
            <Button
              className="btn-accent"
              disabled={!atDest}
              onClick={handleSubmit}
            >
              Submit Route
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 3: Executing (animated in Step 7) ───────────────────────────────
  if (phase === 'executing') {
    return (
      <div className="page-center">
        <Spinner animation="border" variant="light" />
        <p className="text-secondary mt-3">Validating your route…</p>
      </div>
    );
  }

  // ── Phase 4: Result (enhanced in Step 7) ─────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div className="page-center">
        <div className="result-card">
          {result.valid ? (
            <>
              <div className="result-icon">🏁</div>
              <h2 className="h4 fw-bold">Route Complete!</h2>
              <p className="text-secondary">Final score:</p>
              <div className="result-score">{result.score}</div>
              <p className="text-secondary small">coins remaining</p>
            </>
          ) : (
            <>
              <div className="result-icon">❌</div>
              <h2 className="h4 fw-bold">Invalid Route</h2>
              <p className="text-secondary">
                Your route was invalid — score is <strong>0</strong>.
              </p>
            </>
          )}
          <Button className="btn-accent mt-4 px-4" onClick={restart}>
            Play Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default GamePage;
