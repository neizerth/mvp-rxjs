import type { State, Action } from './types';
import type { Transport } from '../shared/transport';

// Явные зависимости: store (state snapshot + dispatch), transport, session, таймеры
// Сценарии (send, flushOutbox и др.) читают состояние через store.getState(),
// управляют потоком через dispatch(action), вызывают backend через transport.
export interface Deps {
  store: { getState(): State };
  transport: Transport;
  dispatch(action: Action): void;
  timers: { timeout(ms: number, cb: () => void): () => void };
}
