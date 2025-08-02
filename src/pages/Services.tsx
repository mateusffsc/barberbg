import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw } from 'lucide-react';
import { useServices } from '../hooks/useServices';
import { ServicesTable } from '../components/services/ServicesTable';
import { ServiceModal } from '../components/services/ServiceModal';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Service, ServiceFormData } from '../types/service';
import toast, { Toaster } from 'react-hot-toast';

export const Services: React.FC = () => {
  const {
    services,
    setServices,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchServices,
    createService,
    updateService,
    deleteService
  } = useServices();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    loadServices();
  }, [currentPage, search]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const result = await fetchServices(currentPage, search, pageSize);
      setServices(result.services);
      setTotalCount(result.count);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleNewService = () => {
    setSelectedService(null);
    setIsModalOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service);
    setIsConfirmDialogOpen(true);
  };

  const handleModalSubmit = async (formData: ServiceFormData) => {
    setModalLoading(true);
    try {
      if (selectedService) {
        const updatedService = await updateService(selectedService.id, formData);
        if (updatedService) {
          setServices(prev => 
            prev.map(service => 
              service.id === selectedService.id ? updatedService : service
            )
          );
        }
      } else {
        const newService = await createService(formData);
        if (newService) {
          await loadServices();
        }
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;

    setDeleteLoading(true);
    try {
      const success = await deleteService(serviceToDelete.id);
      if (success) {
        setServices(prev => prev.filter(service => service.id !== serviceToDelete.id));
        setTotalCount(prev => prev - 1);
        
        if (services.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
      }
    } finally {
      setDeleteLoading(false);
      setIsConfirmDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
          <p className="text-gray-600">Gerencie os serviços oferecidos pela barbearia</p>
        </div>
        <button
          onClick={handleNewService}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
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
                placeholder="Buscar serviços..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={loadServices}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <ServicesTable
        services={services}
        loading={loading}
        onEdit={handleEditService}
        onDelete={handleDeleteService}
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

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        service={selectedService}
        loading={modalLoading}
      />

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Serviço"
        message={`Tem certeza que deseja excluir o serviço "${serviceToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
};