import fs from "node:fs";
import path from "node:path";

// Keep the shipped notices tied to the installed, locked npm versions. This
// covers npm packages; the resolved Gradle/SPM inventory needs a separate audit.
const read = (file) => fs.readFileSync(file, "utf8");
const lock = JSON.parse(read("package-lock.json"));
const packages = new Set(
  Object.entries(lock.packages)
    .filter(([directory, entry]) => directory && !entry.dev)
    .map(([directory]) => directory),
);

function addRuntime(name, from = ".") {
  let directory = path.resolve(from);
  let candidate;
  while (true) {
    candidate = path.join(directory, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) break;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Missing runtime package: ${name}`);
    directory = parent;
  }
  const relative = path.relative(".", candidate).split(path.sep).join("/");
  if (packages.has(relative)) return;
  packages.add(relative);
  const metadata = JSON.parse(read(path.join(candidate, "package.json")));
  for (const dependency of Object.keys(metadata.dependencies ?? {}))
    addRuntime(dependency, candidate);
}

// Workbox is declared as a development dependency, but its service worker and
// browser runtime are shipped by the PWA build. Follow their runtime dependencies.
addRuntime("workbox-window");
addRuntime("workbox-precaching");
// Vite contributes the module-preload helper, not its whole build toolchain.
packages.add("node_modules/vite");

const sections = [
  {
    title: "Wörterbuch, Lerninhalte und Quellen",
    text: read("public/licenses/NOTICE.txt").trim(),
  },
  {
    title: "Creative Commons Attribution-ShareAlike 4.0 International",
    text: read("public/licenses/CC-BY-SA-4.0.txt").trim(),
  },
  {
    title: "wordfreq 3.1.1 – Herkunft der Häufigkeitsdaten",
    text: read("public/licenses/wordfreq-NOTICE.txt").trim(),
  },
];

for (const directory of [...packages].sort()) {
  const metadata = JSON.parse(read(`${directory}/package.json`));
  const expected = lock.packages[directory];
  if (!expected || metadata.version !== expected.version)
    throw new Error(`Installed version differs from lockfile: ${directory}`);
  const files = fs.readdirSync(directory).filter((file) =>
    /^(licen[sc]e|copying|notice)(\.[^.]+)?$/i.test(file),
  ).sort();
  if (!files.length) throw new Error(`Missing license text: ${directory}`);
  sections.push({
    title: `${metadata.name} ${metadata.version} (${metadata.license ?? "see license"})`,
    text: files.map((file) => read(path.join(directory, file)).trim()).join("\n\n"),
  });
}

const output = `${JSON.stringify(sections, null, 2)}\n`;
const destination = "src/license-notices.json";
if (process.argv.includes("--check")) {
  if (!fs.existsSync(destination) || read(destination) !== output)
    throw new Error("License notices are out of date; run npm run licenses:build.");
} else {
  fs.writeFileSync(destination, output);
}
console.log(`License notices verified for ${packages.size} locked npm packages and the dictionary data.`);
