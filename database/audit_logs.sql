-- Criação da tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuração do RLS (Row Level Security)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos (ou apenas admins, se preferir restringir no backend)
CREATE POLICY "Enable read access for all users" ON public.audit_logs
    FOR SELECT USING (true);

-- Permitir inserção para todos os usuários autenticados
CREATE POLICY "Enable insert access for all users" ON public.audit_logs
    FOR INSERT WITH CHECK (true);
