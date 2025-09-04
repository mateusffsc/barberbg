-- CORREÇÃO DO TRIGGER: sync_appointment_services
-- O problema está na variável appointment_record não sendo inicializada corretamente

-- Recriar a função com correção
CREATE OR REPLACE FUNCTION sync_appointment_services()
RETURNS TRIGGER AS $$
DECLARE
    appointment_id_var INTEGER;
BEGIN
    -- Determinar appointment_id
    IF TG_OP = 'DELETE' THEN
        appointment_id_var = OLD.appointment_id;
    ELSE
        appointment_id_var = NEW.appointment_id;
    END IF;
    
    -- Atualizar services_names e services_ids
    UPDATE appointments 
    SET 
        services_names = COALESCE(subquery.services_names, 'Nenhum serviço'),
        services_ids = COALESCE(subquery.services_ids, ARRAY[]::INTEGER[])
    FROM (
        SELECT 
            STRING_AGG(s.name, ', ' ORDER BY s.name) as services_names,
            ARRAY_AGG(s.id ORDER BY s.name) as services_ids
        FROM appointment_services aps
        JOIN services s ON aps.service_id = s.id
        WHERE aps.appointment_id = appointment_id_var
    ) as subquery
    WHERE appointments.id = appointment_id_var;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Verificar se o trigger existe e recriá-lo se necessário
DROP TRIGGER IF EXISTS trigger_sync_appointment_services ON appointment_services;

CREATE TRIGGER trigger_sync_appointment_services
    AFTER INSERT OR UPDATE OR DELETE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_services();