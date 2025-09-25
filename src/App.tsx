import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Unauthorized } from './pages/Unauthorized';
import { Clients } from './pages/Clients';
import { ClientRegistration } from './pages/ClientRegistration';
import { Services } from './pages/Services';
import { Products } from './pages/Products';
import { Barbers } from './pages/Barbers';
import { Appointments } from './pages/Appointments';
import { Sales } from './pages/Sales';
import { Reports } from './pages/Reports';
import { MyReports } from './pages/MyReports';
import { Expenses } from './pages/Expenses';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/cadastrodeclientes" element={<ClientRegistration />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            
            {/* Admin only routes */}
            <Route path="agendamentos" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Appointments />
              </ProtectedRoute>
            } />
            
            <Route path="barbeiros" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Barbers />
              </ProtectedRoute>
            } />
            
            <Route path="servicos" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Services />
              </ProtectedRoute>
            } />
            
            <Route path="produtos" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Products />
              </ProtectedRoute>
            } />
            
            <Route path="relatorios" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Reports />
              </ProtectedRoute>
            } />
            
            <Route path="despesas" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Expenses />
              </ProtectedRoute>
            } />

            {/* Barber only routes */}
            <Route path="meus-agendamentos" element={
              <ProtectedRoute allowedRoles={['barber']}>
                <Appointments />
              </ProtectedRoute>
            } />
            
            <Route path="minhas-comissoes" element={
              <ProtectedRoute allowedRoles={['barber']}>
                <MyReports />
              </ProtectedRoute>
            } />

            {/* Shared routes */}
            <Route path="clientes" element={
              <Clients />
            } />
            
            <Route path="vendas" element={
              <Sales />
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;