export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  email: string;
  displayName: string;
  image?: string | null;
  emailVerified: boolean;
  role: UserRole;
  banned?: boolean;
};
