import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Search, RefreshCw, Filter } from 'lucide-react';
import { Pagination } from '../components/ui/Pagination';
import { formatDateTimeBR } from '../utils/dateHelpers';

interface AuditLog {
  id: string;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
  user?: {
    username: string;
    role: string;
  };
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const pageSize = 15;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, search]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          user:users(username, role)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%,details.ilike.%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) {
        // Se a tabela não existir ainda, apenas retornamos vazio em vez de crashar a tela
        if (error.code === '42P01') {
          console.warn('Tabela audit_logs não existe ainda.');
          setLogs([]);
          setTotalCount(0);
        } else {
          throw error;
        }
      } else {
        setLogs(data as any || []);
        setTotalCount(count || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'CANCEL': return 'bg-orange-100 text-orange-800';
      case 'STATUS_CHANGE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      appointment: 'Agendamento',
      client: 'Cliente',
      barber: 'Barbeiro',
      sale: 'Venda',
      service: 'Serviço',
      product: 'Produto',
      schedule_block: 'Bloqueio de Agenda'
    };
    return labels[entity] || entity;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-6 w-6 mr-2" />
            Auditoria do Sistema
          </h1>
          <p className="text-gray-600">Registro de atividades e alterações realizadas pelos usuários</p>
        </div>
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
                placeholder="Buscar em ações, entidades ou detalhes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Módulo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTimeBR(new Date(log.created_at))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-white">
                            {log.user?.username?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{log.user?.username || 'Desconhecido'}</p>
                          <p className="text-xs text-gray-500 capitalize">{log.user?.role || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {getEntityLabel(log.entity_type)}
                      <span className="ml-1 text-xs text-gray-500">#{log.entity_id}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalCount}
              itemsPerPage={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};