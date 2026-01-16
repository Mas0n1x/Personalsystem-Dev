import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../context/SocketContext';

/**
 * Hook für Live-Updates über Socket.io
 * Invalidiert automatisch React Query Caches wenn Daten auf dem Server geändert werden
 */
export function useLiveUpdates() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    // Entity zu Query-Key Mapping
    const entityQueryKeys: Record<string, string[][]> = {
      employee: [['employees'], ['employee'], ['dashboard']],
      absence: [['absences'], ['dashboard']],
      bonus: [['bonus'], ['bonusPayments'], ['dashboard']],
      sanction: [['sanctions'], ['dashboard']],
      task: [['tasks'], ['dashboard']],
      investigation: [['investigations'], ['dashboard']],
      case: [['cases'], ['dashboard']],
      application: [['applications'], ['dashboard']],
      training: [['trainings'], ['dashboard']],
      uprankRequest: [['uprankRequests'], ['dashboard']],
      announcement: [['announcements'], ['dashboard']],
      notification: [['notifications']],
      evidence: [['evidence'], ['dashboard']],
      robbery: [['robberies'], ['dashboard']],
      tuning: [['tuning'], ['dashboard']],
      calendar: [['calendar'], ['calendarUpcoming'], ['dashboard']],
    };

    // Generische Handler für CRUD-Events
    const handleCreated = (entity: string) => {
      const keys = entityQueryKeys[entity] || [[entity]];
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    const handleUpdated = (entity: string) => {
      const keys = entityQueryKeys[entity] || [[entity]];
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    const handleDeleted = (entity: string) => {
      const keys = entityQueryKeys[entity] || [[entity]];
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    // Event Listener registrieren
    const entities = Object.keys(entityQueryKeys);

    entities.forEach(entity => {
      socket.on(`${entity}:created`, () => handleCreated(entity));
      socket.on(`${entity}:updated`, () => handleUpdated(entity));
      socket.on(`${entity}:deleted`, () => handleDeleted(entity));
    });

    // Cleanup
    return () => {
      entities.forEach(entity => {
        socket.off(`${entity}:created`);
        socket.off(`${entity}:updated`);
        socket.off(`${entity}:deleted`);
      });
    };
  }, [socket, queryClient]);
}
