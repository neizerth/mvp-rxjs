import type { Message, Connection } from '../shared/contract';

export type Action =
  | { type: 'receive'; message: Message }
  | { type: 'sendRequested'; clientId: string; text: string }
  | { type: 'acked'; clientId: string; message: Message }
  | { type: 'failed'; clientId: string }
  | { type: 'olderLoaded'; messages: Message[]; hasMore: boolean }
  | { type: 'connectionChanged'; state: Connection }
  | { type: 'bannerShow' }
  | { type: 'bannerHide' };

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
