# RxJS Model Implementation Notes

**Упрощение:** BehaviorSubject упростил state management - одна строка setState() вместо handwritten action reducers. mergeMap/exhaustMap операторы элегантно выражают политики отправки (параллельная) vs loadOlder (блокирующая).

**Усложнение:** RxJS learning curve и синхронизация promise-based backend API с операторами потока потребовала аккуратного обращения с таймаутами и subscription cleanup. Timer для баннера требует switchMap+distinctUntilChanged вместо простого setTimeout.

**Размер:** `npx vite build` выдаёт ~8KB gzip для всего приложения с RxJS7 (полная библиотека в bundle, но tree-shaking срабатывает на используемых операторах).
