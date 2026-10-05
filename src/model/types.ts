import type { Message, Connection } from '../shared/contract';

export type Action =
  | { type: 'message/send'; clientId: string; text: string }
  | { type: 'message/retry'; clientId: string }
  | { type: 'message/receive'; message: Message }
  | { type: 'outbox/flush' }
  | { type: 'loadOlder/request' }
  | { type: 'connection/change'; state: Connection };

export interface State {
  messages: Message[];
  connection: Connection;
  pendingMessages: Map<string, Message>;
  failedMessages: Set<string>;
  oldestId: string | undefined;
  hasOlder: boolean;
  loadingOlder: boolean;
  showConnectionBanner: boolean;
}
