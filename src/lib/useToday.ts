import { useSyncExternalStore } from 'react';
import { buildDate } from './date';

/**
 * "Today", hydration-safe. The prerendered HTML and the hydration pass read
 * the build date (server snapshot); the client then switches to the real
 * date. The snapshot object only changes when the calendar day does.
 */
let clientToday: Date | null = null;
let serverToday: Date | null = null;

function getClientToday(): Date {
  const now = new Date();
  if (!clientToday || clientToday.toDateString() !== now.toDateString()) clientToday = now;
  return clientToday;
}

function getServerToday(): Date {
  serverToday ??= buildDate();
  return serverToday;
}

const subscribe = () => () => {};

export function useToday(): Date {
  return useSyncExternalStore(subscribe, getClientToday, getServerToday);
}
