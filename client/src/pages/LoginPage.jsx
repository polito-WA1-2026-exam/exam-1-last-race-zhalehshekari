import { useState } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/game');
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <h1 className="h3 mb-1 fw-bold">Welcome back</h1>
      <p className="text-secondary mb-4">Log in to play and see the ranking.</p>

      <div className="login-card">
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="login-username">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              placeholder="your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="dark-input"
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="login-password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="dark-input"
            />
          </Form.Group>

          <Button
            type="submit"
            className="w-100 btn-accent"
            disabled={loading}
          >
            {loading ? <Spinner size="sm" animation="border" /> : 'Log in'}
          </Button>
        </Form>
      </div>
    </div>
  );
}

export default LoginPage;
