import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Safe navigation hook that goes back if possible, with a fallback route
 * Prevents navigation errors that can cause auth/login issues
 */
export const useNavigateWithFallback = () => {
  const navigate = useNavigate();

  const navigateBack = useCallback((fallbackRoute = '/dashboard') => {
    // Check if there's a history to go back to
    if (window.history.length > 1) {
      try {
        navigate(-1);
      } catch (error) {
        // If navigation back fails, use fallback
        navigate(fallbackRoute);
      }
    } else {
      // No history, use fallback
      navigate(fallbackRoute);
    }
  }, [navigate]);

  return { navigateBack };
};
