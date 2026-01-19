import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../context/SocketContext';

/**
 * Hook für Live-Updates über Socket.io
 * Invalidiert automatisch React Query Caches wenn Daten auf dem Server geändert werden
 *
 * OPTIMIERT: Dashboard-Invalidierung wird gedebounced um zu viele Reloads zu vermeiden
 */
export function useLiveUpdates() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const dashboardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationsRef = useRef<Set<string>>(new Set());

  // Debounced Dashboard-Invalidierung (sammelt Updates für 500ms)
  const debouncedDashboardInvalidate = useCallback(() => {
    if (dashboardDebounceRef.current) {
      clearTimeout(dashboardDebounceRef.current);
    }
    dashboardDebounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      pendingInvalidationsRef.current.clear();
      dashboardDebounceRef.current = null;
    }, 500);
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;

    // Entity zu Query-Key Mapping (ohne Dashboard - wird separat gehandled)
    const entityQueryKeys: Record<string, string[][]> = {
      employee: [['employees'], ['employee']],
      absence: [['absences'], ['active-absences']],
      bonus: [['bonus'], ['bonusPayments'], ['my-bonuses'], ['weekly-bonus-summary']],
      sanction: [['sanctions']],
      task: [['tasks']],
      investigation: [['investigations']],
      case: [['cases']],
      application: [['applications']],
      training: [['trainings']],
      uprankRequest: [['uprankRequests']],
      announcement: [['announcements']],
      notification: [['notifications']],
      evidence: [['evidence']],
      robbery: [['robberies']],
      tuning: [['tuning']],
      calendar: [['calendar'], ['calendarUpcoming']],
    };

    // Entities die Dashboard-Updates auslösen
    const dashboardEntities = new Set([
      'employee', 'absence', 'bonus', 'sanction', 'task',
      'investigation', 'case', 'application', 'training',
      'uprankRequest', 'announcement', 'evidence', 'robbery',
      'tuning', 'calendar'
    ]);

    // Generischer Handler für Entity-Updates
    const handleEntityChange = (entity: string) => {
      // Sofort die spezifischen Queries invalidieren
      const keys = entityQueryKeys[entity] || [[entity]];
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Dashboard-Update debounced
      if (dashboardEntities.has(entity)) {
        pendingInvalidationsRef.current.add(entity);
        debouncedDashboardInvalidate();
      }
    };

    // Event Listener registrieren
    const entities = Object.keys(entityQueryKeys);

    entities.forEach(entity => {
      socket.on(`${entity}:created`, () => handleEntityChange(entity));
      socket.on(`${entity}:updated`, () => handleEntityChange(entity));
      socket.on(`${entity}:deleted`, () => handleEntityChange(entity));
    });

    // Cleanup
    return () => {
      entities.forEach(entity => {
        socket.off(`${entity}:created`);
        socket.off(`${entity}:updated`);
        socket.off(`${entity}:deleted`);
      });
      // Pending debounce clearen
      if (dashboardDebounceRef.current) {
        clearTimeout(dashboardDebounceRef.current);
      }
    };
  }, [socket, queryClient, debouncedDashboardInvalidate]);
}
