import { useEffect } from 'react';
import { gateway, useGatewayStore } from '../application/gateway';
import { toast } from './toast-store';
import { buildPlatformNotification } from './platform-notifications';

export function GatewayNotificationHost() {
  const connected = useGatewayStore((s) => s.connected);

  useEffect(() => {
    if (!connected) return;

    const unsubscribe = gateway.subscribe('*', (evt: unknown) => {
      if (!evt || typeof evt !== 'object') return;
      
      const eventRecord = evt as { event?: unknown; payload?: unknown };
      const eventName = eventRecord.event;
      const eventPayload = eventRecord.payload;
      
      if (!eventName || typeof eventName !== 'string') return;
      if (!eventPayload || typeof eventPayload !== 'object') return;

      const payloadObj = eventPayload as Record<string, unknown>;
      
      const platformNotification = buildPlatformNotification({
        eventName,
        payload: payloadObj,
      });

      if (platformNotification) {
        toast.notify({
          tone: platformNotification.tone,
          title: platformNotification.title,
          description: platformNotification.description,
          actionLabel: platformNotification.actionLabel,
          onAction: () => {
            window.location.assign(platformNotification.href);
          },
          durationMs: platformNotification.tone === "error" ? 7_000 : 5_500,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [connected]);

  return null;
}
