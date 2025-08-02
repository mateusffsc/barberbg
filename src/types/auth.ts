export type UserRole = 'admin' | 'barber';

export interface User {
  id: number;
  username: string;
  role: UserRole;
}

export interface AuthUser extends User {
  barber?: {
    id: number;
    name: string;
  };
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}