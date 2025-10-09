import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export const signIn = async (username: string, password: string) => {
  try {
    console.log('Supabase: Tentando login para usuário:', username);
    
    // Buscar usuário - use select sem single() para evitar erro 406
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password_hash', password);

    console.log('Supabase: Resposta da query:', { users, error });

    if (error) throw error;
    
    // Verificar se encontrou usuário
    if (!users || users.length === 0) {
      console.log('Supabase: Usuário não encontrado');
      throw new Error('Usuário ou senha inválidos');
    }

    const user = users[0];
    console.log('Supabase: Usuário encontrado:', user);

    // Se for barbeiro, buscar dados adicionais
    if (user.role === 'barber') {
      console.log('Supabase: Buscando dados do barbeiro');
      const { data: barber } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      console.log('Supabase: Dados do barbeiro:', barber);
      return { ...user, barber };
    }

    console.log('Supabase: Retornando usuário admin');
    return user;
  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
};