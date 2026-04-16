import { supabase } from '../lib/supabase';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'RESCHEDULE' | 'STATUS_CHANGE';
export type AuditEntity = 'appointment' | 'client' | 'barber' | 'sale' | 'service' | 'product' | 'schedule_block';

export const logAudit = async (
  userId: number | undefined,
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string | number,
  details: string
) => {
  if (!userId) return;

  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      details
    });

    if (error) {
      console.error('Erro ao salvar log de auditoria:', error);
    }
  } catch (error) {
    console.error('Erro de rede ao salvar log de auditoria:', error);
  }
};
