import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    icon: '🗺️',
    title: 'Study the map',
    desc: 'During the Setup phase, explore the full transit network — lines, stations, and interchanges.',
  },
  {
    icon: '⏱️',
    title: 'Plan your route',
    desc: 'You have 90 seconds to select segments and build a path from your start to your destination.',
  },
  {
    icon: '🎲',
    title: 'Survive the journey',
    desc: 'Each segment triggers a random event. You start with 20 coins — events add or subtract up to 4.',
  },
  {
    icon: '🏆',
    title: 'Claim your score',
    desc: 'A valid route saves your final coin count. An invalid route scores 0. Logged-in scores hit the ranking.',
  },
];

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-hero">
        <span className="home-icon">🚇</span>
        <h1 className="display-5 fw-bold mb-2">Last Race</h1>
        <Button
          className="btn-accent mt-3 px-4 py-2"
          onClick={() => navigate('/login')}
        >
          Log in to play →
        </Button>
      </div>

      <div className="steps-grid">
        {steps.map((s) => (
          <div key={s.title} className="step-card">
            <div className="step-icon">{s.icon}</div>
            <h2 className="h6 fw-semibold mb-1">{s.title}</h2>
            <p className="text-secondary small mb-0">{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-secondary small mt-4">
        Line changes are only allowed at <strong>interchange stations</strong>.
        Plan carefully, a broken route loses everything.
      </p>
    </div>
  );
}

export default HomePage;
