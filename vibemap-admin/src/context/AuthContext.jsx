import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  useEffect(() => {
    if (token) {
      localStorage.setItem('adminToken', token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await client.post('/admin/login', { email, password });
      setToken(response.data.access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message || 'Login failed' };
    }
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
