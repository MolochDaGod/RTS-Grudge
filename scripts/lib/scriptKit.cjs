/**
 * scriptKit — small reusable helpers for build scripts under scripts/.
 *
 * Goals:
 *   - One arg-parser shape so flags behave the same across scripts.
 *   - Recursive file walking with predicate filtering.
 *   - Bounded-concurrency runner so large batches don't OOM.
 *   - Progress reporter with consistent [n/total] prefix.
 *   - Failure aggregator that yields a single roll-up summary.
 *   - makeMain wrapper so any throw exits with structured output + non-zero code.
 *
 * No external deps — uses node stdlib only.
 */

const fs = require('fs');
const path = require('path');

/**
 * parseArgs(argv, spec)
 *
 * spec:
 *   {
 *     flags: { force: { type: 'boolean', alias: 'f', default: false },
 *              concurrency: { type: 'number', default: 4 },
 *              dir: { type: 'string', default: null } },
 *     positional: ['target']
 *   }
 *
 * Returns { values: { force, concurrency, dir, target }, rest: [unknownArgs] }.
 *
 * Recognised on CLI:
 *   --force                  → boolean true
 *   --no-force               → boolean false
 *   --concurrency 8          → number 8
 *   --concurrency=8          → number 8
 *   --dir foo                → string "foo"
 *   bareWord                 → consumed by positional in order
 */
function parseArgs(argv, spec = {}) {
  const flagsSpec = spec.flags || {};
  const positionalNames = spec.positional || [];

  const values = {};
  const rest = [];
  const positionals = [];

  for (const [name, def] of Object.entries(flagsSpec)) {
    values[name] = def.default !== undefined ? def.default : null;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      let key, inlineVal;
      if (eqIdx !== -1) {
        key = arg.slice(2, eqIdx);
        inlineVal = arg.slice(eqIdx + 1);
      } else {
        key = arg.slice(2);
        inlineVal = undefined;
      }

      const negated = key.startsWith('no-');
      const realKey = negated ? key.slice(3) : key;
      const def = flagsSpec[realKey];

      if (!def) { rest.push(arg); continue; }

      if (def.type === 'boolean') {
        values[realKey] = !negated;
      } else if (def.type === 'number') {
        const raw = inlineVal !== undefined ? inlineVal : argv[++i];
        const n = Number(raw);
        values[realKey] = Number.isFinite(n) ? n : def.default;
      } else {
        values[realKey] = inlineVal !== undefined ? inlineVal : argv[++i];
      }
    } else {
      positionals.push(arg);
    }
  }

  for (let i = 0; i < positionalNames.length; i++) {
    if (positionals[i] !== undefined) values[positionalNames[i]] = positionals[i];
  }
  if (positionals.length > positionalNames.length) {
    rest.push(...positionals.slice(positionalNames.length));
  }

  return { values, rest };
}

/**
 * walkGlob(rootDir, predicate, options?)
 *
 * Recursively walks rootDir and returns absolute paths where predicate(name) is true.
 * Skips directories listed in options.skipDirs (case-insensitive).
 *
 * predicate may be a function (filename) → boolean OR a RegExp tested on filename.
 */
function walkGlob(rootDir, predicate, options = {}) {
  const skipDirs = new Set((options.skipDirs || []).map(d => d.toLowerCase()));
  const results = [];

  if (!fs.existsSync(rootDir)) return results;

  const test = predicate instanceof RegExp
    ? (name) => predicate.test(name)
    : predicate;

  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name.toLowerCase())) continue;
        stack.push(full);
      } else if (entry.isFile() && test(entry.name)) {
        results.push(full);
      }
    }
  }

  return results;
}

/**
 * runWithConcurrency(items, concurrency, asyncFn)
 *
 * Runs asyncFn(item, index) over items with at most `concurrency` in flight.
 * Resolves to an array of results in input order. Failures resolve to
 * { __error: err } at the corresponding index — callers decide what to do.
 */
async function runWithConcurrency(items, concurrency, asyncFn) {
  const results = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(concurrency | 0, items.length));

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await asyncFn(items[i], i);
      } catch (err) {
        results[i] = { __error: err };
      }
    }
  }

  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/**
 * ProgressReporter
 *
 * Emits "[i/total] label ... outcome" lines on the same channel as the script.
 * Use .start(label) before a task and .end(outcome) after. Falls back to plain
 * console.log so output stays readable without TTY tricks.
 */
class ProgressReporter {
  constructor(total, { prefix = '', stream = process.stdout } = {}) {
    this.total = total;
    this.done = 0;
    this.prefix = prefix;
    this.stream = stream;
  }
  start(label) {
    this.done++;
    const head = this.prefix ? `${this.prefix} ` : '';
    this.stream.write(`${head}[${this.done}/${this.total}] ${label} ... `);
  }
  end(outcome) {
    this.stream.write(`${outcome}\n`);
  }
  log(line) {
    const head = this.prefix ? `${this.prefix} ` : '';
    this.stream.write(`${head}${line}\n`);
  }
}

/**
 * FailureAggregator
 *
 * Collects { file, error, ...meta } and emits a single summary block.
 */
class FailureAggregator {
  constructor() {
    this.failures = [];
  }
  add(entry) {
    this.failures.push(entry);
  }
  get count() {
    return this.failures.length;
  }
  printSummary(stream = process.stdout) {
    if (this.failures.length === 0) return;
    stream.write(`\n--- Failed (${this.failures.length}) ---\n`);
    for (const f of this.failures) {
      const where = f.file || f.path || '<unknown>';
      const why = f.error instanceof Error ? f.error.message : String(f.error);
      stream.write(`  ${where}: ${why}\n`);
    }
  }
}

/**
 * makeMain(asyncMain, options?)
 *
 * Wraps an async main(). On uncaught exceptions exits with code 1 and a clean
 * "[scriptName] FATAL: ..." line so CI surfaces the failure. If
 * `failOnPartial` is true and the main returns { failures: <N>0 }, the
 * process exits non-zero unless --keep-going was passed in argv.
 *
 * Usage: makeMain(async (argv) => { ... return { failures: 2 }; })()
 */
function makeMain(asyncMain, options = {}) {
  const { scriptName = path.basename(require.main?.filename || 'script') } = options;

  return async function runMain() {
    const argv = process.argv.slice(2);
    const keepGoing = argv.includes('--keep-going');

    try {
      const result = await asyncMain(argv);
      const failures = (result && typeof result === 'object' && typeof result.failures === 'number')
        ? result.failures : 0;

      if (failures > 0 && !keepGoing) {
        console.error(`\n[${scriptName}] Exiting non-zero: ${failures} failure(s). Pass --keep-going to ignore.`);
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? (err.stack || err.message) : String(err);
      console.error(`\n[${scriptName}] FATAL: ${msg}`);
      process.exit(2);
    }
  };
}

module.exports = {
  parseArgs,
  walkGlob,
  runWithConcurrency,
  ProgressReporter,
  FailureAggregator,
  makeMain,
};
