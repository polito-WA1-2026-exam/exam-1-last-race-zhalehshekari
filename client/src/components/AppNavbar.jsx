import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

function AppNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <Navbar bg="dark" variant="dark" expand="md" className="app-navbar">
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="fw-bold">
          🚇 Last Race
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto align-items-md-center gap-2">
            {user ? (
              <>
                <Nav.Link as={NavLink} to="/game">Play</Nav.Link>
                <Nav.Link as={NavLink} to="/ranking">Ranking</Nav.Link>
                <span className="text-secondary small d-none d-md-inline">
                  {user.username}
                </span>
                <Button size="sm" variant="outline-light" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;
