import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Lead } from '@shared/schema';

interface OfflineAction {
  id: string;
  type: 'accept_job' | 'update_status' | 'add_photo';
  leadId: string;
  data: any;
  timestamp: number;
}

interface OfflineStorageState {
  isOnline: boolean;
  pendingActions: OfflineAction[];
  cachedJobs: Lead[];
  lastSyncTime: number;
}

const OFFLINE_STORAGE_KEY = 'jc_offline_data';
const CACHE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours - longer expiry for offline work

export function useOfflineStorage() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load offline data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (stored) {
      try {
        const data: OfflineStorageState = JSON.parse(stored);
        setPendingActions(data.pendingActions || []);
      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    }
  }, []);

  // Get cached jobs from localStorage
  const getCachedJobs = useCallback((): Lead[] => {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (stored) {
      try {
        const data: OfflineStorageState = JSON.parse(stored);
        const isExpired = Date.now() - data.lastSyncTime > CACHE_EXPIRY_MS;
        return isExpired ? [] : (data.cachedJobs || []);
      } catch (error) {
        console.error('Error loading cached jobs:', error);
      }
    }
    return [];
  }, []);

  // Save offline data to localStorage
  const saveOfflineData = useCallback((actions: OfflineAction[], jobs?: Lead[]) => {
    const data: OfflineStorageState = {
      isOnline,
      pendingActions: actions,
      cachedJobs: jobs || getCachedJobs(),
      lastSyncTime: Date.now(),
    };
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(data));
  }, [isOnline, getCachedJobs]);

  // Cache current query data when going offline
  const cacheCurrentData = useCallback(() => {
    const availableJobs = queryClient.getQueryData<Lead[]>(['/api/leads/available']) || [];
    const myJobs = queryClient.getQueryData<Lead[]>(['/api/leads/my-jobs']) || [];
    const allJobs = [...availableJobs, ...myJobs];
    saveOfflineData(pendingActions, allJobs);
  }, [queryClient, pendingActions, saveOfflineData]);

  // Sync pending actions when online with functional updates to prevent race conditions
  const syncPendingActions = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    // Use functional update to get current state and prevent sync if empty
    let actionsToSync: OfflineAction[] = [];
    setPendingActions(current => {
      if (current.length === 0) return current;
      actionsToSync = [...current]; // Create snapshot for sync
      return current; // Don't modify state yet
    });

    if (actionsToSync.length === 0) return;

    setIsSyncing(true);
    const successfulActions: string[] = [];

    console.log(`Starting sync of ${actionsToSync.length} offline actions`);

    for (const action of actionsToSync) {
      try {
        let response: Response;
        
        switch (action.type) {
          case 'accept_job':
            response = await fetch(`/api/leads/${action.leadId}/accept`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            break;

          case 'update_status':
            response = await fetch(`/api/leads/${action.leadId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: action.data.status }),
            });
            break;

          case 'add_photo':
            response = await fetch(`/api/leads/${action.leadId}/photos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;

          default:
            console.warn('Unknown offline action type:', action.type);
            continue;
        }

        // Check if the response was successful
        if (response.ok) {
          successfulActions.push(action.id);
          console.log(`Successfully synced action ${action.id}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to sync action ${action.id}: ${response.status} ${errorText}`);
          // Keep failed actions in queue for retry
        }
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);
        // Keep failed actions in queue for retry
      }
    }

    // Use functional update to remove only successful actions, preserving any new ones added during sync
    setPendingActions(current => {
      const remainingActions = current.filter(
        action => !successfulActions.includes(action.id)
      );
      saveOfflineData(remainingActions);
      console.log(`Sync complete: ${successfulActions.length} successful, ${remainingActions.length} remaining`);
      return remainingActions;
    });

    // Invalidate queries to refresh data
    if (successfulActions.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/leads/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/my-jobs'] });
    }

    setIsSyncing(false);
  }, [isOnline, isSyncing, queryClient, saveOfflineData]);

  // Listen for online/offline events  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Use a timeout to ensure the latest pendingActions are used
      setTimeout(() => syncPendingActions(), 100);
    };

    const handleOffline = () => {
      setIsOnline(false);
      cacheCurrentData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingActions, cacheCurrentData]);

  // Get current user ID for optimistic updates
  const getCurrentUserId = useCallback((): string => {
    // Get user ID from session/auth context
    // This is a placeholder - in real implementation you'd get this from auth
    return 'current_user_id'; // TODO: Get actual user ID from auth context
  }, []);

  // Add offline action to queue with functional updates to prevent stale closures
  const addOfflineAction = useCallback((action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    const newAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Use functional state update to prevent stale closure issues
    setPendingActions(prevActions => {
      const updatedActions = [...prevActions, newAction];
      
      // Optimistic updates for specific actions with the updated actions list
      if (action.type === 'accept_job') {
        const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
        let updatedJobs: Lead[] = [];
        const currentUserId = getCurrentUserId();
        
        if (stored) {
          try {
            const data: OfflineStorageState = JSON.parse(stored);
            updatedJobs = data.cachedJobs.map(job => 
              job.id === action.leadId ? { 
                ...job, 
                status: 'accepted' as const,
                assignedToUserId: currentUserId 
              } : job
            );
          } catch (error) {
            console.error('Error updating cached job:', error);
            updatedJobs = getCachedJobs();
          }
        } else {
          updatedJobs = getCachedJobs();
        }
        
        // Save with the updated actions list to preserve the new action
        saveOfflineData(updatedActions, updatedJobs);
      } else {
        // For other action types, just save the updated actions
        saveOfflineData(updatedActions);
      }
      
      return updatedActions;
    });

    return newAction.id;
  }, [saveOfflineData, getCachedJobs, getCurrentUserId]);

  // Manual sync trigger
  const forcSync = useCallback(() => {
    if (isOnline) {
      syncPendingActions();
    }
  }, [isOnline, syncPendingActions]);

  // Clear offline data
  const clearOfflineData = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
  }, []);

  return {
    isOnline,
    pendingActions,
    isSyncing,
    hasPendingActions: pendingActions.length > 0,
    getCachedJobs,
    addOfflineAction,
    syncPendingActions: forcSync,
    clearOfflineData,
  };
}