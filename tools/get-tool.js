#!/usr/bin/env node
/* ============================================================
   tools/get-tool.js —— 从 GitHub Releases 装单文件工具
   ------------------------------------------------------------
   本机的 github.com 被 hosts 指向 127.0.0.1，由 Steam++ / UU 的本地代理
   用自签 CA 转发 TLS。node 自带的 CA 包不认这两个 CA，所以必须：

       node --use-system-ca tools/get-tool.js ...

   （等价写法：先导出 CA，再设 NODE_EXTRA_CA_CERTS 指向那个 pem。）

   用法：node --use-system-ca tools/get-tool.js <owner/repo> <资源名正则> [输出目录]
   例：  node --use-system-ca tools/get-tool.js gitleaks/gitleaks windows_x64 _local/bin

   校验：用 GitHub API 的 digest 字段（sha256）核对下载内容。注意这份摘要
   和数据走同一条通道，能防传输损坏，防不了代理本身。
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const [REPO, PATTERN, OUT_ARG] = process.argv.slice(2);
const OUT_DIR = path.resolve(OUT_ARG || path.join(__dirname, "..", "_local", "bin"));

if (!REPO || !PATTERN) {
  console.error("用法: node --use-system-ca tools/get-tool.js <owner/repo> <资源名正则> [输出目录]");
  process.exit(2);
}

(async () => {
  const api = `https://api.github.com/repos/${REPO}/releases/latest`;
  console.log("读取 " + api);
  const res = await fetch(api, { headers: { "user-agent": "dsh-get-tool", accept: "application/vnd.github+json" } });
  if (!res.ok) {
    console.error("GitHub API 返回 " + res.status + "。若报证书错误，命令前加 --use-system-ca 重试。");
    process.exit(1);
  }
  const release = await res.json();
  const re = new RegExp(PATTERN, "i");
  const asset = release.assets.find((a) => re.test(a.name));
  if (!asset) {
    console.error(`没有匹配 /${PATTERN}/ 的资源，可选：`);
    for (const a of release.assets) console.error("  " + a.name);
    process.exit(1);
  }
  console.log(`版本 ${release.tag_name}，资源 ${asset.name}，${(asset.size / 1048576).toFixed(1)} MB`);

  const bin = await fetch(asset.browser_download_url, { headers: { "user-agent": "dsh-get-tool" } });
  if (!bin.ok) {
    console.error("下载失败 HTTP " + bin.status);
    process.exit(1);
  }
  const buf = Buffer.from(await bin.arrayBuffer());

  if (asset.digest && asset.digest.startsWith("sha256:")) {
    const got = "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");
    if (got !== asset.digest) {
      console.error("校验失败，放弃写入");
      console.error("  期望 " + asset.digest);
      console.error("  实际 " + got);
      process.exit(2);
    }
    console.log("sha256 校验通过");
  } else {
    console.log("该资源没有 digest 字段，跳过校验");
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = path.extname(asset.name).toLowerCase();
  let target = null;

  if (ext === ".zip" || ext === ".tar" || ext === ".tgz" || ext === ".gz") {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "get-tool-"));
    const archive = path.join(tmpDir, asset.name);
    fs.writeFileSync(archive, buf);
    execFileSync("tar", ["-xf", archive, "-C", tmpDir], { stdio: "inherit" });
    target = findExe(tmpDir);
    if (!target) {
      console.error("解包后没找到可执行文件");
      process.exit(1);
    }
    const dest = path.join(OUT_DIR, path.basename(target));
    fs.copyFileSync(target, dest);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    target = dest;
  } else {
    target = path.join(OUT_DIR, asset.name);
    fs.writeFileSync(target, buf);
  }

  console.log("已安装 " + target);
  try {
    execFileSync(target, ["--version"], { stdio: "inherit" });
  } catch {
    console.log("（--version 没有输出，可手动运行一次确认）");
  }
})().catch((e) => {
  console.error(e.message);
  if (/certificate|CERT|SSL/i.test(e.message)) console.error("提示：命令前加 --use-system-ca");
  process.exit(1);
});

function findExe(dir) {
  const wanted = process.platform === "win32" ? /\.exe$/i : /^[^.]/;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findExe(p);
      if (hit) return hit;
    } else if (wanted.test(entry.name) && !/\.(md|txt|json|sig|pem)$/i.test(entry.name)) {
      return p;
    }
  }
  return null;
}
