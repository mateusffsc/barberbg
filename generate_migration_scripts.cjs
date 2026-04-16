const fs = require('fs');

function generateMigrationScripts() {
  console.log('🔧 GERANDO SCRIPTS DE MIGRAÇÃO\n');

  // 1. Script de criação da estrutura
  const createStructureSQL = `
-- =====================================================
-- SCRIPT DE CRIAÇÃO DA ESTRUTURA - SISTEMA BARBEARIA
-- Data: ${new Date().toLocaleDateString('pt-BR')}
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA USERS
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'barber' CHECK (role IN ('admin', 'barber')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. TABELA CLIENTS
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. TABELA BARBERS
CREATE TABLE barbers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  commission_rate_service DECIMAL(3,2) DEFAULT 0.60 CHECK (commission_rate_service BETWEEN 0 AND 1),
  commission_rate_product DECIMAL(3,2) DEFAULT 0.30 CHECK (commission_rate_product BETWEEN 0 AND 1),
  commission_rate_chemical_service DECIMAL(3,2) DEFAULT 0.70 CHECK (commission_rate_chemical_service BETWEEN 0 AND 1),
  is_special_barber BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. TABELA SERVICES
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  duration_minutes_normal INTEGER DEFAULT 30 CHECK (duration