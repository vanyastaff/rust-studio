<!-- autopilot:start -->
# Rust Code Studio

Плагин для кодинг-агентов, который превращает сессию в maintainer-grade Rust-студию:
директора → лиды → специалисты, path-scoped стандарты, quality-гейты и cargo-хуки.
Ставится на Claude Code, Codex и любой хост Agent Skills.

## Команды

| Команда | Что делает |
|---------|------------|
| `cd plugins/rust-studio && ./scripts/validate-distribution.sh` | Полная валидация дистрибутива |
| `cd plugins/rust-studio && bun test` | Тесты хуков и статус-линии |
| `./scripts/sync-references.sh` | Пересобрать `skills/*/references/` из `docs/` и `rules/` |
| `node scripts/generate-openai-metadata.mjs` | Пересобрать `skills/*/agents/openai.yaml` |
| `claude plugin validate --strict --json plugins/rust-studio` | Валидатор хоста |

**После правки `docs/`, `rules/`, хелперов или описаний скиллов** — прогнать
`sync-references.sh`, затем генератор метаданных, затем валидацию. CI гоняет то же самое.

Исследование за 2026-09 (Agent Skills, DeepSeek Harness, состояние тулчейна) и решения,
которые из него вышли, записаны в
[`plugins/rust-studio/docs/adr/0001-agent-skills-research-2026-09.md`](plugins/rust-studio/docs/adr/0001-agent-skills-research-2026-09.md).

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Правило: требование из `manifest.md`
может снять только пользователь.

Если работа продолжается — скажи «продолжи автопилот»: состояние поднимется
из `.autopilot/state.js`, переспрашивать ничего не нужно.
<!-- autopilot:end -->
