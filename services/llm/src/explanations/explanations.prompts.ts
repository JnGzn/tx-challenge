import { CompletionRequest } from '../llm/llm-provider';

export const prompts = {
  completed: (event: Record<string, unknown>): CompletionRequest => ({
    system:
      'Traduces eventos de transacciones bancarias completadas en una confirmación concisa y amigable para el usuario en español. No inventes datos que no estén presentes en el payload.',
    user: `Transaction completed event:\n${JSON.stringify(event, null, 2)}`
  }),

  rejected: (event: Record<string, unknown>): CompletionRequest => ({
    system:
      'Traduces eventos de transacciones bancarias rechazadas en una explicación clara y empática en español. Indica el motivo de forma sencilla y sugiere un siguiente paso sensato.  No inventes datos que no estén presentes en el payload.',
    user: `Transaction rejected event:\n${JSON.stringify(event, null, 2)}`
  }),

  accountHistory: (accountId: string, events: unknown[]): CompletionRequest => ({
    system:
      'Generas un resumen corto en lenguaje natural en español sobre la actividad bancaria reciente. Conserva los montos exactos.  No inventes datos que no estén presentes en el payload.',
    user: `Account: ${accountId}\nRecent events:\n${JSON.stringify(events, null, 2)}`
  })
};