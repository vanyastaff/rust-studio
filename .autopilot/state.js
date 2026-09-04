window.STATE =
{
  "slug": "best-rust-plugin",
  "title": "Лучший плагин для Rust-проектов",
  "mode": "full",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-04-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-09-04T12:03:34-05:00",
  "updatedAt": "2026-09-04T12:48:27-05:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-04T12:03:34-05:00",
      "finishedAt": "2026-09-04T12:04:28-05:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-04T12:04:28-05:00",
      "finishedAt": "2026-09-04T12:05:51-05:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-09-04T12:05:51-05:00",
      "note": "полный автомат — самобрифинг",
      "finishedAt": "2026-09-04T12:06:56-05:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-04T12:06:56-05:00",
      "finishedAt": "2026-09-04T12:23:03-05:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-04T12:23:03-05:00",
      "finishedAt": "2026-09-04T12:27:12-05:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-09-04T12:43:03-05:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 10,
    "done": 4,
    "inTicket": 7,
    "inSpec": 7,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "T01",
      "title": "Доктрина не утверждает о версиях, которых нет",
      "wave": 1,
      "status": "done",
      "finishedAt": "2026-09-04T12:48:27-05:00",
      "note": "клауза 1.99 хеджирована; карта покрытия опубликована с командами переснятия"
    },
    {
      "id": "T02",
      "title": "Каталог перестаёт путать соседние скиллы",
      "wave": 2,
      "status": "in-progress",
      "startedAt": "2026-09-04T12:48:27-05:00"
    },
    {
      "id": "T03",
      "title": "Плагин доказывает, что его скрипты безопасны",
      "wave": 3,
      "status": "pending"
    },
    {
      "id": "T04",
      "title": "Смена модели поднимает вопрос о верификации",
      "wave": 1,
      "status": "done",
      "finishedAt": "2026-09-04T12:48:27-05:00",
      "note": "хук связан с eval-сьютом; тест на новую ветку + тест на её отсутствие в sub-agent"
    },
    {
      "id": "T05",
      "title": "Исследование переживает прогон",
      "wave": 1,
      "status": "done",
      "finishedAt": "2026-09-04T12:43:03-05:00",
      "note": "ADR 173 строки, факты перепроверены агентом живьём; валидатор зелёный"
    },
    {
      "id": "T07",
      "title": "Гейт на frontmatter агентов (валидатор его не смотрит)",
      "wave": 2,
      "status": "pending"
    }
  ],
  "singlePass": null,
  "tests": {
    "pass": 295,
    "fail": 0,
    "at": "2026-09-04T12:48:27-05:00"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "rounds": 3,
    "round1": "FAIL — domain-neutral work",
    "round2": "FAIL — false let_chains baseline (self-corrected first)",
    "round3": "FAIL — but handed the answer: ground-truth coverage 6/33 agents, 7/20 rule domains",
    "resolution": "gate loop broken deliberately after round 3; findings adopted"
  },
  "blind": {
    "rustCapabilityBaseline": {
      "measured": "2026-09-04T12:27:12-05:00",
      "instrument": "rust-studio:rust-reviewer on a 5-defect probe",
      "letChainsCaught": true,
      "unplantedDefectsFound": [
        "i32 overflow in x-y (verified both profiles)",
        "byte-vs-char classification",
        "write-only cache"
      ],
      "toolsActuallyRun": [
        "clippy -D warnings (4 errors)",
        "edition-2024 build (2 hard errors)",
        "miri (data race confirmed)",
        "behavioural probes 4/4"
      ],
      "conclusion": "no escaped defect on let-chains -> fixture NOT authorised by benchmarks/README policy"
    }
  }
}
