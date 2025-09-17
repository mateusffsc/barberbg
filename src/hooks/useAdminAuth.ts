import { useState, useEffect } from 'react';

export const useAdminAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tempo de expiração da sessão admin (2 horas)
  const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 horas em milliseconds

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = () => {
    const adminAccess = sessionStorage.getItem('adminAccess');
    const adminAccessTime = sessionStorage.getItem('adminAccessTime');

    if (adminAccess === 'true' && adminAccessTime) {
      const accessTime = parseInt(adminAccessTime);
      const currentTime = Date.now();
      
      // Verificar se a sessão ainda é válida
      if (currentTime - accessTime < SESSION_DURATION) {
        setIsAuthenticated(true);
      } else {
        // Sessão expirada, limpar dados
        clearAdminAuth();
      }
    }
    
    setIsLoading(false);
  };

  const authenticate = () => {
    sessionStorage.setItem('adminAccess', 'true');
    sessionStorage.setItem('adminAccessTime', Date.now().toString());
    setIsAuthenticated(true);
  };

  const clearAdminAuth = () => {
    sessionStorage.removeItem('adminAccess');
    sessionStorage.removeItem('adminAccessTime');
    setIsAuthenticated(false);
  };

  const logout = () => {
    clearAdminAuth();
  };

  return {
    isAuthenticated,
    isLoading,
    authenticate,
    logout,
    checkAdminAuth
  };
};