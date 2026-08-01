import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const supportedJavaMajor = 17;
const javaHome = findJavaHome();
const androidHome = findAndroidHome();

if (!javaHome) {
  console.error(
    [
      "Inventera mera requires JDK 17 for its Android Gradle Plugin.",
      "Install JDK 17 or set INVENTERA_JAVA_HOME to its installation directory.",
      "Example: INVENTERA_JAVA_HOME=/path/to/jdk-17 npm run android",
    ].join("\n"),
  );
  process.exit(1);
}

if (process.argv.includes("--print-java-home")) {
  console.log(javaHome);
  process.exit(0);
}

const javaVersion = readJavaMajor(javaHome);
console.log(`Using JDK ${javaVersion} from ${javaHome}`);
if (androidHome) console.log(`Using Android SDK from ${androidHome}`);

const expoExecutable = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "expo.cmd" : "expo",
);
const forwardedArguments = process.argv.slice(2);
const child = spawn(expoExecutable, ["run:android", ...forwardedArguments], {
  stdio: "inherit",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ...(androidHome
      ? { ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      : {}),
    PATH: [
      join(javaHome, "bin"),
      androidHome && join(androidHome, "platform-tools"),
      process.env.PATH,
    ]
      .filter(Boolean)
      .join(delimiter),
  },
});

child.on("error", (error) => {
  console.error(`Could not start Expo Android: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

function findJavaHome() {
  const candidates = [
    process.env.INVENTERA_JAVA_HOME,
    process.env.JAVA_HOME,
    ...sdkmanCandidates(),
    ...linuxCandidates(),
    ...windowsCandidates(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (readJavaMajor(candidate) === supportedJavaMajor) return candidate;
  }
  return undefined;
}

function sdkmanCandidates() {
  const root = join(homedir(), ".sdkman", "candidates", "java");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name === "current" || name.startsWith(`${supportedJavaMajor}.`))
    .sort((left, right) => right.localeCompare(left))
    .map((name) => join(root, name));
}

function linuxCandidates() {
  const root = "/usr/lib/jvm";
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.includes("17"))
    .map((name) => join(root, name));
}

function windowsCandidates() {
  if (process.platform !== "win32") return [];
  return [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Android Studio", "jbr"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Android", "Android Studio", "jbr"),
  ].filter(Boolean);
}

function readJavaMajor(candidate) {
  const executable = join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(executable)) return undefined;
  const result = spawnSync(executable, ["-version"], { encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = /version\s+"(?:1\.)?(\d+)/.exec(output);
  return match ? Number(match[1]) : undefined;
}

function findAndroidHome() {
  const candidates = [
    process.env.INVENTERA_ANDROID_HOME,
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), "Android", "Sdk"),
    join(homedir(), "Library", "Android", "sdk"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android", "Sdk"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(join(candidate, "platforms")));
}
