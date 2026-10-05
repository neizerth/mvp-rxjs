import type { Action } from '../model/types';
import type { Transport } from '../shared/transport';
import type { MessageState } from '../entities/message/model';
import type { ConnectionState } from '../entities/connection/model';
import type { Message, Connection } from '../shared/contract';

// Явные зависимости для фич: store с методами срезов + dispatch + transport
export interface StoreState extends MessageState, ConnectionState {}

export interface Deps {
  store: {
    getState(): StoreState & {
      addPending(message: Message): void;
      markSent(clientId: string, message: Message): void;
      markFailed(clientId: string): void;
      receive(message: Message): void;
      setConnection(state: Connection): void;
      setBanner(show: boolean): void;
      setLoading(loading: boolean): void;
      prepend(messages: Message[], hasMore: boolean): void;
    };
  };
  transport: Transport;
  dispatch(action: Action): void;
  ids: { nextClientId(): string };
}
