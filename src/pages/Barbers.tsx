import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw } from 'lucide-react';
import { useBarbers } from '../hooks/useBarbers';
import { BarbersTable } from '../components/barbers/BarbersTable';
import { BarberModal } from '../components/barbers/BarberModal';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BarberReportModal } from '../components/appointments/BarberReportModal';
import { Barber, BarberFormData, BarberUpdateData } from '../types/barber';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminPasswordModal } from '../components/ui/AdminPasswordModal';
import toast, { Toaster } from 'react-hot-toast';

export const Barbers: React.FC = () => {
  const { isAuthenticated, authenticate, loading: authLoading } = useAdminAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const {
    barbers,
    setBarbers,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchBarbers,
    createBarber,
    updateBarber,
    toggleBarberStatus,
    deleteBarber
  } = useBarbers();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [barberToDelete, setBarberToDelete] = useState<Barber | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setShowPasswordModal(true);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBarbers();
    }
  }, [currentPage, search, isAuthenticated]);

  const loadBarbers = async () => {
    setLoading(true);
    try {
      const result = await fetchBarbers(currentPage, search, pageSize);
      setBarbers(result.barbers);
      setTotalCount(result.count);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleNewBarber = () => {
    setSelectedBarber(null);
    setIsModalOpen(true);
  };

  const handleEditBarber = (barber: Barber) => {
    setSelectedBarber(barber);
    setIsModalOpen(true);
  };

  const handleViewReport = (barber: Barber) => {
    setSelectedBarberId(barber.id);
    setIsReportModalOpen(true);
  };

  const handleDeleteBarber = (barber: Barber) => {
    setBarberToDelete(barber);
    setIsConfirmDialogOpen(true);
  };

  const handleToggleStatus = async (barber: Barber) => {
    await toggleBarberStatus(barber.id, barber.user_id, true);
  };

  const handleModalSubmit = async (formData: BarberFormData | BarberUpdateData) => {
    setModalLoading(true);
    try {
      if (selectedBarber) {
        const updatedBarber = await updateBarber(selectedBarber.id, formData as BarberUpdateData);
        if (updatedBarber) {
          setBarbers(prev => 
            prev.map(barber => 
              barber.id === selectedBarber.id ? updatedBarber : barber
            )
          );
        }
      } else {
        const newBarber = await createBarber(formData as BarberFormData);
        if (newBarber) {
          await loadBarbers();
        }
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!barberToDelete) return;

    setDeleteLoading(true);
    try {
      const success = await deleteBarber(barberToDelete.id, barberToDelete.user_id);
      if (success) {
        setBarbers(prev => prev.filter(barber => barber.id !== barberToDelete.id));
        setTotalCount(prev => prev - 1);
        
        if (barbers.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
      }
    } finally {
      setDeleteLoading(false);
      setIsConfirmDialogOpen(false);
      setBarberToDelete(null);
    }
  };

  if (authLoading || (loading && !isAuthenticated)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <AdminPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            authenticate();
            setShowPasswordModal(false);
          }}
          title="Acesso ao Gerenciamento de Barbeiros"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Barbeiros</h1>
          <p className="text-gray-600">Gerencie os barbeiros da equipe</p>
        </div>
        <button
          onClick={handleNewBarber}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Barbeiro
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={loadBarbers}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <BarbersTable
        barbers={barbers}
        loading={loading}
        onEdit={handleEditBarber}
        onViewReport={handleViewReport}
        onDelete={handleDeleteBarber}
        onToggleStatus={handleToggleStatus}
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalCount}
          itemsPerPage={pageSize}
        />
      )}

      <BarberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        barber={selectedBarber}
        loading={modalLoading}
      />

      <BarberReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedBarberId(null);
        }}
        barberId={selectedBarberId}
      />

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Barbeiro"
        message={`Tem certeza que deseja excluir o barbeiro "${barberToDelete?.name}"? Esta ação também removerá o usuário associado e não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleteLoading}
      />

      <AdminPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          authenticate();
          setShowPasswordModal(false);
        }}
        title="Acesso ao Gerenciamento de Barbeiros"
      />
    </div>
  );
};