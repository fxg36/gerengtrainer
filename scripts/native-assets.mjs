import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const paper = "#f1ecdf";
const icon = await fs.readFile("public/icon.svg");
const foreground = Buffer.from(icon.toString().replace(/<rect[^>]+\/>/, ""));
const res = "android/app/src/main/res";
for (const relative of await fs.readdir(res, { recursive: true })) {
  if (!relative.endsWith(".png")) continue;
  const target = path.join(res, relative);
  const { width, height } = await sharp(target).metadata();
  if (relative.includes("ic_launcher_foreground")) {
    const inset = Math.round(width * 0.19);
    const bird = await sharp(foreground)
      .resize(width - 2 * inset)
      .png()
      .toBuffer();
    await sharp({
      create: { width, height, channels: 4, background: "#00000000" },
    })
      .composite([{ input: bird, gravity: "center" }])
      .png()
      .toFile(target);
  } else if (relative.includes("ic_launcher")) {
    await sharp(icon)
      .resize(width, height)
      .flatten({ background: paper })
      .png()
      .toFile(target);
  } else if (relative.includes("splash")) {
    await splash(target, width, height);
  }
}
await sharp(icon)
  .resize(1024, 1024)
  .flatten({ background: paper })
  .png()
  .toFile("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
const splashDir = "ios/App/App/Assets.xcassets/Splash.imageset";
for (const file of await fs.readdir(splashDir)) {
  if (file.endsWith(".png"))
    await splash(path.join(splashDir, file), 2732, 2732);
}
async function splash(target, width, height) {
  const bird = await sharp(foreground)
    .resize(Math.round(Math.min(width, height) * 0.26))
    .png()
    .toBuffer();
  await sharp({ create: { width, height, channels: 3, background: paper } })
    .composite([{ input: bird, gravity: "center" }])
    .png()
    .toFile(target);
}
console.log(
  "Native icons and launch screens generated from the existing bird artwork.",
);
