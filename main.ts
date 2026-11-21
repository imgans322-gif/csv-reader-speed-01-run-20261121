// Driver for the csv-reader-speed entry: reads every case from
// /input/cases.json (MAKEFUN_INPUT_DIR outside the sandbox), answers each
// one alone with solve.js's run(), and writes /output/answers.json
// (MAKEFUN_OUTPUT_DIR outside the sandbox), one answer per case, in order.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setFlagsFromString } from "node:v8";

// Match the house driver's V8 tuning: incremental marking off, set before
// solve.js is imported so all of its work runs under it.
setFlagsFromString("--no-incremental-marking");

const { run } = await import(new URL("./solve.js", import.meta.url).href);

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const cases = JSON.parse(readFileSync(join(inputDir, "cases.json"), "utf8"));
const answers = new Array(cases.length);
for (let i = 0; i < cases.length; i++) answers[i] = run(cases[i].input);
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "answers.json"), JSON.stringify(answers));
