# T01 — Доктрина не утверждает о версиях, которых нет

**Требования:** R01.0, R01, R05i · **Зона:** `plugins/rust-studio/docs/ci-best-practices.md`,
`plugins/rust-studio/benchmarks/README.md` · **Блокеры:** нет · **Волна:** 1

## Что не так
`docs/ci-best-practices.md`, строка про `Swatinem/rust-cache@v2`, заявляет как свершившийся
факт: «from Cargo **1.99** cargo itself disables incremental when `CI` is set, so the variable
becomes belt-and-braces, not the fix». Cargo 1.99 не выпущен — тулчейн 1.98.0, последний
релиз 1.98.1. Соседние ссылки на Cargo 1.100 в `rules/cargo-manifest.md` хеджированы правильно
(«nightly today; older cargo ignores it»), эта — нет.

## Приёмка
1. Утверждение о 1.99 хеджировано в том же стиле, что соседние про 1.100: названо как
   ожидаемое поведение будущей версии, а не как действующее. Формулировку выбрать так, чтобы
   совет (`CARGO_INCREMENTAL=0` в CI) остался верным сегодня.
2. В `benchmarks/README.md` добавлен раздел с **измеренной картой покрытия ground truth**:
   6 из 33 агентов имеют фикстуры (`api-design-lead`, `chief-architect`, `perf-engineer`,
   `rust-reviewer`, `security-auditor`, `unsafe-auditor`); 7 из 20 доменов правил покрыты;
   13 не покрыты — `async`, `build-scripts`, `cargo-manifest`, `cli`, `database`, `embedded`,
   `error-model`, `ffi`, `macros`, `observability`, `testing`, `types`, `wasm`. Раздел прямо
   говорит, что это **карта, а не список задач**: правило репозитория «фикстура рождается из
   ускользнувшего дефекта, а не из воображения» (§"What earns a new fixture") остаётся в силе.
3. Числа снимаются командой, которая записана рядом, чтобы карту можно было переснять.
4. `./scripts/validate-distribution.sh`, `bun test` — зелёные.

## Не делать
Не заводить фикстуры для непокрытых доменов. Это была бы ровно та «выдуманная» фикстура,
которую запрещает `benchmarks/README.md`.
