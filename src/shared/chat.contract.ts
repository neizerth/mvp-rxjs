import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createFakeBackend } from './backend';
import type { CreateChat } from './contract';

export function describeChat(createChat: CreateChat) {
  describe('Chat', () => {
    it('After start and timer flush, shows 30 messages, send and ack', () => {
      vi.useFakeTimers();
      const backend = createFakeBackend();
      const chat = createChat(backend);
      const { result } = renderHook(() => chat.useChat());

      act(() => {
        chat.start();
        vi.runAllTimers();
      });

      expect(result.current!.messages).toHaveLength(30);
      expect(result.current!.hasOlder).toBe(true);

      act(() => {
        result.current!.send('hi');
        vi.runAllTimers();
      });

      const ownMessages = result.current!.messages.filter((m) => m.text === 'hi');
      expect(ownMessages).toHaveLength(1);
      expect(ownMessages[0]!.status).toBe('sent');

      chat.dispose();
      vi.useRealTimers();
    });

    it('Offline send stays pending, then sent after reconnect', () => {
      vi.useFakeTimers();
      const backend = createFakeBackend();
      const chat = createChat(backend);
      const { result } = renderHook(() => chat.useChat());

      act(() => {
        chat.start();
        vi.runAllTimers();
      });

      act(() => {
        backend.chaos.dropConnection(5000);
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.send('offline');
        vi.runAllTimers();
      });

      const offlineMessages = result.current!.messages.filter((m) => m.text === 'offline');
      expect(offlineMessages[0]!.status).toBe('pending');

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      const sentMessages = result.current!.messages.filter((m) => m.text === 'offline');
      expect(sentMessages[0]!.status).toBe('sent');
      expect(sentMessages).toHaveLength(1);

      chat.dispose();
      vi.useRealTimers();
    });

    it('Connection banner appears after 3s reconnecting, disappears on reconnect', () => {
      vi.useFakeTimers();
      const backend = createFakeBackend();
      const chat = createChat(backend);
      const { result } = renderHook(() => chat.useChat());

      act(() => {
        chat.start();
        vi.runAllTimers();
      });

      act(() => {
        backend.chaos.dropConnection(5000);
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.showConnectionBanner).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1200);
      });

      expect(result.current.showConnectionBanner).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.showConnectionBanner).toBe(false);

      chat.dispose();
      vi.useRealTimers();
    });

    it('loadOlder gives 60 messages, duplicate call gives 60 total', () => {
      vi.useFakeTimers();
      const backend = createFakeBackend();
      const chat = createChat(backend);
      const { result } = renderHook(() => chat.useChat());

      act(() => {
        chat.start();
        vi.runAllTimers();
      });

      const initialCount = result.current.messages.length;

      act(() => {
        result.current.loadOlder();
        vi.runAllTimers();
      });

      expect(result.current.messages.length).toBe(60);

      act(() => {
        result.current.loadOlder();
        vi.runAllTimers();
      });

      expect(result.current.messages.length).toBe(60);

      chat.dispose();
      vi.useRealTimers();
    });
  });
}
