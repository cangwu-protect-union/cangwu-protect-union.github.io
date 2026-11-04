#!/usr/bin/env node
/* ============================================================
   tools/get-biome.js —— 下载 Biome 单文件版并校验完整性
   ------------------------------------------------------------
   本机 github.com 被 hosts 指向 127.0.0.1，拿不到 GitHub Releases，
   改从 npm 镜像取 @biomejs/cli-win32-x64，用 registry 给的 sha512 校验。

   用法：node tools/get-biome.js [版本] [输出目录]
         node tools/get-biome.js 2.6.4 _local/bin
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const VERSION = process.argv[2] || "2.6.4";
const OUT_DIR = path.resolve(process.argv[3] || path.join(__dirname, "..", "_local", "bin"));
const PLATFORM = { win32: "win32-x64", linux: "linux-x64", darwin: "darwin-arm64" }[process.platform] || "win32-x64";
const PKG = `@biomejs/cli-${PLATFORM}`;
const MIRROR = process.env.NPM_MIRROR || "https://registry.npmmirror.com";

async function main() {
  const metaUrl = `${MIRROR}/${PKG}/${VERSION}`;
  console.log("读取清单 " + metaUrl);
  const meta = await (await fetch(metaUrl)).json();
  if (!meta.dist || !meta.dist.tarball) {
    console.error("清单里没有 dist.tarball：确认版本号是否存在");
    process.exit(1);
  }

  console.log("下载 " + meta.dist.tarball);
  const res = await fetch(meta.dist.tarball);
  if (!res.ok) {
    console.error("下载失败 HTTP " + res.status);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const sha = "sha512-" + crypto.createHash("sha512").update(buf).digest("base64");
  if (sha !== meta.dist.integrity) {
    console.error("完整性校验失败，放弃安装");
    console.error("  期望 " + meta.dist.integrity);
    console.error("  实际 " + sha);
    process.exit(2);
  }
  console.log("完整性校验通过，大小 " + (buf.length / 1048576).toFixed(1) + " MB");

  const tmp = path.join(os.tmpdir(), "biome-" + Date.now() + ".tgz");
  fs.writeFileSync(tmp, buf);
  const extract = path.join(os.tmpdir(), "biome-x-" + Date.now());
  fs.mkdirSync(extract, { recursive: true });
  // stdio 保持 inherit：沙箱下捕获子进程输出的管道会 EPERM
  execFileSync("tar", ["-xzf", tmp, "-C", extract], { stdio: "inherit" });

  const exeName = process.platform === "win32" ? "biome.exe" : "biome";
  const found = findFile(extract, exeName);
  if (!found) {
    console.error("解包后没找到 " + exeName);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, exeName);
  fs.copyFileSync(found, dest);
  fs.rmSync(tmp, { force: true });
  fs.rmSync(extract, { recursive: true, force: true });
  console.log("已安装 " + dest);
  execFileSync(dest, ["--version"], { stdio: "inherit" });
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(p, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return p;
    }
  }
  return null;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
