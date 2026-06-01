import { createContext, useContext, useState, useEffect } from 'react';
import { getSession, login as apiLogin, logout as apiLogout } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = not yet checked, false = anonymous, object = logged-in user
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // check existing session on first mount
  useEffect(() => {
    getSession()
      .then(setUser)
      .catch(() => setUser(false))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const u = await apiLogin(username, password);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await apiLogout();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// convenient hook
export function useAuth() {
  return useContext(AuthContext);
}
