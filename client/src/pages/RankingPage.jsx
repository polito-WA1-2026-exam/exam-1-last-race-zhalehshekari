import { useState, useEffect } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import dayjs from 'dayjs';
import { getRanking } from '../api';
import { useAuth } from '../contexts/AuthContext';

function RankingPage() {
  const { user }              = useAuth();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getRanking()
      .then(setRanking)
      .catch(() => setError('Could not load ranking.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ranking-page">
      <h1 className="h3 fw-bold mb-1">🏆 Leaderboard</h1>
      <p className="text-secondary mb-4">All-time scores, best first.</p>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="light" />
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && ranking.length === 0 && (
        <p className="text-secondary">No scores yet — be the first!</p>
      )}

      {!loading && !error && ranking.length > 0 && (
        <div className="ranking-table-wrap">
          <Table className="ranking-table" responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, i) => {
                const isMe = user && entry.username === user.username;
                return (
                  <tr key={i} className={isMe ? 'ranking-me' : ''}>
                    <td className="rank-pos">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td>
                      {entry.username}
                      {isMe && <span className="badge-me ms-2">you</span>}
                    </td>
                    <td className="rank-score">{entry.score}</td>
                    <td className="text-secondary small">
                      {dayjs(entry.played_at).format('MMM D, YYYY')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default RankingPage;
