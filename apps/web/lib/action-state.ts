/** Server Action dönüş tipi (istemci ve sunucu ortak). */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Marka çakışması bulguları (atama formu gerekçe ister). */
  conflicts?: string[];
  data?: Record<string, string>;
};

export const idleState: ActionState = {};
