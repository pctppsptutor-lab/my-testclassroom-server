/* Content owner sets ONE link per game in /admin. The server reads it fresh when a room
 * is created and right before every new round. Games never contain the link or the answers. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { validateBank, parseDocText, readCapped, BANK_LIMITS } from './shared/question-bank.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'sources.json');
const hosts = () => (process.env.CONTENT_HOSTS || 'docs.google.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
// Google export links redirect to a googleusercontent.com download host.
const REDIRECT_HOSTS = [/^[a-z0-9-]+\.googleusercontent\.com$/];

let cache = null;
export async function listSources() {
  if (!cache) { try { cache = JSON.parse(await readFile(FILE, 'utf8')); } catch { cache = {}; } }
  return cache;
}
export async function setSource(gameId, sourceUrl) {
  if (!/^[a-z0-9-]{2,40}$/.test(gameId)) throw new Error('gameId không hợp lệ.');
  toFetchUrl(sourceUrl); // validates
  const all = await listSources();
  all[gameId] = { sourceUrl, updatedAt: new Date().toISOString() };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE + '.tmp', JSON.stringify(all, null, 2));
  await rename(FILE + '.tmp', FILE);
  return all[gameId];
}

/** Turns an owner-facing link into the URL the server actually fetches. */
export function toFetchUrl(raw) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new Error('Link không hợp lệ.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Chỉ nhận link HTTPS chuẩn.');
  if (!hosts().includes(url.hostname.toLowerCase())) throw new Error(`Máy chủ "${url.hostname}" chưa nằm trong CONTENT_HOSTS.`);
  if (url.hostname === 'docs.google.com') {
    const m = url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]{15,150})(?:\/|$)/);
    if (!m) throw new Error('Cần link Google Docs dạng https://docs.google.com/document/d/MÃ/edit');
    return { url: new URL(`https://docs.google.com/document/d/${m[1]}/export?format=txt`), kind: 'doc' };
  }
  return { url, kind: 'json' };
}

async function fetchLimited(url, { timeoutMs = 10_000, maxRedirects = 3 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      let res;
      try { res = await fetch(current, { redirect: 'manual', signal: ctl.signal, headers: { 'cache-control': 'no-cache', 'user-agent': 'EdupiaClassroomServer/1.0' } }); }
      catch { throw new Error(ctl.signal.aborted ? 'Hết thời gian tải nguồn (10 giây).' : 'Không kết nối được tới nguồn.'); }
      if (res.status >= 300 && res.status < 400) {
        const next = new URL(res.headers.get('location') || '', current);
        const ok = next.protocol === 'https:' && (hosts().includes(next.hostname) || REDIRECT_HOSTS.some(r => r.test(next.hostname)));
        if (!ok) throw new Error('Nguồn chuyển hướng tới địa chỉ không được phép.');
        current = next; continue;
      }
      if (res.status === 401 || res.status === 403 || (res.status === 200 && /accounts\.google\.com/.test(res.url))) throw new Error('Nguồn chưa cấp quyền đọc cho máy chủ.');
      if (!res.ok) throw new Error(`Nguồn trả về lỗi HTTP ${res.status}.`);
      const type = res.headers.get('content-type') || '';
      if (/text\/html/i.test(type)) throw new Error('Nguồn trả về trang web, không phải dữ liệu. Kiểm tra quyền chia sẻ.');
      return await readCapped(res, BANK_LIMITS.maxBytes);
    }
    throw new Error('Nguồn chuyển hướng quá nhiều lần.');
  } finally { clearTimeout(timer); }
}

/** Returns a validated bank (with answers) — server memory only. */
export async function loadBankForGame(gameId) {
  const all = await listSources();
  const entry = all[gameId];
  if (!entry) throw new Error('Chủ nội dung chưa đặt nguồn câu hỏi cho game này trong /admin.');
  return loadBankFromUrl(entry.sourceUrl);
}
export async function loadBankFromUrl(sourceUrl) {
  const { url, kind } = toFetchUrl(sourceUrl);
  const text = await fetchLimited(url);
  let raw;
  if (kind === 'doc') raw = parseDocText(text);
  else { try { raw = JSON.parse(text); } catch { throw new Error('Nguồn không phải JSON hợp lệ.'); } }
  return validateBank(raw);
}
