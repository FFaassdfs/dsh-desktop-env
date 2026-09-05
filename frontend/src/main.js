import './style.css';
import {EventsOn} from '../wailsjs/runtime/runtime';
import {OpenBrowser, Restart, Quit, GetUpdateStatus} from '../wailsjs/go/main/App';

const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const urlEl = document.getElementById('url');
const hintEl = document.getElementById('hint');
const openBtn = document.getElementById('open');
const restartBtn = document.getElementById('restart');
const quitBtn = document.getElementById('quit');
const updateEl = document.getElementById('update');

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

GetUpdateStatus().then((s) => {
    if (s) updateEl.textContent = s;
}).catch(() => {});
