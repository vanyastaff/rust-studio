# T04 — Смена модели поднимает вопрос о верификации

**Требования:** R01.4, R06i · **Зона:** `plugins/rust-studio/hooks/scripts/model-switch.ts`,
`hooks/scripts/model-switch.test.ts`, `plugins/rust-studio/evals/README.md` ·
**Блокеры:** нет · **Волна:** 1

## Почему
«Ценность скилла — свойство его связки с конкретной моделью и харнессом, и оба меняются под
тобой» (Agent Skills: Portable, Popular, Unmeasured). У плагина есть eval-сьют и есть хук
`PostModelSwitch`, который уже срабатывает на смену модели. Связи между ними нет.

## Приёмка
1. `model-switch.ts` при смене модели добавляет одну строку: eval-результаты сняты на другой
   модели, и верификация к ней привязана; `/eval-agents` — способ переснять в сессии, он
   enablement не требует. Строка короткая и не дублирует то, что хук уже говорит про гейты.
2. `evals/README.md` фиксирует правило: смена модели — повод перепрогнать сьют; названо, что
   `/eval-agents` работает без early access, в отличие от `claude plugin eval`.
3. Тест в `model-switch.test.ts` покрывает новую ветку.
4. `bun test`, `./scripts/validate-distribution.sh` — зелёные.
