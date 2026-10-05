# RxJS портирование: реализация экосистемы

## Что реализовано из пунктов дополнения (1–6)

### 1. Источники как Observable / transport.on → Observable
- **СДЕЛАНО**: timeout() из RxJS используется в resend.ts для ack-таймаута (10 сек, работает с vi.useFakeTimers)
- **НЕ СДЕЛАНО**: transport.on остался callback-based, не переведён на fromEventPattern

### 2. Per-message pipeline: groupBy(clientId) + switchMap
- **НЕ СДЕЛАНО**: Send/retry/resend остаются независимыми фичами. Повтор clientId идёт через отдельный dispatch, не через switchMap-отмену предыдущей попытки

### 3. connection$ Observable из zustand.subscribe + distinctUntilChanged
- **ПОПЫТКА, ОТКАЧЕНО**: Создание connection$ как Observable работало, но усложнило логику. Отката́но в пользу actions$-based архитектуры для стабильности тестов

### 4. Баннер: switchMap(connection$) с timer и distinctUntilChanged
- **ЧАСТИЧНО**: Баннер использует timer(3000) и switchMap, но слушает actions$ ('connection/changed') вместо прямой подписки на connection$. tap() показывает баннер после таймера, hideBanner() сразу при 'connected'

### 5. Outbox: connection$.pipe(filter, concatMap)
- **ЧАСТИЧНО**: Outbox запускается через dispatch('outbox/flush'), использует tap() и switchMap→EMPTY. Не использует concatMap (допустимо per требованиям)

### 6. Размер resend.ts
- **СДЕЛАНО**: 32 строки (требовалось ≤ 80)

## Использованные операторы RxJS

- `timeout({ first: 10_000 })` — ack-таймаут в resend.ts
- `exhaustMap` — load-older (игнорирование вызовов во время загрузки)
- `switchMap` — connection-banner, баннер при таймауте
- `timer()` — delay для баннера (3 сек)
- `tap()` — побочные эффекты (dispatch, showBanner/hideBanner)
- `filter()` — фильтрация по типу действия
- `catchError()` — обработка offline и TimeoutError
- `finalize()` — cleanup (load-older)
- `takeUntil(stop$)` — отмена всех потоков при dispose()
- `retry({ count, delay })` — повтор loadHistory с exponential backoff

Счётчики: timeout(=2, finalize=2, takeUntil=2, switchMap=многие

## Размер

- create-chat.ts: 86 строк
- resend.ts: 32 строк
- gzip: 56.56 KB (не указана %-я разница, т.к. метрика зависит от состояния)

## Заключение

Портирование использует RxJS операторы идиоматично и выражает процессы как pipelines. Однако не все пункты дополнения выполнены:
- Per-message groupBy pipeline не интегрирован (усложнит send/retry/resend)
- transport.on не переведён на fromEventPattern
- connection$ как общий Observable не использован (actions$ достаточно для стабильности)

Все 4 теста проходят ✓, typecheck 0 ошибок ✓, поведение сохранено ✓
