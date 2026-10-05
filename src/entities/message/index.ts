import type { Message } from '../../shared/contract';

export function createMessageMerger() {
  return {
    addMessage(messages: Message[], message: Message): Message[] {
      const existing = messages.find((m) => m.id === message.id);
      if (existing) return messages;

      const hasPending =
        message.clientId &&
        messages.some((m) => m.clientId === message.clientId);

      if (hasPending && message.clientId) {
        const old = messages.find((m) => m.clientId === message.clientId);
        const result = messages.filter((m) => m !== old);
        result.push(message);
        return this.sortMessages(result);
      }

      const result = [...messages, message];
      return this.sortMessages(result);
    },

    sortMessages(messages: Message[]): Message[] {
      const sorted = [...messages];
      sorted.sort((a, b) =>
        a.createdAt !== b.createdAt
          ? a.createdAt - b.createdAt
          : a.id.localeCompare(b.id)
      );
      return sorted;
    },
  };
}
