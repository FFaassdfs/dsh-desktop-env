// The assistant's window logic.
//
// S1 scope (HANDOVER §57.5): card 1 - is the official desktop app installed,
// which version, where, has it ever been started, is it running right now, and a
// link to the official installer. Everything is read-only; the later cards
// (plugins / preset / safety) are placeholders in the markup so the window does
// not pretend to do more than it does.

const bridge = window.go?.main?.App;

const el = {
  versionLine: document.getElementById("versionLine"),
  badge: document.getElementById("officialBadge"),
  body: document.getElementById("officialBody"),
  note: document.getElementById("officialNote"),
  download: document.getElementById("downloadBtn"),
  pickDir: document.getElementById("pickDirBtn"),
  refresh: document.getElementById("refreshBtn"),
  status: document.getElementById("statusLine"),
};

function setStatus(text) {
  el.status.textContent = text;
}

function badge(text, kind) {
  el.badge.textContent = text;
  el.badge.className = "badge" + (kind ? " " + kind : "");
}

// esc keeps the panel safe against a path or display name that contains markup.
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function row(label, value, opts = {}) {
  const cls = opts.mono === false ? "" : " mono";
  const title = opts.title ? ` title="${esc(opts.title)}"` : "";
  return `<div class="row"><span class="k">${esc(label)}</span><span class="v${cls}"${title}>${esc(value)}</span></div>`;
}

function render(state) {
  if (!state) return;

  el.versionLine.textContent = `官方桌面版 ${state.installed ? "已安装" : "未安装"} · 共享 home ${state.dshHome}`;

  if (!state.installed) {
    badge("未安装", "warn");
    el.body.innerHTML = [
      row("状态", "未检测到官方桌面版"),
      row("下载地址", state.downloadUrl),
      row("共享 home", state.dshHome),
    ].join("");
    el.note.textContent =
      "点下面的按钮在浏览器里打开官方下载页。安装完成后回到这里点「刷新」；" +
      "首次请先启动一次官方桌面版，它会创建自己的 profile，然后才能补装插件。";
    return;
  }

  const install = state.installs[0];
  badge(`已安装 ${install.version || ""}`.trim(), "ok");
  const parts = [
    row("程序版本", install.version || "(注册表未提供)"),
    row("内置核心", install.runtimeVersion || "(未读到)"),
    row("Electron", install.electronVersion || "(未读到)"),
    row("安装位置", install.dir, { title: install.dir }),
    row("安装范围", install.userInstall ? "仅当前用户（安装时不需要管理员）" : "所有用户"),
    row("文件校验", install.signatureVerified ? "通过（exe + app.asar + runtime）" : "未通过——目录可能被移动过"),
  ];
  if (install.uninstallString) {
    parts.push(row("卸载命令", install.uninstallString, { title: install.uninstallString }));
  }
  parts.push(row("运行状态", state.running ? `正在运行（127.0.0.1:${state.port}）` : "未运行"));
  parts.push(row("官方 profile", state.profileInitialized ? "已初始化（已启动过）" : "尚未创建（还没启动过）"));
  if (state.profileInitialized) {
    const ours = state.ourPatchEntries.length;
    const total = ours + state.appPatchEntries.length;
    parts.push(row("插件条目", `本地插件 ${ours} 条 / 官方自带 ${state.appPatchEntries.length} 条`));
    if (state.patchFile) parts.push(row("配置文件", state.patchFile, { title: state.patchFile }));
    if (ours === 0 && total > 0) {
      el.note.textContent = "官方 profile 里还没有本地插件条目——下一步的「本地插件」卡片会负责注入。";
    } else if (ours > 0) {
      el.note.textContent = `已注入 ${ours} 条本地插件条目。改动后需要完全退出官方桌面版（托盘退出）再启动才会生效。`;
    } else {
      el.note.textContent = "";
    }
  } else {
    el.note.textContent = "请先启动一次官方桌面版：它会创建 profiles\\desktop，之后这里才能显示插件条目并提供注入。";
  }
  if (state.patchReadError) {
    parts.push(row("读取配置出错", state.patchReadError));
  }
  el.body.innerHTML = parts.join("");

  if (state.notes && state.notes.length) {
    el.note.textContent = state.notes.join(" ");
  }
}

async function refresh() {
  setStatus("正在检测官方桌面版…");
  try {
    const state = await bridge.OfficialState();
    render(state);
    setStatus("就绪");
  } catch (error) {
    badge("检测失败", "warn");
    el.body.innerHTML = row("错误", String(error));
    setStatus("检测失败");
  }
}

el.download.addEventListener("click", async () => {
  try {
    await bridge.OpenDownloadPage();
    setStatus("已在浏览器中打开官方下载页");
  } catch (error) {
    setStatus("打开下载页失败：" + error);
  }
});

el.pickDir.addEventListener("click", async () => {
  try {
    const install = await bridge.PickInstallDir();
    if (!install || !install.dir) {
      setStatus("已取消");
      return;
    }
    el.note.textContent = `已识别解包版安装目录：${install.dir}（版本 ${install.runtimeVersion || "未知"}）。注意：手工指定的目录只用于本次显示，重启助手后请重新指定。`;
    setStatus("已识别目录");
  } catch (error) {
    el.note.textContent = String(error);
    setStatus("目录校验失败");
  }
});

el.refresh.addEventListener("click", refresh);

// Wails injects window.go before the page runs, but be defensive: a plain
// `vite dev` preview has no bridge, and the panel should say so rather than
// throwing an unhandled TypeError.
if (!bridge) {
  setStatus("未检测到 Wails 桥接（用 wails dev/build 运行）");
} else {
  refresh();
}
