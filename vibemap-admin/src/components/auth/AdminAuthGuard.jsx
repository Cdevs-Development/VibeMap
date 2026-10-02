import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function AdminAuthGuard({ children }) {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);

  // Safely decode JWT payload without external libraries
  const decodeJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    // Proactively verify token presence and sync state
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          throw new Error('No token found');
        }
        
        // Strictly enforce AuthContext state
        if (!isAuthenticated) {
          throw new Error('Context state mismatch');
        }

        // Validate Role Claims
        const payload = decodeJwt(token);
        if (!payload) {
          throw new Error('Invalid JWT format');
        }

        if (payload.role !== 'admin' && payload.is_admin !== true) {
          throw new Error('Insufficient permissions: Admin role required');
        }

        setIsVerifying(false);
      } catch (error) {
        console.warn('Auth verification failed:', error.message);
        logout(); // Force clean state
        setIsVerifying(false);
      }
    };

    verifyAuth();
  }, [isAuthenticated, logout]);

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-ops-950 text-slate-400">
        <ShieldAlert size={48} className="text-rose-500 mb-4 animate-pulse" />
        <p className="text-sm font-medium tracking-widest uppercase">Verifying Admin Credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
