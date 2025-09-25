import React, { useState } from 'react';
import { User, Phone, Mail, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const ClientRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatPhone = (phone: string) => {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Aplica a formatação (XX) XXXXX-XXXX
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({
      ...prev,
      phone: formatted
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return false;
    }

    if (!formData.phone.trim()) {
      toast.error('Telefone é obrigatório');
      return false;
    }

    // Validação básica de telefone (deve ter pelo menos 10 dígitos)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Telefone deve ter pelo menos 10 dígitos');
      return false;
    }

    // Validação básica de email se fornecido
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Email inválido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Iniciando processo de cadastro...');
    console.log('📝 Dados do formulário:', formData);
    
    if (!validateForm()) {
      console.log('❌ Validação do formulário falhou');
      return;
    }

    setLoading(true);
    console.log('⏳ Loading ativado');

    try {
      console.log('🔍 Verificando cliente existente...');
      // Verificar se já existe um cliente com o mesmo telefone
      const { data: existingClient, error: checkError } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', formData.phone)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.log('❌ Erro na verificação:', checkError);
        throw checkError;
      }

      if (existingClient) {
        console.log('⚠️ Cliente já existe');
        toast.error('Já existe um cliente cadastrado com este telefone');
        setLoading(false);
        return;
      }

      console.log('💾 Inserindo novo cliente...');
      const clientData = {
        name: formData.name.trim(),
        phone: formData.phone,
        email: formData.email.trim() || null
      };
      console.log('📋 Dados para inserção:', clientData);

      // Criar novo cliente
      const { data: insertedData, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select();

      console.log('💾 Resultado da inserção:', { insertedData, error });

      if (error) {
        console.log('❌ Erro na inserção:', error);
        throw error;
      }

      console.log('✅ Cliente cadastrado com sucesso!', insertedData);
      setSuccess(true);
      toast.success('Cadastro realizado com sucesso!');
      
      // Limpar formulário após 3 segundos
      setTimeout(() => {
        setFormData({ name: '', phone: '', email: '' });
        setSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('💥 Erro ao cadastrar cliente:', error);
      toast.error('Erro ao realizar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
      console.log('⏳ Loading desativado');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Cadastro Realizado!
          </h2>
          <p className="text-gray-600 mb-6">
            Seu cadastro foi realizado com sucesso. Em breve entraremos em contato!
          </p>
          <div className="text-sm text-gray-500">
            Redirecionando em alguns segundos...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cadastro de Cliente
          </h1>
          <p className="text-gray-600">
            Preencha seus dados para se cadastrar
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo *
            </label>
            <div className="relative">
              <User className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Digite seu nome completo"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone *
            </label>
            <div className="relative">
              <Phone className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email (opcional)
            </label>
            <div className="relative">
              <Mail className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          {/* Botão de Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Cadastrando...
              </>
            ) : (
              'Realizar Cadastro'
            )}
          </button>
        </form>

        {/* Informações adicionais */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Informações importantes:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Seus dados são protegidos e não serão compartilhados</li>
                <li>Utilizaremos o telefone para confirmar agendamentos</li>
                <li>O email é opcional mas recomendado para comunicações</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};