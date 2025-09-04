import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, UserCheck, Lock, Percent } from 'lucide-react';
import { Barber, BarberFormData, BarberUpdateData } from '../../types/barber';
import { formatPhone, validateEmail } from '../../utils/formatters';

interface BarberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BarberFormData | BarberUpdateData) => Promise<void>;
  barber?: Barber | null;
  loading?: boolean;
}

export const BarberModal: React.FC<BarberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  barber,
  loading = false
}) => {
  const [formData, setFormData] = useState<BarberFormData>({
    username: '',
    password: '',
    name: '',
    phone: '',
    email: '',
    commission_rate_service: 30,
    commission_rate_product: 10,
    commission_rate_chemical_service: 40,
    is_special_barber: false
  });
  const [errors, setErrors] = useState<Partial<BarberFormData>>({});
  const [showPassword, setShowPassword] = useState(false);

  const isEditing = !!barber;

  useEffect(() => {
    if (barber) {
      setFormData({
        username: barber.user?.username || '',
        password: '',
        name: barber.name,
        phone: barber.phone || '',
        email: barber.email || '',
        commission_rate_service: Math.round(barber.commission_rate_service * 100),
        commission_rate_product: Math.round(barber.commission_rate_product * 100),
        commission_rate_chemical_service: Math.round(barber.commission_rate_chemical_service * 100),
        is_special_barber: barber.is_special_barber || false
      });
    } else {
      setFormData({
        username: '',
        password: '',
        name: '',
        phone: '',
        email: '',
        commission_rate_service: 30,
        commission_rate_product: 10,
        commission_rate_chemical_service: 40,
        is_special_barber: false
      });
    }
    setErrors({});
  }, [barber, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<BarberFormData> = {};

    if (!isEditing && !formData.username.trim()) {
      newErrors.username = 'Nome de usuário é obrigatório';
    }

    if (!isEditing && !formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (!isEditing && formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.commission_rate_service < 0 || formData.commission_rate_service > 100) {
      newErrors.commission_rate_service = 'Deve estar entre 0% e 100%';
    }

    if (formData.commission_rate_product < 0 || formData.commission_rate_product > 100) {
      newErrors.commission_rate_product = 'Deve estar entre 0% e 100%';
    }

    if (formData.commission_rate_chemical_service < 0 || formData.commission_rate_chemical_service > 100) {
      newErrors.commission_rate_chemical_service = 'Deve estar entre 0% e 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (isEditing) {
        // Para edição, não enviamos username e password
        const updateData: BarberUpdateData = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          commission_rate_service: formData.commission_rate_service,
          commission_rate_product: formData.commission_rate_product,
          commission_rate_chemical_service: formData.commission_rate_chemical_service,
          is_special_barber: formData.is_special_barber
        };
        await onSubmit(updateData);
      } else {
        await onSubmit(formData);
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar barbeiro:', error);
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleCommissionChange = (field: keyof BarberFormData, value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setFormData(prev => ({ ...prev, [field]: clampedValue }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {isEditing ? 'Editar Barbeiro' : 'Novo Barbeiro'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados de Login */}
              {!isEditing && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Dados de Acesso</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome de usuário *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserCheck className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                          className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                            errors.username ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="usuario123"
                          disabled={loading}
                        />
                      </div>
                      {errors.username && (
                        <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Senha *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className={`block w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                            errors.password ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Mínimo 6 caracteres"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <span className="text-sm text-gray-500">
                            {showPassword ? 'Ocultar' : 'Mostrar'}
                          </span>
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dados Pessoais */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Dados Pessoais</h4>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome completo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                          errors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="João da Silva"
                        disabled={loading}
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                          placeholder="(11) 99999-9999"
                          maxLength={15}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          id="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                            errors.email ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="barbeiro@email.com"
                          disabled={loading}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comissões */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Taxas de Comissão</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Serviços Gerais: {formData.commission_rate_service}%
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.commission_rate_service}
                        onChange={(e) => handleCommissionChange('commission_rate_service', parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={loading}
                      />
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.commission_rate_service}
                          onChange={(e) => handleCommissionChange('commission_rate_service', parseInt(e.target.value) || 0)}
                          className={`block w-full pr-8 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-gray-900 ${
                            errors.commission_rate_service ? 'border-red-300' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        />
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <Percent className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                    </div>
                    {errors.commission_rate_service && (
                      <p className="mt-1 text-sm text-red-600">{errors.commission_rate_service}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Produtos: {formData.commission_rate_product}%
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.commission_rate_product}
                        onChange={(e) => handleCommissionChange('commission_rate_product', parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={loading}
                      />
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.commission_rate_product}
                          onChange={(e) => handleCommissionChange('commission_rate_product', parseInt(e.target.value) || 0)}
                          className={`block w-full pr-8 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-gray-900 ${
                            errors.commission_rate_product ? 'border-red-300' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        />
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <Percent className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                    </div>
                    {errors.commission_rate_product && (
                      <p className="mt-1 text-sm text-red-600">{errors.commission_rate_product}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Serviços com Química: {formData.commission_rate_chemical_service}%
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.commission_rate_chemical_service}
                        onChange={(e) => handleCommissionChange('commission_rate_chemical_service', parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={loading}
                      />
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.commission_rate_chemical_service}
                          onChange={(e) => handleCommissionChange('commission_rate_chemical_service', parseInt(e.target.value) || 0)}
                          className={`block w-full pr-8 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-gray-900 ${
                            errors.commission_rate_chemical_service ? 'border-red-300' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        />
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <Percent className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                    </div>
                    {errors.commission_rate_chemical_service && (
                      <p className="mt-1 text-sm text-red-600">{errors.commission_rate_chemical_service}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Checkbox Barbeiro Especial */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Configurações Especiais</h4>
                <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <input
                    type="checkbox"
                    id="is_special_barber"
                    checked={formData.is_special_barber}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_special_barber: e.target.checked }))}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                    disabled={loading}
                  />
                  <label htmlFor="is_special_barber" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <span className="text-yellow-600">⭐</span>
                    <span>Barbeiro Especial</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Barbeiros especiais usam os tempos especiais configurados nos serviços
                </p>
              </div>
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-gray-900 text-base font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                isEditing ? 'Atualizar' : 'Cadastrar'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};