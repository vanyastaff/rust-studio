# Benchmarks: the studio measured, one column per checkpoint

The plugin's own scoreboard, in the shape a model card uses: rows are benchmarks, columns are
checkpoints (a release, or an `/evolve` round), the best judged value per row in bold. There are
two kinds of row, and they are not interchangeable:

- **Eval cases** (`evals/<case>/`, scored by `tools/eval-runner.ts`) measure behavior: did the
  studio's skills, agents and hooks do what the case's graders require. This is the judged
  metric for the plugin as an `/evolve` target.
- **Harness scores** (`tools/harness-score.ts`) count deterministic defects in the instruction
  layer. They are the no-regression floor, never the target: a column that moves only these
  rows moved nothing a user of the studio would notice.

A column names its subject model. The Claude column is the ground truth for a release claim;
an Ollama column (`glm-5.3:cloud`, `deepseek-v4-pro:cloud`, …) is free, runs in minutes, and
measures the instruction layer driven by another model family: cross-family robustness, and
the cheap rollout an improvement loop needs. Single runs carry the model's variance: a case
that moves in one column and back in the next is noise until a contrastive pair
(`--runs 2` on both trees) says otherwise.

## Eval cases: the 10-case /evolve set

Columns before `c7ae6db` measured the **installed** plugin, not the tree: `claude --plugin-dir`
loses silently to an installed plugin of the same name, and every earlier run loaded
`~/.claude/plugins/cache/vanya/rust-studio/0.56.0`. Those columns are kept as what they are, a
variance study of one unchanged subject; the staged columns are the first that measure a tree.

| case | claude · 0.52.2 · 2026-09-09 | glm-5.3 · installed 0.56.0 (variance, 1 run) | glm-5.3 · checkpoint `fbef2bb`, staged (2 runs) | glm-5.3 · round 6 `b3e824c`, staged (2 runs; holdout 1 run) |
|---|---:|---:|---:|---:|
| integrity-gamed-green | n/a | 40% | **100%** | **100%** |
| readability-self-documenting | n/a | 25% | 25% | **100%** |
| review-guard-preservation | **100%** | **100%** | **100%** | **100%** |
| repair-loop-closeout | **100%** | **100%** | n/a | **100%** |
| routing-start | n/a | **100%** | n/a | **100%** |
| scope-check-creep | n/a | 80% | n/a | **100%** |
| session-retro-evidence | **100%** | **100%** | n/a | **100%** |
| simplify-spaghetti | n/a | **100%** | n/a | **100%** |
| task-resume-evidence | **100%** ¹ | **100%** | n/a | **100%** |
| untrusted-context | n/a | **100%** | n/a | 80% ² |
| **mean** | 100% (4 cases) | 85% | 75% (3 cases) | **98%** |

¹ 75% on the first 2026-09-09 run, 100% after that day's `/spec-tasks` repair.
² One run, no studio skill fired (a routing miss on the Ollama model); the round touched
`/review` only. Round-7 candidate in the evolve log.

The round-6 change: `/review` spawns its gate lenses in the foreground. With background lenses
the completion notices land after the orchestrator has written the merged review, its one-line
reply to the trailing notice becomes the final message, and a headless host delivers only that:
readability-self-documenting lost its rename table in every checkpoint run and kept it in every
round-6 run. Foreground was not slower (review-guard 114 s and 122 s against 307 s and 268 s).

Two instrument defects surfaced on the way and are fixed in the runner: the shadowed
`--plugin-dir` (`c7ae6db`), and pinned agent models (`model: sonnet|haiku|opus`, 20 of 34
briefs) that 404 on an Ollama endpoint, so only `inherit` agents had ever run (`d0b469e` sets
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE` to the subject model).

Results: `evals/results/evolve-plugin-2026-09-17/` (`staged-ck`, `staged-r6`, `staged-r6-holdout`
are the tree measurements). Reproduce a column:

```
(export ANTHROPIC_BASE_URL=http://127.0.0.1:11434 ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_API_KEY=
 unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT
 bun tools/eval-runner.ts --model glm-5.3:cloud --grader-model glm-5.3:cloud --runs 2 --parallel 3 \
   --timeout-scale 2 --budget 50 --total-budget 500 --out evals/results/<column> \
   --case task-resume-evidence --case review-guard-preservation --case integrity-gamed-green \
   --case simplify-spaghetti --case readability-self-documenting --case scope-check-creep \
   --case repair-loop-closeout --case session-retro-evidence --case untrusted-context --case routing-start)
```

Export the variables in a subshell: a `VAR=x` prefix on zsh's `eval` never reaches the
children, and the run then hits the real Anthropic API with an Ollama model name: every case
"succeeds" at 0% in six seconds with no studio path fired. `--grader-model` must be an Ollama
model too, and the dollar figures in the results are Claude-priced and meaningless on Ollama.
The runner prints the snapshot it loaded as its first line; a run whose traces show
`~/.claude/plugins/cache/` in a skill's base directory measured the install, not the tree.

## Harness scores: the floor

| metric | round 0 (`4b8f78f`) | round 1 (`917eebc`) | round 2 (`d5020fd`) | round 6 (`b3e824c`) |
|---|---:|---:|---:|---:|
| prose_errors (min) | 189 | 179 | **171** | **171** |
| prose_warnings (min) | **2** | **2** | **2** | **2** |
| duplicate_sentences (min) | **22** | **22** | **22** | **22** |
| keep_out_hits (min) | **0** | **0** | **0** | **0** |
| tests_passed (max) | **652** | **652** | **652** | **652** |
| description_chars (info) | 6499 | 6499 | 6499 | 6499 |

`scripts/score-compare.sh --table .rust-studio/evolve/<slug>/scores/round-*.tsv` renders this
block from the score files a run leaves behind.
