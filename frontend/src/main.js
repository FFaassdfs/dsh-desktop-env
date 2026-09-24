import './style.css';
import {EventsOn} from '../wailsjs/runtime/runtime';
import {
    OpenBrowser,
    Restart,
    Quit,
    GetUpdateStatus,
    GetCoreVersions,
    UpdateCore,
    SkipCoreVersion,
    ClearSkippedCore,
    HasPluginInstaller,
    InstallBundledPlugins,
} from '../wailsjs/go/main/App';

const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const urlEl = document.getElementById('url');
const hintEl = document.getElementById('hint');
const openBtn = document.getElementById('open');
const restartBtn = document.getElementById('restart');
const quitBtn = document.getElementById('quit');
const updateEl = document.getElementById('update');
const coreInstalledEl = document.getElementById('coreInstalled');
const coreListEl = document.getElementById('coreList');
const coreFootEl = document.getElementById('coreFoot');
const coreRefreshBtn = document.getElementById('coreRefresh');
const pluginsBox = document.getElementById('pluginsBox');
const installPluginsBtn = document.getElementById('installPlugins');
const pluginsNoteEl = document.getElementById('pluginsNote');

// coreBusy 期间的点击一律忽略：安装/下载是一次性的重活，重复点击只会互相打架
let coreBusy = false;

const CHANNEL_LABELS = {stable: '正式', rc: 'rc', beta: 'beta', alpha: 'alpha'};

function channelLabel(ch) {
    return CHANNEL_LABELS[ch] || ch || '?';
}

function setStatus(text, kind) {
    statusTextEl.textContent = text;
    statusEl.classList.remove('ready', 'error');
    if (kind === 'ready') statusEl.classList.add('ready');
    if (kind === 'error') statusEl.classList.add('error');
}

EventsOn('dsh-status', (s) => setStatus(s, ''));
EventsOn('dsh-url', (u) => {
    urlEl.textContent = u;
    urlEl.title = u;
    openBtn.disabled = false;
});
EventsOn('dsh-update', (s) => {
    updateEl.textContent = s;
});
EventsOn('dsh-error', (msg) => {
    setStatus('启动失败', 'error');
    hintEl.textContent = msg;
});

openBtn.addEventListener('click', () => {
    OpenBrowser().catch(() => {});
});
restartBtn.addEventListener('click', () => {
    setStatus('正在重启…', '');
    hintEl.textContent = '';
    urlEl.textContent = '—';
    openBtn.disabled = true;
    Restart().catch(() => {});
});
quitBtn.addEventListener('click', () => {
    Quit().catch(() => {});
});

// ---- 核心版本选择器 ----

function shortDate(published) {
    // "2026-09-23 21:44" -> "09-23 21:44"；取不到就留空
    return published ? published.slice(5) : '';
}

function makeButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

function renderCore(view) {
    coreInstalledEl.textContent = view.installed || '未知';
    coreListEl.textContent = '';

    const options = view.options || [];
    if (options.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'coreEmpty';
        empty.textContent = view.error ? '读取版本失败（网络不可用）' : '没有可用版本';
        if (view.error) empty.title = view.error;
        coreListEl.appendChild(empty);
    }

    for (const opt of options) {
        const row = document.createElement('div');
        row.className = 'coreRow' + (opt.installed ? ' installed' : '');

        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.textContent = channelLabel(opt.channel);

        const ver = document.createElement('span');
        ver.className = 'ver';
        ver.textContent = opt.version;
        ver.title = opt.published ? `发布时间 ${opt.published}` : '发布时间未知';

        const tag = document.createElement('span');
        tag.className = 'tag' + (opt.newer ? ' newer' : '');
        tag.textContent = opt.installed ? '当前' : (opt.skipped ? '已跳过' : shortDate(opt.published));

        row.append(ch, ver, tag);
        // 当前版本也给一个按钮（重装/修复用），其余版本给"更新"
        row.appendChild(makeButton(opt.installed ? '重装' : '更新', 'mini primary', () => doUpdate(opt.version)));
        if (!opt.installed) {
            row.appendChild(makeButton(opt.skipped ? '取消跳过' : '跳过', 'mini ghost', () => doSkip(opt)));
        }
        coreListEl.appendChild(row);
    }

    renderCoreFoot(view);
}

function renderCoreFoot(view) {
    coreFootEl.textContent = '';
    if (view.skipped) {
        const text = document.createElement('span');
        text.className = 'footText';
        text.textContent = `已跳过 ${view.skipped}`;
        coreFootEl.appendChild(text);
        coreFootEl.appendChild(makeButton('恢复提醒', 'mini ghost', () => {
            runCoreAction(() => ClearSkippedCore());
        }));
        return;
    }
    const newest = (view.options || []).find((o) => o.newer);
    const text = document.createElement('span');
    text.className = 'footText';
    text.textContent = newest
        ? `有可用更新（${channelLabel(newest.channel)} ${newest.version}）`
        : (view.options || []).some((o) => o.installed) ? '已是最新' : '';
    coreFootEl.appendChild(text);
}

// runCoreAction 统一处理"忙碌中禁止重复点击 + 结果回显"。
async function runCoreAction(action) {
    if (coreBusy) return;
    coreBusy = true;
    setCoreButtonsDisabled(true);
    let message = '';
    try {
        message = await action();
    } catch (err) {
        message = String(err);
    } finally {
        coreBusy = false;
    }
    if (message) {
        updateEl.textContent = message;
        updateEl.title = message;
    }
    await refreshCore();
}

function setCoreButtonsDisabled(disabled) {
    coreRefreshBtn.disabled = disabled;
    for (const btn of coreListEl.querySelectorAll('button')) btn.disabled = disabled;
    for (const btn of coreFootEl.querySelectorAll('button')) btn.disabled = disabled;
}

function doUpdate(version) {
    runCoreAction(() => UpdateCore(version));
}

function doSkip(opt) {
    runCoreAction(() => (opt.skipped ? ClearSkippedCore() : SkipCoreVersion(opt.version)));
}

async function refreshCore() {
    if (coreBusy) return;
    coreBusy = true;
    try {
        const view = await GetCoreVersions();
        renderCore(view);
    } catch (err) {
        coreListEl.textContent = '';
        const empty = document.createElement('div');
        empty.className = 'coreEmpty';
        empty.textContent = '读取版本失败';
        empty.title = String(err);
        coreListEl.appendChild(empty);
    } finally {
        coreBusy = false;
    }
}

coreRefreshBtn.addEventListener('click', () => refreshCore());

GetUpdateStatus().then((s) => {
    if (s) updateEl.textContent = s;
}).catch(() => {});

refreshCore();

// ---- 预置插件安装 ----
//
// 只有便携发行包（exe 同级有 install-offline.ps1）才显示这一区：源码装的使用者
// 自己跑命令更快，壳不去猜仓库在哪。壳只负责把安装器**窗口打开**，不判断成败
// ——安装器自己有交互菜单与校验，用户装完自行决定要不要重启服务。
HasPluginInstaller().then((has) => {
    if (has) pluginsBox.hidden = false;
}).catch(() => {});

installPluginsBtn.addEventListener('click', async () => {
    installPluginsBtn.disabled = true;
    try {
        const msg = await InstallBundledPlugins();
        pluginsNoteEl.textContent = msg || '';
    } catch (err) {
        pluginsNoteEl.textContent = String(err);
    } finally {
        installPluginsBtn.disabled = false;
    }
});
