// Shown to anonymous users — just instructions
function HomePage() {
  return (
    <div className="page-center">
      <h1 className="display-5 fw-bold mb-3">Last Race</h1>
      <p className="lead text-secondary mb-4">
        A transit network strategy game. Plan your route, survive the journey.
      </p>
      <div className="instructions-card">
        <h2 className="h5 mb-3">How to play</h2>
        <ol className="text-start">
          <li>Study the transit map during the <strong>Setup</strong> phase.</li>
          <li>In the <strong>Planning</strong> phase (90 seconds), select segments to build a route from your start to your destination.</li>
          <li>Each segment triggers a random <strong>event</strong> that adds or removes coins. You start with <strong>20 coins</strong>.</li>
          <li>An invalid route costs you everything — score drops to <strong>0</strong>.</li>
          <li>Your final score is saved to the <strong>global ranking</strong>.</li>
        </ol>
        <p className="mt-3 text-secondary small">
          Log in to play and see the leaderboard.
        </p>
      </div>
    </div>
  );
}

export default HomePage;
