import type { Message } from '../../shared/contract';
import { sortMessages } from './sort';

export interface MessageState {
  messages: Message[];
  pendingMessages: Map<string, Message>;
  failedMessages: Set<string>;
  oldestId: string | undefined;
  hasOlder: boolean;
  loadingOlder: boolean;
}

export const messageActions = {
  addMessage(state: MessageState, message: Message): MessageState {
    const existing = state.messages.find((m) => m.id === message.id);
    if (existing) return state;
    const msgs = sortMessages([...state.messages, message]);
    return {
      ...state,
      messages: msgs,
      pendingMessages: new Map(
        [...state.pendingMessages].filter((k) => k[0] !== message.clientId)
      ),
      failedMessages: new Set(
        [...state.failedMessages].filter((id) => id !== message.clientId)
      ),
    };
  },

  markSent(state: MessageState, clientId: string, msg: Message): MessageState {
    const newMsgs = sortMessages([...state.messages.filter((m) => m.clientId !== clientId), msg]);
    return {
      ...state,
      messages: newMsgs,
      pendingMessages: new Map([...state.pendingMessages].filter((k) => k[0] !== clientId)),
      failedMessages: new Set([...state.failedMessages].filter((id) => id !== clientId)),
    };
  },

  markFailed(state: MessageState, clientId: string): MessageState {
    return {
      ...state,
      failedMessages: new Set([...state.failedMessages, clientId]),
    };
  },

  addPending(state: MessageState, message: Message): MessageState {
    return {
      ...state,
      messages: [...state.messages, message],
      pendingMessages: new Map([...state.pendingMessages, [message.clientId!, message]]),
    };
  },

  setOlder(state: MessageState, messages: Message[], hasMore: boolean): MessageState {
    const msgs = sortMessages([...messages, ...state.messages]);
    return {
      ...state,
      messages: msgs,
      loadingOlder: false,
      hasOlder: hasMore,
      oldestId: messages.length > 0 ? messages[0]!.id : state.oldestId,
    };
  },

  setLoading(state: MessageState, loading: boolean): MessageState {
    return { ...state, loadingOlder: loading };
  },

  setInitial(state: MessageState, msgs: Message[], hasMore: boolean): MessageState {
    const sorted = sortMessages(msgs);
    return {
      ...state,
      messages: sorted,
      hasOlder: hasMore,
      oldestId: sorted.length > 0 ? sorted[0]!.id : undefined,
    };
  },
};
