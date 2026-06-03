import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';

import AppNavbar from './components/AppNavbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RankingPage from './pages/RankingPage';
import GamePage from './pages/GamePage';

// redirect to / if not logged in
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
}

// redirect to /game if already logged in (for the login page)
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/game" replace />;
}

function AppRoutes() {
  const { loading } = useAuth();

  // wait for session check before rendering routes
  if (loading) {
    return (
      <div className="page-center text-secondary">Loading…</div>
    );
  }

  return (
    <>
      <AppNavbar />
      <Container className="main-container" as="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <RankingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
