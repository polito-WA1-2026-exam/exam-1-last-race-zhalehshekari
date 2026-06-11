import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../contexts/useAuth';

function ResultPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  // If the user navigated here directly (no state), send them back to the game
  if (!state?.result) {
    navigate('/game', { replace: true });
    return null;
  }

  const { result, network } = state;

  // Resolve a station ID to its display name using the network passed from GamePage
  const stationName = (id) =>
    network?.stations.find(s => s.id === id)?.name ?? String(id);

  return (
    <div className="game-result">
      <div className="result-card">
        {result.valid ? (
          <>
            <div className="result-icon">🏁</div>
            <h1 className="h4 fw-bold mb-0">Journey Complete!</h1>
            <p className="text-secondary small mb-2">Final score</p>
            <div className="result-score">{result.score}</div>
            <p className="result-coins-label">coins</p>
          </>
        ) : (
          <>
            <div className="result-icon">❌</div>
            <h1 className="h4 fw-bold mb-0">Invalid Route</h1>
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
          <Button className="btn-accent px-4" onClick={() => navigate('/game')}>
            Play Again
          </Button>
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

export default ResultPage;
