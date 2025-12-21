import { useAuth } from '../context/AuthContext';

/**
 * Hook to get the current user's ID
 * Returns null if not authenticated
 */
export const useUserId = (): string | null => {
  const { user } = useAuth();
  return user?._id || null;
};
