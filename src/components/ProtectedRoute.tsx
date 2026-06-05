import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  deniedUserIds?: number[];
  deniedBarberIds?: number[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  deniedUserIds,
  deniedBarberIds
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (deniedUserIds?.includes(user.id)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (deniedBarberIds && user.barber?.id && deniedBarberIds.includes(user.barber.id)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
