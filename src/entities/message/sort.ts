import type { Message } from '../../shared/contract';

export function sortMessages(msgs: Message[]): Message[] {
  const sorted = [...msgs];
  sorted.sort((a, b) =>
    a.createdAt !== b.createdAt
      ? a.createdAt - b.createdAt
      : a.id.localeCompare(b.id)
  );
  return sorted;
}
