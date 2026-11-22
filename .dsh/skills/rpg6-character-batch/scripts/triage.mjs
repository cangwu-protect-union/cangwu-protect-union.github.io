import {
  argValue,
  coverage,
  findRoot,
  hasFlag,
  loadLibrary,
  loadSeed,
  printTriage,
  triageRows
} from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { rows } = coverage(loadSeed(root), await loadLibrary(root));

const only = argValue(argv, "--character");
const all = hasFlag(argv, "--all");
const selected = only ? rows.filter((r) => r.name === only) : rows;

if (only && !selected.length) {
  console.error("seed 里没有角色：" + only);
  process.exit(1);
}

const out = triageRows(selected, only ? true : all);

if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

printTriage(out);
