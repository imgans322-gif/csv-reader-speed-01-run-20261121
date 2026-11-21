# Read broken CSV files faster

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/imgans322-gif/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/imgans322-gif/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

An entry for [make.fun's csv-reader-speed-01-run-20261121 bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121): a faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as it does on every case.

`solve.js` returns csv-reader's exact answer — `{columns, rows, errors}` under the same broken-row policy (BOM handling, stray CRs, quote junk, unterminated quotes, short/long row padding and cutting, and the same error order and line/row numbering) — but reads the text in slices instead of character by character: fields are located with `indexOf` jumps between the few characters that can end them, a cached next-CR position keeps sparse CRs from being rescanned at every field, and the pieces of a field are joined once. `main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each alone with `run()`, and writes `/output/answers.json`.

Verified locally against the kit's practice set: answers identical to csv-reader 1.0.0 on all 6 cases (and on 4,000 randomized broken-CSV fuzz cases), at roughly 1.8x the reference's speed including process start and JSON I/O.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<out dir> node main.ts
```
