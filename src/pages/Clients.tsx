import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { ClientsTable } from '../components/clients/ClientsTable';
import { ClientModal } from '../components/clients/ClientModal';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ClientHistoryModal } from '../components/appointments/ClientHistoryModal';
import { Client, ClientFormData } from '../types/client';
import toast, { Toaster } from 'react-hot-toast';

export const Clients: React.FC = () => {
  const {
    clients,
    setClients,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchClients,
    createClient,
    updateClient,
    deleteClient
  } = useClients();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    loadClients();
  }, [currentPage, search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const result = await fetchClients(currentPage, search, pageSize);
      setClients(result.clients);
      setTotalCount(result.count);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleNewClient = () => {
    setSelectedClient(null);
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleViewHistory = (client: Client) => {
    setSelectedClientId(client.id);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setIsConfirmDialogOpen(true);
  };

  const handleModalSubmit = async (formData: ClientFormData) => {
    setModalLoading(true);
    try {
      if (selectedClient) {
        const updatedClient = await updateClient(selectedClient.id, formData);
        if (updatedClient) {
          setClients(prev => 
            prev.map(client => 
              client.id === selectedClient.id ? updatedClient : client
            )
          );
        }
      } else {
        const newClient = await createClient(formData);
        if (newClient) {
          await loadClients(); // Recarrega a lista para manter a paginação
        }
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;

    setDeleteLoading(true);
    try {
      const success = await deleteClient(clientToDelete.id);
      if (success) {
        setClients(prev => prev.filter(client => client.id !== clientToDelete.id));
        setTotalCount(prev => prev - 1);
        
        // Se a página atual ficou vazia e não é a primeira, volta uma página
        if (clients.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
      }
    } finally {
      setDeleteLoading(false);
      setIsConfirmDialogOpen(false);
      setClientToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gerencie os clientes da barbearia</p>
        </div>
        <button
          onClick={handleNewClient}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={loadClients}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Table */}
      <ClientsTable
        clients={clients}
        loading={loading}
        onEdit={handleEditClient}
        onViewHistory={handleViewHistory}
        onDelete={handleDeleteClient}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalCount}
          itemsPerPage={pageSize}
        />
      )}

      {/* Modal */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        client={selectedClient}
        loading={modalLoading}
      />

      <ClientHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedClientId(null);
        }}
        clientId={selectedClientId}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir o cliente "${clientToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
};