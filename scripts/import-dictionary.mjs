import { spawnSync } from "node:child_process";
// Explicit local editorial command. No cloud credentials or personal training data are used.
for (const script of ["fetch-dictionary.py", "prepare-dictionary.py"]) {
  const result = spawnSync("python", [`scripts/${script}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
