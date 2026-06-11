import { useState, useEffect } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import dayjs from 'dayjs';
import { getRanking } from '../api';
import { useAuth } from '../contexts/useAuth';

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

  // Keep only the highest score for each unique player
  const uniqueRanking = [];
  const seenUsers = new Set();
  for (const entry of ranking) {
    if (!seenUsers.has(entry.username)) {
      seenUsers.add(entry.username);
      uniqueRanking.push(entry);
    }
  }

  const totalPlayers = uniqueRanking.length;

  return (
    <div className="ranking-page py-4">
      <div className="text-center mb-5">
        <h1 className="h2 fw-bold mb-2 text-gradient">🏆 Leaderboard</h1>
        <p className="text-muted-custom fs-5">Compare your best performance with other players</p>
      </div>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      )}

      {error && <Alert variant="danger" className="border-0 rounded-3 shadow-sm">{error}</Alert>}

      {!loading && !error && (
        <>
          {/* Leaderboard Table */}
          {totalPlayers === 0 ? (
            <div className="text-center py-5 rounded-4 shadow-sm border border-dashed border-secondary">
              <p className="text-muted-custom fs-5 mb-0">No scores yet — be the first to play!</p>
            </div>
          ) : (
            <div className="ranking-table-container shadow-lg">
              <Table className="ranking-table align-middle" responsive>
                <thead>
                  <tr>
                    <th className="text-center py-3" style={{ width: '80px' }}>Rank</th>
                    <th className="py-3">Player</th>
                    <th className="text-center py-3" style={{ width: '120px' }}>Score</th>
                    <th className="text-end py-3 pe-4" style={{ width: '180px' }}>Date Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueRanking.map((entry, i) => {
                    const isMe = user && entry.username === user.username;
                    const rankNum = i + 1;
                    
                    let rowClass = "";
                    if (isMe) rowClass = "ranking-row-me";
                    else if (rankNum === 1) rowClass = "ranking-row-gold";
                    else if (rankNum === 2) rowClass = "ranking-row-silver";
                    else if (rankNum === 3) rowClass = "ranking-row-bronze";

                    return (
                      <tr key={i} className={`ranking-row ${rowClass}`}>
                        <td className="text-center">
                          {rankNum === 1 ? (
                            <span className="rank-badge gold-badge">🥇</span>
                          ) : rankNum === 2 ? (
                            <span className="rank-badge silver-badge">🥈</span>
                          ) : rankNum === 3 ? (
                            <span className="rank-badge bronze-badge">🥉</span>
                          ) : (
                            <span className="rank-number">{rankNum}</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <span className={`player-name ${isMe ? 'fw-bold text-accent' : 'fw-medium text-light-custom'}`}>
                              {entry.username}
                            </span>
                            {isMe && <span className="badge-me ms-2">you</span>}
                          </div>
                        </td>
                        <td className="text-center font-monospace fw-bold rank-score-val">
                          {entry.score}
                        </td>
                        <td className="text-end text-muted-custom small pe-4">
                          {dayjs(entry.played_at).format('MMM D, YYYY')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RankingPage;
