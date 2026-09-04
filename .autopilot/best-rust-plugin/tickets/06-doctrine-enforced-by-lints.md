# T06 — Доктрина enforce-ится линтами, а не только прозой

**Требования:** G01, R01, R06i · **Зона:** `plugins/rust-studio/docs/templates/workspace-lints.toml`,
`plugins/rust-studio/rules/unsafe.md` · **Блокеры:** нет · **Волна:** 1

## Что не так (измерено)
Плагин требует `// SAFETY:` на каждом `unsafe`-блоке — это сказано в **10 файлах** доктрины.
Шаблон `docs/templates/workspace-lints.toml`, который плагин отдаёт пользовательским проектам,
включает `pedantic`, `nursery`, `unwrap_used`, `expect_used` и ещё шесть — но **не**
`undocumented_unsafe_blocks`.

Проверено компилятором на пробе с двумя `unsafe`-блоками без комментария:
- `cargo clippy -- -W clippy::pedantic` → **0 срабатываний**;
- `cargo clippy -- -W clippy::undocumented_unsafe_blocks` → **2 срабатывания**,
  «unsafe block missing a safety comment».

`undocumented_unsafe_blocks` живёт в группе `restriction`, а не в `pedantic`, — поэтому
включение `pedantic` его не приносит. Итог: самое повторяемое Rust-правило плагина едет к
пользователю без единого механического сторожа. Собственная лестница промоушена плагина
(`docs/memory-protocol.md` §«Flagged twice is a rule, not a note») говорит: бери верхнюю
ступень, которую правило выдерживает, — линт важнее прозы.

## Приёмка
1. `workspace-lints.toml` включает `undocumented_unsafe_blocks` с однострочным обоснованием,
   которое называет замер: `pedantic` его не покрывает.
2. Пройтись по остальным правилам доктрины и добавить те линты, которые их же enforce-ят,
   **только если проверено прогоном**, что группа их не покрывает. Кандидаты:
   `multiple_unsafe_ops_per_block`, `missing_errors_doc` / `missing_panics_doc` (проверить —
   могут быть в `pedantic`), `await_holding_lock` (проверить — может быть в `suspicious`,
   то есть default-on). **Не добавлять линт, не проверив, что он нужен.**
3. `rules/unsafe.md` называет линт рядом с требованием `// SAFETY:` — чтобы правило и его
   сторож жили в одном месте.
4. Каждое утверждение о покрытии группой подтверждено выводом clippy, а не памятью.
5. `./scripts/sync-references.sh`, `./scripts/validate-distribution.sh`, `bun test` — зелёные.

## Не делать
Не включать линты «на всякий случай»: `restriction` целиком враждебна обычному коду.
Каждая добавленная строка обязана соответствовать правилу, которое доктрина уже требует.
