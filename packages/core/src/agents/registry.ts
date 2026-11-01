import type { AppEvent, AppEventType } from "../events";

export type EventHandler<T extends AppEventType = AppEventType> = (
  event: Extract<AppEvent, { type: T }>,
) => Promise<void>;

export type HandlerRegistry = { [T in AppEventType]?: EventHandler<T>[] };

/**
 * Olay → agent job eşlemesi. Faz 4 (FEAT-005) burayı doldurur.
 * Agent'lar iş durumunu değiştirmez; yalnızca AgentRun/Notification yazar.
 */
export const handlers: HandlerRegistry = {};
