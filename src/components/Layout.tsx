import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Package,
  ShoppingCart,
  BarChart3,
  UserCheck,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'barber')[];
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'barber'] },
  { name: 'Agendamentos', path: '/agendamentos', icon: Calendar, roles: ['admin'] },
  { name: 'Meus Agendamentos', path: '/meus-agendamentos', icon: Calendar, roles: ['barber'] },
  { name: 'Clientes', path: '/clientes', icon: Users, roles: ['admin', 'barber'] },
  { name: 'Barbeiros', path: '/barbeiros', icon: UserCheck, roles: ['admin'] },
  { name: 'Serviços', path: '/servicos', icon: Scissors, roles: ['admin'] },
  { name: 'Produtos', path: '/produtos', icon: Package, roles: ['admin'] },
  { name: 'Vendas', path: '/vendas', icon: ShoppingCart, roles: ['admin', 'barber'] },
  { name: 'Despesas', path: '/despesas', icon: Receipt, roles: ['admin'] },
  { name: 'Relatórios', path: '/relatorios', icon: BarChart3, roles: ['admin'] },
  { name: 'Minhas Comissões', path: '/minhas-comissoes', icon: BarChart3, roles: ['barber'] },
];

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || 'barber')
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
          <h1 className="text-xl font-bold">BarberShop</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-8">
          <div className="px-4 space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex-1 lg:ml-0 ml-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {menuItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};