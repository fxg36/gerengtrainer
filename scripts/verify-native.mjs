import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createRequire } from "node:module";

const read = (file) => fs.readFile(file, "utf8");
const appId = "app.einfachenglisch.trainer";
const files = await fs.readdir("dist-native", { recursive: true });
assert(
  !files.some((file) =>
    /(^|[/\\])(sw\.js|workbox-.*|manifest\.webmanifest)$/.test(file),
  ),
  "Native build must not contain a service worker",
);
for (const root of ["android/app/src/main/assets", "ios/App/App"]) {
  const config = JSON.parse(await read(`${root}/capacitor.config.json`));
  assert.equal(config.appId, appId);
  assert.equal(config.appName, "Einfach Englisch");
  assert.equal(config.android.minWebViewVersion, 111);
  assert(
    !config.server?.url,
    "Native builds must use bundled content, not a remote server",
  );
  for (const file of files) {
    if (!(await fs.stat(path.join("dist-native", file))).isFile()) continue;
    assert.deepEqual(
      await fs.readFile(path.join(root, "public", file)),
      await fs.readFile(path.join("dist-native", file)),
      `Unsynced asset: ${root}/${file}`,
    );
  }
}
const manifest = await read("android/app/src/main/AndroidManifest.xml");
assert(
  !/READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|CAMERA|RECORD_AUDIO/.test(
    manifest,
  ),
);
assert.match(
  await read("android/app/src/main/res/xml/file_paths.xml"),
  /path="exports\/"/,
);
assert.match(await read("android/variables.gradle"), /targetSdkVersion = 36/);
assert.match(
  await read("android/app/build.gradle"),
  new RegExp(`applicationId "${appId.replaceAll(".", "\\.")}"`),
);
const privacy = await read("ios/App/App/PrivacyInfo.xcprivacy");
assert.match(privacy, /NSPrivacyAccessedAPICategoryFileTimestamp/);
assert.match(privacy, /C617\.1/);
// Parse the actual Xcode project and check that the manifest is in the Resources phase.
const require = createRequire(import.meta.url);
const xcode = require(
  require.resolve("xcode", {
    paths: [path.resolve("node_modules/@capacitor/cli")],
  }),
);
const project = xcode.project("ios/App/App.xcodeproj/project.pbxproj");
project.parseSync();
assert(
  Object.values(
    project.pbxResourcesBuildPhaseObj(project.getFirstTarget().uuid).files,
  ).some((file) => file.comment === "PrivacyInfo.xcprivacy in Resources"),
);
assert.match(
  await read("ios/App/App.xcodeproj/project.pbxproj"),
  /PRODUCT_BUNDLE_IDENTIFIER = app\.einfachenglisch\.trainer;/,
);
assert.match(await read("ios/App/App.xcodeproj/project.pbxproj"), /IPHONEOS_DEPLOYMENT_TARGET = 16\.4;/);
const icon = await sharp(
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
).metadata();
assert.equal(icon.width, 1024);
assert.equal(icon.height, 1024);
assert.equal(icon.hasAlpha, false);
console.log(
  "Native configuration, complete asset copies, privacy manifest, app identifiers and iOS icon verified. This does not compile or test the apps on devices.",
);
