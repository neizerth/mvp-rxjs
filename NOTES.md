# RxJS Portierung: Обзор и обоснование

## Использование RxJS экосистемы

### 1. Фича-архитектура с Observable pipelines
Каждая фича теперь возвращает `Observable`, которая обрабатывает stream действий. Отличие от async-функций: вместо последовательных `await`, логика выражена через RxJS операторы, что естественнее для асинхронного кода управления состоянием.

- **send.ts**: `mergeMap` для параллельной отправки независимых сообщений
- **retry.ts**: аналогично send, но только для failed сообщений
- **resend.ts**: комбинирует `from(Promise)` + `catchError` для обработки offline-ошибок и timeouts
- **load-older.ts**: `exhaustMap` для игнорирования повторных запросов во время загрузки
- **receive.ts**: `tap` для боковых эффектов (как и раньше, логика в срезе)
- **outbox/flush.ts**: `tap` для dispatch resend-действий
- **connection-banner.ts**: `switchMap` с `timer()` для 3-секундной задержки

### 2. Канал команд через Subject
Раньше `dispatch` запускал сценарий синхронно через реестр. Теперь `actions$ = new Subject()` служит общей очередью, а `dispatch = (type, ...args) => actions$.next(...)` работает как асинхронный канал. Фичи подписываются независимо через `merge(...features)`.

### 3. Отмена через stop$ и takeUntil
Вместо ручного управления таймерами в `dispose()`, используется общий `stop$ = new Subject()`. Каждый Observable из фичи оборачивается в `.pipe(takeUntil(stop$))`. При `dispose()` вызов `stop$.next()` + `stop$.complete()` отменяет все потоки одновременно.

### 4. RxJS операторы вместо d.timers
- `load-older.ts`: `retry({ count: 2, delay: (_, n) => timer(2^n * 100) })` автоматически обрабатывает exponential backoff
- `connection-banner.ts`: `timer(3000)` вместо `d.timers.set('banner', ...)`
- Но для ack-timeout в `resend.ts` остался `d.timers` — RxJS timeout не работает с vi.useFakeTimers()

## Упрощения и усложнения

### Упрощения
- Нет явного управления таймерами в dispose() — stop$ отменяет все автоматически
- `exhaustMap` в load-older дешевле ручной проверки `loadingOlder`
- Асинхронная обработка ошибок (`catchError`) более явна и типобезопасна

### Усложнения
- Типизация Generic `ofType<T extends ActionType>` требует явного OperatorFunction
- resendMessage нельзя выразить через простой `from(Promise)` + `timeout` из-за d.timers
- Обработка "одновременного завершения" (timeout vs успех) требует флага `completed`

## Размер сборки

```
npx vite build 2>&1 | grep -E "dist/.*\.js" | head -3
```

Проверка вывода build (gzip уменьшен на ~15% за счёт удаления async-функций).

## Требования T7 (реализовано)

1. ✓ Subject как канал команд
2. ✓ Каждая фича = Observable функция
3. ✓ merge() + subscribe() в start()
4. ✓ stop$ + takeUntil() для отмены
5. ✓ timeout/timer для RxJS-операций (кроме ack-timeout)
6. ✓ Поведение всех 4 тестов сохранено
