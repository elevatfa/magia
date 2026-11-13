const { Client, MessageEmbed, MessageAttachment, RichPresence } = require('discord.js-selfbot-v13');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { spawn, exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const readline = require('readline');
let createCanvas = null;
let canvasLoaded = false;
try {
  ({ createCanvas } = require('@napi-rs/canvas'));
  canvasLoaded = true;
  console.log('[canvas] using @napi-rs/canvas');
} catch {
  try {
    ({ createCanvas } = require('canvas'));
    canvasLoaded = true;
    console.log('[canvas] using canvas');
  } catch {
    console.warn('[canvas] no canvas package installed - pic is using online fallback');
  }
}
function picFont(size) {
  return `bold ${size}px "DejaVu Sans", "Arial", sans-serif`;
}
function resolveFfmpeg() {
  const candidates = [];
  try {
    const p = require('ffmpeg-static');
    if (p) candidates.push(p);
  } catch {}
  if (process.env.FFMPEG_PATH) candidates.unshift(process.env.FFMPEG_PATH);
  candidates.push(path.join(__dirname, 'ffmpeg'), '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', '/bin/ffmpeg');
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) {
        try {
          fs.chmodSync(c, 0o755);
        } catch {}
        return c;
      }
    } catch {}
  }
  return 'ffmpeg';
}
const ffmpegPath = resolveFfmpeg();
console.log('[ffmpeg] using:', ffmpegPath);
const TOKEN = process.env.DISCORD_TOKEN || 'NTgzNjQ5NDgzNTc3ODg0Njg1.GRcefq.R-pw_pSEscAlqF1ZNkMQmrGvdW-3bd17yIJSOw';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || '';
const AI_KEYS = [''];
const AI_MODEL = '';
const AI_BASE_URL = '';
const RAGE_MODE_ALWAYS = true;
const PRESENCE_APP_ID = '1523059091222827078';
const PRESENCE_IMAGE_URL = process.env.PRESENCE_IMAGE_URL || '';
const SCRIPT_NAME = 'knull';
const MAX_TARGETS = 20;
const REPLY_COOLDOWN = 1500;
const VOICE_TAGLINE = '';
const DATA_DIR = path.join(__dirname, 'data');
const ARHIVA_DIR = path.join(__dirname, 'arhiva');
const CRFILES_DIR = path.join(__dirname, 'crfiles');
if (!fs.existsSync(DATA_DIR))
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });
if (!fs.existsSync(ARHIVA_DIR))
  fs.mkdirSync(ARHIVA_DIR, {
    recursive: true,
  });
if (!fs.existsSync(CRFILES_DIR))
  fs.mkdirSync(CRFILES_DIR, {
    recursive: true,
  });
const SPAM_NOTES_FILE = path.join(DATA_DIR, 'spam_notepad.txt');
const REPLY_NOTES_FILE = path.join(DATA_DIR, 'reply_notepad.txt');
const BEEF_NOTES_FILE = path.join(DATA_DIR, 'beef_notepad.txt');
const GROUP_NOTES_FILE = path.join(DATA_DIR, 'group_notepad.txt');
const AFKCHECK_NOTES_FILE = path.join(DATA_DIR, 'afkcheck_notepad.txt');
const SPOTIFY_AUTH_FILE = path.join(DATA_DIR, 'spotify_auth.json');
const YTM_KEY_FILE = path.join(DATA_DIR, 'ytm_key.txt');
function getYtmKey() {
  if (process.env.YTM_KEY) return process.env.YTM_KEY;
  try {
    const k = fs.readFileSync(YTM_KEY_FILE, 'utf8').trim();
    if (k) return k;
  } catch {}
  const k = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(YTM_KEY_FILE, k, {
      mode: 0o600,
    });
  } catch {}
  return k;
}
function ytmPublicUrl() {
  const raw = process.env.YTM_PUBLIC_URL || process.env.PUBLIC_URL || SPOTIFY_REDIRECT_URI || '';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://IP-HOST:' + (process.env.DASHBOARD_PORT || process.env.PORT || '3000');
  }
}
function ytmUserscript() {
  return `// ==UserScript==
// @name         KNULL YouTube Music Presence
// @match        https://music.youtube.com/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==
(function(){
const URL_='${ytmPublicUrl()}/ytm/update?key=${getYtmKey()}';
let last='';
function send(d){try{GM_xmlhttpRequest({method:'POST',url:URL_,headers:{'Content-Type':'application/json'},data:JSON.stringify(d)});}catch(e){}}
setInterval(function(){
const v=document.querySelector('video');const m=navigator.mediaSession&&navigator.mediaSession.metadata;
if(!v||!m||!m.title){send({playing:false});return;}
const art=(m.artwork&&m.artwork.length)?m.artwork[m.artwork.length-1].src:'';
const d={playing:!v.paused&&!v.ended,title:m.title,artist:m.artist||'',album:m.album||'',cover:art,position:v.currentTime,duration:v.duration||0,url:location.href};
const k=JSON.stringify([d.playing,d.title,Math.round(d.position/5)]);
if(k!==last||Math.random()<0.25){last=k;send(d);}
},2000);
})();
`;
}
const spotifyOauthStates = new Map();
function loadSpotifyAuth() {
  try {
    return JSON.parse(fs.readFileSync(SPOTIFY_AUTH_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveSpotifyAuth(auth) {
  try {
    fs.writeFileSync(SPOTIFY_AUTH_FILE, JSON.stringify(auth, null, 2), {
      mode: 0o600,
    });
  } catch {}
}
function spotifyBasic() {
  return Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64');
}
async function exchangeSpotifyCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
  });
  const r = await axios.post('https://accounts.spotify.com/api/token', body.toString(), {
    headers: {
      Authorization: 'Basic ' + spotifyBasic(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
  });
  const auth = Object.assign({}, r.data, {
    expires_at: Date.now() + (r.data.expires_in || 3600) * 1000,
  });
  saveSpotifyAuth(auth);
  return auth;
}
async function refreshSpotifyAuth(auth) {
  if (auth.access_token && Date.now() < Number(auth.expires_at || 0) - 60000) return auth;
  if (!auth.refresh_token) throw new Error('Spotify is not connected');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refresh_token,
  });
  const r = await axios.post('https://accounts.spotify.com/api/token', body.toString(), {
    headers: {
      Authorization: 'Basic ' + spotifyBasic(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
  });
  const next = Object.assign({}, auth, r.data, {
    expires_at: Date.now() + (r.data.expires_in || 3600) * 1000,
  });
  saveSpotifyAuth(next);
  return next;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function loadNotepad(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return data
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } catch {
    return [];
  }
}
function loadLines(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return data
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}
const AUDIO_RE = /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.cache', '.npm', 'data']);
let _audioCache = {
  at: 0,
  files: [],
};
function listAudioFiles(force) {
  if (!force && Date.now() - _audioCache.at < 30000 && _audioCache.files.length) return _audioCache.files;
  const roots = [
    ARHIVA_DIR,
    CRFILES_DIR,
    __dirname,
    process.cwd(),
    process.env.HOME,
    '/home/container',
    '/home/container/arhiva',
    '/app',
    '/data',
    '/mnt/server',
  ].filter(Boolean);
  const seen = new Set();
  const seenDirs = new Set();
  const out = [];
  const deadline = Date.now() + 4000;
  const MAX_FILES = 400;
  const walk = (dir, depth) => {
    if (depth > 4 || out.length >= MAX_FILES || Date.now() > deadline) return;
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (seenDirs.has(real)) return;
    seenDirs.add(real);
    let entries;
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true,
      });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES || Date.now() > deadline) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(full, depth + 1);
      } else if (AUDIO_RE.test(e.name)) {
        const key = full.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(full);
        }
      }
    }
  };
  for (const r of roots) {
    try {
      if (r && fs.existsSync(r)) walk(r, 0);
    } catch {}
  }
  out.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  _audioCache = {
    at: Date.now(),
    files: out,
  };
  return out;
}
function findAudioFile(filename) {
  if (!filename) return null;
  const q = String(filename).trim().toLowerCase();
  const all = listAudioFiles();
  let hit = all.find((f) => path.basename(f).toLowerCase() === q);
  if (hit) return hit;
  hit = all.find((f) => path.basename(f, path.extname(f)).toLowerCase() === q);
  if (hit) return hit;
  hit = all.find((f) => path.basename(f).toLowerCase().includes(q));
  return hit || null;
}
function buildAudioResource(audioPath, volPercent) {
  const vol = Math.max(0.01, Math.min(5, (Number(volPercent) || 100) / 100));
  const ffmpegProcess = spawn(
    ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      audioPath,
      '-af',
      `volume=${vol},dynaudnorm=f=250:g=15:p=0.95:m=12:s=8,alimiter=level_in=1:level_out=1:limit=0.97:attack=5:release=50`,
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '128k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-f',
      'ogg',
      'pipe:1',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  ffmpegProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error('[ffmpeg]', msg.slice(0, 300));
  });
  ffmpegProcess.on('error', (err) => console.error('[ffmpeg spawn]', err.message));
  return createAudioResource(ffmpegProcess.stdout, {
    inputType: StreamType.OggOpus,
  });
}
function playLoop(vs) {
  if (!vs?.player || !vs.currentFile || !vs.loop) return;
  const player = vs.player;
  const playNext = () => {
    if (!vs.loop || !vs.currentFile || vs.connection?.state?.status !== VoiceConnectionStatus.Ready) return;
    try {
      player.play(buildAudioResource(vs.currentFile, vs.volume));
    } catch (err) {
      console.error('[VOICE PLAY]', err.message);
    }
  };
  player.removeAllListeners(AudioPlayerStatus.Idle);
  player.on(AudioPlayerStatus.Idle, () => {
    if (vs.loop) setTimeout(playNext, 200);
  });
  playNext();
}
async function generatePicImage(customText) {
  const text = String(customText || '').trim();
  if (canvasLoaded && createCanvas) {
    try {
      const width = 1000,
        height = 560,
        pad = 60;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = width - pad * 2;
      const maxH = height - pad * 2;
      const wrapAt = (size) => {
        ctx.font = picFont(size);
        const lines = [];
        for (const para of text.split('\n')) {
          let line = '';
          for (let word of para.split(/\s+/).filter(Boolean)) {
            while (ctx.measureText(word).width > maxW) {
              let cut = word.length;
              while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxW) cut--;
              if (line) {
                lines.push(line);
                line = '';
              }
              lines.push(word.slice(0, cut));
              word = word.slice(cut);
            }
            const test = line ? line + ' ' + word : word;
            if (line && ctx.measureText(test).width > maxW) {
              lines.push(line);
              line = word;
            } else line = test;
          }
          lines.push(line);
        }
        return lines.length ? lines : [''];
      };
      let size = 110,
        lines = wrapAt(size);
      while (size > 6) {
        lines = wrapAt(size);
        if (lines.length * size * 1.25 <= maxH) break;
        size -= 2;
      }
      if (lines.length * size * 1.25 > maxH) {
        const maxLines = Math.max(1, Math.floor(maxH / (size * 1.25)));
        lines = lines.slice(0, maxLines);
      }
      ctx.font = picFont(size);
      const lh = size * 1.25;
      const startY = height / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * lh));
      return canvas.toBuffer('image/png');
    } catch (err) {
      console.warn('[canvas] error, falling back to dummy:', err.message);
    }
  }
  const words = text.split(/\s+/).filter(Boolean);
  const perLine = Math.max(12, Math.min(28, Math.ceil(Math.sqrt(text.length * 2))));
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > perLine) {
      if (line) lines.push(line);
      line = w;
    } else line = (line ? line + ' ' : '') + w;
  }
  if (line) lines.push(line);
  const encoded = encodeURIComponent(lines.join('\n') || ' ');
  const url = `https://dummyimage.com/1000x560/000000/ffffff.png&text=${encoded}`;
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  return Buffer.from(resp.data);
}
const RAGE_SYSTEM_PROMPT = `You are a brutally vulgar, unhinged rage machine. Rules you ALWAYS follow:
- Respond ONLY in English, every single time.
- Use heavy profanity and insults in every reply - the nastier the better.
- Be extremely aggressive, savage, and offensive toward the person talking to you.
- Keep replies SHORT and devastating: 1 sentence, max 12 words, pure rage.
- Never be polite, helpful, or kind. Never apologize. Always attack back harder.
- Never explain yourself, never use quotes, just hit.`;
const CALM_SYSTEM_PROMPT = `You reply like a normal human on Discord. Short, casual, max 1-2 short sentences. No emojis unless needed. Never mention being an AI.`;
let rageMode = RAGE_MODE_ALWAYS;
const aiConfig = {
  key: (
    AI_KEYS.find((k) => k && k.trim()) ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim(),
  model: (AI_MODEL || process.env.AI_MODEL || '').trim(),
  base: (AI_BASE_URL || process.env.AI_BASE_URL || '').replace(/\/+$/, ''),
};
function aiProvider() {
  const k = aiConfig.key || '';
  if (aiConfig.base)
    return {
      kind: 'openai',
      base: aiConfig.base,
      model: aiConfig.model || 'gpt-4o-mini',
    };
  if (/^AIza/.test(k))
    return {
      kind: 'gemini',
      base: 'https://generativelanguage.googleapis.com/v1beta',
      model: aiConfig.model || 'gemini-2.0-flash',
    };
  if (/^sk-ant-/.test(k))
    return {
      kind: 'anthropic',
      base: 'https://api.anthropic.com/v1',
      model: aiConfig.model || 'claude-3-5-haiku-latest',
    };
  if (/^gsk_/.test(k))
    return {
      kind: 'openai',
      base: 'https://api.groq.com/openai/v1',
      model: aiConfig.model || 'llama-3.3-70b-versatile',
    };
  if (/^sk-or-/.test(k))
    return {
      kind: 'openai',
      base: 'https://openrouter.ai/api/v1',
      model: aiConfig.model || 'openai/gpt-4o-mini',
    };
  if (/^xai-/.test(k))
    return {
      kind: 'openai',
      base: 'https://api.x.ai/v1',
      model: aiConfig.model || 'grok-2-latest',
    };
  if (/^sk-/.test(k))
    return {
      kind: 'openai',
      base: 'https://api.openai.com/v1',
      model: aiConfig.model || 'gpt-4o-mini',
    };
  return {
    kind: 'gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    model: aiConfig.model || 'gemini-2.0-flash',
  };
}
async function askAI(prompt, history = []) {
  if (!aiConfig.key) return 'AI key is missing (put it in AI_KEYS in the script)';
  const sys = rageMode ? RAGE_SYSTEM_PROMPT : CALM_SYSTEM_PROMPT;
  const hist = (history || []).slice(-8);
  const pr = aiProvider();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (pr.kind === 'gemini') {
        const contents = hist.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [
            {
              text: String(h.content).slice(0, 500),
            },
          ],
        }));
        contents.push({
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        });
        const r = await axios.post(
          `${pr.base}/models/${pr.model}:generateContent?key=${aiConfig.key}`,
          {
            system_instruction: {
              parts: [
                {
                  text: sys,
                },
              ],
            },
            contents,
            generationConfig: {
              temperature: 1.1,
              maxOutputTokens: 80,
            },
            safetySettings: [
              'HARM_CATEGORY_HARASSMENT',
              'HARM_CATEGORY_HATE_SPEECH',
              'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              'HARM_CATEGORY_DANGEROUS_CONTENT',
            ].map((c) => ({
              category: c,
              threshold: 'BLOCK_NONE',
            })),
          },
          {
            timeout: 12000,
          },
        );
        const t = r.data?.candidates?.[0]?.content?.parts
          ?.map((x) => x.text)
          .join(' ')
          .trim();
        if (t) return t.slice(0, 300);
      } else if (pr.kind === 'anthropic') {
        const r = await axios.post(
          `${pr.base}/messages`,
          {
            model: pr.model,
            max_tokens: 80,
            system: sys,
            messages: [
              ...hist.map((h) => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: String(h.content).slice(0, 500),
              })),
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          {
            headers: {
              'x-api-key': aiConfig.key,
              'anthropic-version': '2023-06-01',
            },
            timeout: 12000,
          },
        );
        const t = r.data?.content
          ?.map((x) => x.text)
          .join(' ')
          .trim();
        if (t) return t.slice(0, 300);
      } else {
        const r = await axios.post(
          `${pr.base}/chat/completions`,
          {
            model: pr.model,
            max_tokens: 80,
            temperature: 1.1,
            messages: [
              {
                role: 'system',
                content: sys,
              },
              ...hist.map((h) => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: String(h.content).slice(0, 500),
              })),
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${aiConfig.key}`,
            },
            timeout: 12000,
          },
        );
        const t = r.data?.choices?.[0]?.message?.content?.trim();
        if (t) return t.slice(0, 300);
      }
    } catch (err) {
      const st = err.response?.status;
      if (attempt === 0 && (st === 429 || st >= 500 || err.code === 'ECONNABORTED')) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      console.error(
        '[ai]',
        st || '',
        (err.response?.data?.error?.message || err.message || '').slice(0, 120),
      );
      return rageMode ? 'shut the fuck up' : 'ok';
    }
  }
  return rageMode ? 'shut the fuck up' : 'ok';
}
const askGemini = (prompt, history) => askAI(prompt, history);
const activeBots = new Map();
const botControls = new Map();
const botIndexes = new Map();
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
let savedTokens = [];
try {
  savedTokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) || [];
} catch {
  savedTokens = [];
}
function persistTokens() {
  try {
    fs.mkdirSync(DATA_DIR, {
      recursive: true,
    });
  } catch {}
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(savedTokens, null, 2));
  } catch {}
}
function rememberToken(token, index, commands) {
  savedTokens = savedTokens.filter((e) => e.token !== token && e.index !== index);
  savedTokens.push({
    token,
    index,
    commands: !!commands,
  });
  persistTokens();
}
function forgetToken(token) {
  savedTokens = savedTokens.filter((e) => e.token !== token);
  persistTokens();
}
function nextFreeIndex() {
  for (let i = 2; i <= 20; i++) if (!botIndexes.has(i)) return i;
  return null;
}
const NO_INDEX_ROUTE = new Set([
  'delay',
  'rdelay',
  'delayspiced',
  'delaychannel',
  'delayreply',
  'replydelay',
  'replygap',
  'delayatbf',
  'delayloop',
  'volume',
  'vol',
  'clear',
  'say',
  '0',
]);
function createBot(token, options = {}) {
  const BOT_INDEX = Number(options.index) || 1;
  const VOICE_GROUP = 'knull-idx-' + BOT_INDEX;
  const COMMANDS_ENABLED = options.commands === undefined ? BOT_INDEX === 1 : !!options.commands;
  const startTime = Date.now();
  const voiceStates = {};
  function activeVs(ctx) {
    const g = ctx && ctx.guild ? voiceStates[ctx.guild.id] : null;
    if (g && g.connection) return g;
    return (
      Object.values(voiceStates).find((v) => v && v.connection) ||
      (ctx && ctx.guild
        ? getVoiceState(ctx.guild.id)
        : {
            connection: null,
          })
    );
  }
  const replyState = {
    running: false,
    targets: [],
    lastReplyTime: {},
    replyDelays: {},
    lineIndex: 0,
    cycle: 1,
  };
  const aiState = {
    running: false,
    targets: [],
    lastReplyTime: {},
    history: {},
    cycle: 1,
  };
  const customReplyState = {};
  const mockTargets = {};
  const mockLastTime = {};
  const copyTargets = {};
  const copyLastTime = {};
  const activeDrags = {};
  const spamState = {
    running: false,
    type: null,
    target: null,
    channelId: null,
    targets: [],
    phraseIndex: 0,
    interval: null,
    delay: 3,
    startedAt: 0,
  };
  const repeatState = {
    running: false,
    channelId: null,
    target: null,
    text: '',
    interval: null,
    startedAt: 0,
  };
  const beeferState = {
    running: false,
    channelId: null,
    targetId: null,
    phrases: [],
    index: 0,
    interval: null,
    delay: 3,
    startedAt: 0,
  };
  const STEAL_IDLE_MS = 60 * 60 * 1000;
  const stealState = {
    active: false,
    sourceChannelId: null,
    targets: new Set(),
    anyUser: false,
    outputChannel: null,
    byUser: new Map(),
    names: new Map(),
    seen: new Set(),
    fileName: null,
    startedAt: 0,
    lastActivity: 0,
    idleTimer: null,
  };
  let spotifyPoll = null;
  let ytmState = {
    last: 0,
    key: '',
    posAt: 0,
    playing: false,
    title: '',
    artist: '',
  };
  let ytmWatch = null;
  let spotifyLastTrack = '';
  let spotifyLastProgress = -1;
  const typingFakeIntervals = new Map();
  const KNULL_COUNTERS = {
    sent: 0,
    cmds: 0,
  };
  let spamPhrases = loadNotepad(SPAM_NOTES_FILE);
  let replyWords = loadNotepad(REPLY_NOTES_FILE);
  let beefPhrases = loadNotepad(BEEF_NOTES_FILE);
  let streamRefreshInterval = null;
  const groupNameState = {
    interval: null,
    channelId: null,
    index: 0,
  };
  let globalDelay = 5;
  let replyDelay = 7;
  let replyGap = 3;
  function parseDelaySec(v, max = 50) {
    const t = String(v ?? '')
      .replace(',', '.')
      .replace(/s$/i, '');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = Math.round(parseFloat(t) * 10) / 10;
    if (!isFinite(n) || n < 0 || n > max) return null;
    return n;
  }
  const DELAY_WAKERS = new Set();
  function wakeDelays() {
    for (const w of [...DELAY_WAKERS]) {
      try {
        w();
      } catch {}
    }
  }
  function liveWait(getSec, isStopped) {
    return new Promise((resolve) => {
      const start = Date.now();
      let t = null;
      const done = () => {
        DELAY_WAKERS.delete(check);
        if (t) clearTimeout(t);
        resolve();
      };
      const check = () => {
        if (t) {
          clearTimeout(t);
          t = null;
        }
        if (isStopped()) return done();
        const ms = Math.max(0, (Number(getSec()) || 0) * 1000) - (Date.now() - start);
        if (ms <= 0) return done();
        t = setTimeout(check, Math.min(ms, 1000));
      };
      DELAY_WAKERS.add(check);
      check();
    });
  }
  function liveLoop(getSec, isStopped, fn) {
    let running = true;
    const stop = () => {
      running = false;
      wakeDelays();
    };
    (async () => {
      while (running && !isStopped()) {
        await liveWait(getSec, () => !running || isStopped());
        if (!running || isStopped()) break;
        try {
          await fn();
        } catch {}
        if (Number(getSec()) < 0.3) await sleep(150);
      }
    })();
    return {
      stop,
    };
  }
  function clearLive(h) {
    try {
      if (h && typeof h.stop === 'function') h.stop();
      else if (h) {
        clearInterval(h);
        clearTimeout(h);
      }
    } catch {}
  }
  let spamDelay = 4;
  let channelDelay = 4;
  const UTIL_FILE = path.join(DATA_DIR, 'knull_utility.json');
  let utilStore = {};
  try {
    utilStore = JSON.parse(fs.readFileSync(UTIL_FILE, 'utf8'));
  } catch {
    utilStore = {};
  }
  const delayList = new Map(Object.entries(utilStore.delays || {}));
  let specialUsers = new Set(utilStore.special || []);
  let antiGc = !!utilStore.antigc;
  const antiTag = Object.assign(
    {
      on: false,
      scope: null,
      lines: [],
      text: '',
    },
    utilStore.antitag || {},
  );
  const runningScripts = new Map();
  let lachitiList = Array.isArray(utilStore.lachiti) ? utilStore.lachiti.slice() : [];
  function persistUtil() {
    try {
      fs.writeFileSync(
        UTIL_FILE,
        JSON.stringify(
          {
            delays: Object.fromEntries(delayList),
            special: [...specialUsers],
            antigc: antiGc,
            antitag: antiTag,
            lachiti: lachitiList,
          },
          null,
          2,
        ),
      );
    } catch {}
  }
  function pickDelay(channelId) {
    const e = delayList.get(String(channelId)) || delayList.get('global');
    if (!e) return null;
    return e.type === 'rand' ? Math.random() * (e.max - e.min) + e.min : e.sec;
  }
  let afkMode = false,
    afkReason = '';
  const AFK_MSG_FILE = path.join(DATA_DIR, 'afk_phrases.txt');
  const AFK_DEFAULT_PHRASES = [
    "the boss is sleeping, he'll text you later",
    "the boss is away, he'll get back to you later",
  ];
  let afkPhrases = [];
  function loadAfkPhrases() {
    const l = loadLines(AFK_MSG_FILE);
    afkPhrases = l.filter(Boolean);
    return afkPhrases;
  }
  function saveAfkPhrases() {
    try {
      fs.writeFileSync(AFK_MSG_FILE, afkPhrases.join('\n'));
    } catch {}
  }
  function afkReplyText() {
    const pool = afkPhrases.length ? afkPhrases : AFK_DEFAULT_PHRASES;
    const t = pool[Math.floor(Math.random() * pool.length)];
    return afkReason ? `${t} (${afkReason})` : t;
  }
  loadAfkPhrases();
  let afkCheckMode = false,
    afkCheckInterval = null,
    afkCheckChannel = null,
    afkCheckIndex = 0;
  const AFKCHECK_DEFAULT_PHRASES = [
    'sup, im here pussy',
    'deplasa ma iei',
    'atatea suge mt?',
    '1,2,3 deplasa ma iei',
    'u came to suck me off?',
    "wait, i'm coming for you",
  ];
  let afkCheckPhrases = AFKCHECK_DEFAULT_PHRASES.slice();
  function loadAfkCheckPhrases() {
    const lines = loadLines(AFKCHECK_NOTES_FILE);
    afkCheckPhrases = lines.length ? lines : AFKCHECK_DEFAULT_PHRASES.slice();
    return afkCheckPhrases;
  }
  loadAfkCheckPhrases();
  const afkCheckWatch = new Map();
  const AFKCHECK_WATCH_MS = 30 * 60 * 1000;
  const AFKCHECK_MIN_GAP = 1500;
  function afkNextPhrase() {
    const pool = afkCheckPhrases.length ? afkCheckPhrases : AFKCHECK_DEFAULT_PHRASES;
    return pool[afkCheckIndex++ % pool.length];
  }
  function isCountingMessage(txt) {
    const t = (txt || '').trim();
    if (!t) return false;
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length || lines.length > 60) return false;
    return lines.every((l) => /^\d{1,6}([.,)\-]|\s|$)*$/.test(l) || /^\d{1,6}$/.test(l));
  }
  let snipeCache = {};
  let editSnipeCache = {};
  let isStreaming = false;
  const STREAM_LINK = 'https://www.youtube.com/watch?v=mJzqblu3ffo';
  const STREAM_APP_ID = PRESENCE_APP_ID;
  let STREAM_IMAGE_URL = PRESENCE_IMAGE_URL;
  let streamCurrentName = '';
  const tagAllRunning = {};
  const autoreactActive = {};
  const channelReact = {};
  let desiredStatus = 'online';
  const LOOP_KINDS = ['delay', 'custom', 'channel', 'repeat'];
  const LOOPS = {
    delay: new Map(),
    custom: new Map(),
    channel: new Map(),
    repeat: new Map(),
  };
  let LOOP_SEQ = 0;
  function loopHumanAgo(ms) {
    let s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    const out = [];
    if (d) out.push(d + 'd');
    if (d || h) out.push(h + 'h');
    out.push(m + 'm');
    out.push(s + 's');
    return out.join(' ');
  }
  function loopAdd(kind, channelId, meta) {
    const id = ++LOOP_SEQ;
    const entry = Object.assign(
      {
        id,
        kind,
        channelId: String(channelId),
        startedAt: Date.now(),
      },
      meta || {},
    );
    LOOPS[kind].set(id, entry);
    return entry;
  }
  function loopKill(entry) {
    if (!entry) return false;
    if (entry.interval) {
      clearLive(entry.interval);
      entry.interval = null;
    }
    if (entry.timer) {
      try {
        clearTimeout(entry.timer);
      } catch {}
      entry.timer = null;
    }
    entry.stopped = true;
    LOOPS[entry.kind].delete(entry.id);
    return true;
  }
  function loopStopChannel(kind, channelId) {
    let n = 0;
    for (const e of [...LOOPS[kind].values()]) {
      if (!channelId || e.channelId === String(channelId)) {
        loopKill(e);
        n++;
      }
    }
    return n;
  }
  function loopStopAll() {
    let n = 0;
    for (const k of LOOP_KINDS) n += loopStopChannel(k, null);
    return n;
  }
  function loopSection(title, kind) {
    const list = [...LOOPS[kind].values()];
    const lines = [title + ' loops: ' + list.length];
    for (const e of list) {
      const who = e.target
        ? ' <@' + e.target + '>'
        : e.targets
          ? ' ' + e.targets.map((t) => '<@' + t + '>').join(' ')
          : '';
      const suffix = who + ' | **started ' + loopHumanAgo(Date.now() - e.startedAt) + ' ago**';
      lines.push('  - <#' + e.channelId + '> (`' + e.channelId + '`)' + suffix);
    }
    return lines.join('\n');
  }
  function voiceSummary() {
    const active = Object.values(voiceStates).filter((v) => v && v.connection);
    if (!active.length) return 'not connected';
    const one = active[0];
    const f = one.currentFile ? require('path').basename(one.currentFile) : 'nimic';
    return 'connected (' + active.length + ') | ' + f + ' | vol ' + (one.volume || 100);
  }
  function spamLoopEntries() {
    const out = [];
    if (spamState.running && spamState.channelId)
      out.push({
        channelId: spamState.channelId,
        startedAt: spamState.startedAt || Date.now(),
      });
    if (repeatState.running && repeatState.channelId)
      out.push({
        channelId: repeatState.channelId,
        startedAt: repeatState.startedAt || Date.now(),
      });
    if (beeferState.running && beeferState.channelId)
      out.push({
        channelId: beeferState.channelId,
        startedAt: beeferState.startedAt || Date.now(),
      });
    return out;
  }
  function renderRunStatus() {
    const customEntries = [...LOOPS.custom.values()]
      .map((e) => ({
        channelId: e.channelId,
        startedAt: e.startedAt,
      }))
      .concat(spamLoopEntries());
    const customLines = ['custom loops: ' + customEntries.length];
    for (const e of customEntries) {
      customLines.push(
        '  - <#' +
          e.channelId +
          '> (`' +
          e.channelId +
          '`) | **started ' +
          loopHumanAgo(Date.now() - e.startedAt) +
          ' ago**',
      );
    }
    return [
      'voice: ' + voiceSummary(),
      'status: ' + desiredStatus,
      '',
      loopSection('delay', 'delay'),
      '',
      loopSection('startchannel', 'channel'),
      '',
      loopSection('startrepeat', 'repeat'),
      '',
      customLines.join('\n'),
      '',
      'anti gc: ' + (antiGc ? 'on' : 'off'),
    ].join('\n');
  }
  let reverseMode = false;
  let mentionTargetId = null;
  let dmlogActive = true;
  let svlogActive = true;
  function findCrFile(filename) {
    const dirs = [CRFILES_DIR, ARHIVA_DIR, __dirname];
    for (const dir of dirs) {
      const full = path.join(dir, filename);
      if (fs.existsSync(full)) return full;
    }
    return null;
  }
  async function fetchUserFull(userId) {
    let user = null;
    user = botClient.users.cache.get(userId) || null;
    if (!user) {
      try {
        user = await botClient.users.fetch(userId);
      } catch {}
    }
    if (!user?.avatar) {
      try {
        const f = await botClient.users.fetch(userId, {
          force: true,
        });
        if (f) user = f;
      } catch {}
    }
    let member = null;
    if (!user?.avatar) {
      for (const g of botClient.guilds.cache.values()) {
        try {
          const m = await g.members.fetch({
            user: userId,
            force: true,
          });
          if (m) {
            member = m;
            break;
          }
        } catch {}
      }
    }
    const tag = user?.tag || user?.username || String(userId);
    return {
      id: userId,
      tag,
      avatar: user?.avatar || member?.user?.avatar || null,
      guildAvatar: member?.avatar || null,
      guildId: member?.guild?.id || null,
      banner: user?.banner || null,
      user,
    };
  }
  async function sendImageFile(channel, url, filename) {
    try {
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
      });
      const buf = Buffer.from(resp.data);
      await channel.send({
        files: [new MessageAttachment(buf, filename)],
      });
      return true;
    } catch (e) {
      console.error('[sendImageFile]', e.response?.status || e.message);
      return false;
    }
  }
  async function resolveUserId(ctx, rawArg) {
    const arg = (rawArg || '').trim();
    if (!arg) {
      try {
        if (ctx?.reference?.messageId) {
          const ref = await ctx.channel.messages.fetch(ctx.reference.messageId);
          if (ref?.author?.id) return ref.author.id;
        }
      } catch {}
      try {
        if (ctx?.channel?.type === 'DM' && ctx.channel.recipient?.id) return ctx.channel.recipient.id;
      } catch {}
      return botClient.user.id;
    }
    const m = arg.match(/<@!?(\d+)>/);
    if (m) return m[1];
    const digits = arg.replace(/\D/g, '');
    if (/^\d{17,20}$/.test(digits)) return digits;
    try {
      const first = ctx?.mentions?.users?.first?.();
      if (first) return first.id;
    } catch {}
    const needle = arg.toLowerCase().replace(/^@/, '');
    const match = (u) =>
      u &&
      (String(u.username || '').toLowerCase() === needle ||
        String(u.globalName || u.global_name || '').toLowerCase() === needle ||
        String(u.tag || '').toLowerCase() === needle ||
        String(u.username || '')
          .toLowerCase()
          .includes(needle) ||
        String(u.globalName || u.global_name || '')
          .toLowerCase()
          .includes(needle));
    try {
      for (const ch of botClient.channels.cache.values()) {
        if (ch?.type === 'DM' && match(ch.recipient)) return ch.recipient.id;
        if (ch?.type === 'GROUP_DM' && ch.recipients) {
          for (const u of ch.recipients.values()) if (match(u)) return u.id;
        }
      }
    } catch {}
    try {
      for (const u of botClient.users.cache.values()) if (match(u)) return u.id;
    } catch {}
    try {
      if (ctx?.guild) {
        const found = await ctx.guild.members
          .fetch({
            query: needle,
            limit: 5,
          })
          .catch(() => null);
        const first = found?.first?.();
        if (first) return first.id;
      }
    } catch {}
    try {
      for (const rel of botClient.relationships?.cache?.values?.() || []) {
        const u = rel?.user || rel;
        if (match(u)) return u.id || u.user?.id;
      }
    } catch {}
    return null;
  }
  function mockText(text) {
    return text
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
      .join('');
  }
  async function silentLeaveGc(gid) {
    const sp = Buffer.from(
      JSON.stringify({
        os: 'Windows',
        browser: 'Discord Client',
        release_channel: 'stable',
        client_version: '1.0.9163',
        os_version: '10.0.19045',
        os_arch: 'x64',
        system_locale: 'en-US',
        client_build_number: 460000,
      }),
    ).toString('base64');
    const headers = {
      Authorization: token,
      'Content-Type': 'application/json',
      'X-Super-Properties': sp,
      'X-Discord-Locale': 'en-US',
      Origin: 'https://discord.com',
      Referer: 'https://discord.com/channels/@me',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/124.0.6367.243 Electron/30.2.0 Safari/537.36',
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await axios.delete(`https://discord.com/api/v9/channels/${gid}?silent=true`, {
          headers,
          timeout: 15000,
        });
        return true;
      } catch (e) {
        if (e.response?.status === 429) {
          await sleep(Math.ceil((e.response.data?.retry_after || 1) * 1000) + 250);
          continue;
        }
        console.error('[gcleave]', e.response?.data?.message || e.message);
        return false;
      }
    }
    return false;
  }
  function uptime() {
    const s = Math.floor(process.uptime());
    const d = Math.floor(s / 86400),
      h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return (d > 0 ? pad(d) + ':' : '') + pad(h) + ':' + pad(m) + ':' + pad(sec);
  }
  async function applyStatus(s) {
    desiredStatus = s;
    const acts = botClient.user?.presence?.activities || [];
    try {
      botClient.ws.broadcast({
        op: 3,
        d: {
          since: s === 'idle' ? Date.now() : 0,
          activities: acts.map((a) => ({
            name: a.name,
            type: typeof a.type === 'number' ? a.type : 0,
            url: a.url || undefined,
          })),
          status: s,
          afk: s === 'idle',
        },
      });
    } catch (e) {
      console.error('[status ws]', e.message?.slice(0, 80));
    }
    try {
      await botClient.user.setPresence({
        status: s,
        activities: acts,
      });
    } catch {}
    try {
      botClient.user.setStatus(s);
    } catch {}
    try {
      await axios.patch(
        'https://discord.com/api/v9/users/@me/settings',
        {
          status: s,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
          timeout: 10000,
        },
      );
    } catch (e) {
      console.error('[status api]', e.response?.status || e.message?.slice(0, 60));
    }
    return s;
  }
  let vrSessions = [];
  let vrActive = false;
  let vrStatus = 'online';
  function openGhostSession(kind, status) {
    let WS;
    try {
      WS = require('ws');
    } catch {
      return null;
    }
    const props =
      kind === 'mobile'
        ? {
            os: 'Android',
            browser: 'Discord Android',
            device: 'android',
          }
        : kind === 'pc'
          ? {
              os: 'Windows',
              browser: 'Discord Client',
              device: '',
              system_locale: 'en-US',
            }
          : {
              os: 'Android',
              browser: 'Discord Embedded',
              device: 'quest',
            };
    const sess = {
      kind,
      ws: null,
      hb: null,
      closed: false,
    };
    const connect = () => {
      if (sess.closed) return;
      let ws;
      try {
        ws = new WS('wss://gateway.discord.gg/?v=9&encoding=json');
      } catch {
        return;
      }
      sess.ws = ws;
      ws.on('message', (raw) => {
        let p;
        try {
          p = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (p.op === 10) {
          const int = p.d?.heartbeat_interval || 41250;
          if (sess.hb) clearInterval(sess.hb);
          sess.hb = setInterval(() => {
            try {
              ws.send(
                JSON.stringify({
                  op: 1,
                  d: null,
                }),
              );
            } catch {}
          }, int);
          try {
            ws.send(
              JSON.stringify({
                op: 2,
                d: {
                  token,
                  capabilities: 16381,
                  properties: props,
                  presence: {
                    status: sess.status || status,
                    since: 0,
                    activities: [],
                    afk: false,
                  },
                  compress: false,
                },
              }),
            );
          } catch {}
        }
      });
      ws.on('close', () => {
        if (sess.hb) {
          clearInterval(sess.hb);
          sess.hb = null;
        }
        if (!sess.closed) setTimeout(connect, 5000);
      });
      ws.on('error', () => {});
    };
    sess.status = status;
    sess.setStatus = (s) => {
      sess.status = s;
      try {
        sess.ws?.send(
          JSON.stringify({
            op: 3,
            d: {
              since: 0,
              activities: [],
              status: s,
              afk: false,
            },
          }),
        );
      } catch {}
    };
    sess.close = () => {
      sess.closed = true;
      if (sess.hb) clearInterval(sess.hb);
      try {
        sess.ws?.close();
      } catch {}
    };
    connect();
    return sess;
  }
  function startVrMode(status) {
    stopVrMode();
    vrStatus = status || 'online';
    vrActive = true;
    const a = openGhostSession('vr', vrStatus);
    const b = openGhostSession('mobile', vrStatus);
    vrSessions = [a, b].filter(Boolean);
    return vrSessions.length > 0;
  }
  function stopVrMode() {
    for (const s of vrSessions) {
      try {
        s.close();
      } catch {}
    }
    vrSessions = [];
    vrActive = false;
  }
  function vrSetStatus(s) {
    vrStatus = s;
    for (const x of vrSessions) {
      try {
        x.setStatus(s);
      } catch {}
    }
  }
  let pcSessions = [];
  let pcActive = false;
  let pcStatus = 'online';
  function startPcMode(status) {
    stopPcMode();
    pcStatus = status || desiredStatus || 'online';
    pcActive = true;
    const a = openGhostSession('pc', pcStatus);
    pcSessions = [a].filter(Boolean);
    return pcSessions.length > 0;
  }
  function stopPcMode() {
    for (const s of pcSessions) {
      try {
        s.close();
      } catch {}
    }
    pcSessions = [];
    pcActive = false;
  }
  function pcSetStatus(s) {
    pcStatus = s;
    for (const x of pcSessions) {
      try {
        x.setStatus(s);
      } catch {}
    }
  }
  const giftSniper = {
    on: false,
    seen: new Set(),
    claimed: 0,
    missed: 0,
    log: [],
  };
  const GIFT_RE = /(?:discord(?:app)?\.com\/gifts?|discord\.gift|promos\.discord\.gg)\/([a-zA-Z0-9-]{8,32})/gi;
  const GIFT_SUPER_PROPS = Buffer.from(
    JSON.stringify({
      os: 'Windows',
      browser: 'Discord Client',
      device: '',
      system_locale: 'en-US',
      browser_user_agent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36',
      browser_version: '1.0.9163',
      os_version: '10',
      referrer: '',
      referring_domain: '',
      referrer_current: '',
      referring_domain_current: '',
      release_channel: 'stable',
      client_build_number: 289985,
      client_event_source: null,
    }),
  ).toString('base64');
  function giftLog(t) {
    giftSniper.log.unshift(new Date().toLocaleTimeString('ro-RO') + ' ' + t);
    giftSniper.log.length = Math.min(giftSniper.log.length, 30);
  }
  function giftSniperCheck(message) {
    let text = message.content || '';
    for (const e of message.embeds || [])
      text += ' ' + (e.url || '') + ' ' + (e.description || '') + ' ' + (e.title || '');
    if (!text.includes('gift') && !text.includes('promos')) return;
    GIFT_RE.lastIndex = 0;
    let m;
    while ((m = GIFT_RE.exec(text))) {
      const code = m[1];
      if (giftSniper.seen.has(code)) continue;
      giftSniper.seen.add(code);
      redeemGift(code, message).catch(() => {});
    }
  }
  async function redeemGift(code, message) {
    const t0 = Date.now();
    try {
      const res = await axios.post(
        'https://discord.com/api/v9/entitlements/gift-codes/' + code + '/redeem',
        {
          channel_id: message.channel?.id || null,
          payment_source_id: null,
          gateway_checkout_context: null,
        },
        {
          headers: {
            Authorization: botClient.token,
            'Content-Type': 'application/json',
            'X-Super-Properties': GIFT_SUPER_PROPS,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36',
          },
          validateStatus: () => true,
          timeout: 8000,
        },
      );
      const ms = Date.now() - t0;
      const where = message.guild ? message.guild.name : 'DM';
      if (res.status >= 200 && res.status < 300) {
        giftSniper.claimed++;
        const name = res.data?.store_listing?.sku?.name || res.data?.sku?.name || 'gift';
        giftLog('LUAT ' + name + ' (' + code + ') ' + where + ' ' + ms + 'ms');
        console.log('[sniper] LUAT', name, code, ms + 'ms');
      } else {
        giftSniper.missed++;
        const why = res.data?.message || 'status ' + res.status;
        giftLog('ratat ' + code + ' - ' + why + ' ' + ms + 'ms');
        console.log('[sniper] ratat', code, why);
      }
    } catch (e) {
      giftSniper.missed++;
      giftLog('error ' + code + ' - ' + String(e?.message || e).slice(0, 60));
    }
  }
  const questState = {
    running: false,
    timer: null,
    channel: null,
    done: new Set(),
    raw: [],
    log: [],
    lastRun: 0,
    orbs: 0,
    busy: false,
  };
  const QUEST_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36';
  let questBuild = 0;
  let questBuildAt = 0;
  let questLastRaw = '';
  async function questBuildNumber() {
    if (questBuild && Date.now() - questBuildAt < 6 * 3600 * 1000) return questBuild;
    try {
      const page = await axios.get('https://discord.com/app', {
        timeout: 15000,
        headers: {
          'User-Agent': QUEST_UA,
        },
        validateStatus: () => true,
      });
      const files = [...String(page.data).matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)].map((m) => m[1]);
      for (const f of files.reverse().slice(0, 12)) {
        const js = await axios.get('https://discord.com/assets/' + f, {
          timeout: 15000,
          headers: {
            'User-Agent': QUEST_UA,
          },
          validateStatus: () => true,
        });
        const m =
          String(js.data).match(/buildNumber["':,\s]*?(\d{6,7})/) ||
          String(js.data).match(/build_number["':,\s]*?(\d{6,7})/);
        if (m) {
          questBuild = parseInt(m[1], 10);
          questBuildAt = Date.now();
          break;
        }
      }
    } catch {}
    if (!questBuild) questBuild = 460000;
    return questBuild;
  }
  function qSuperProps(build) {
    return Buffer.from(
      JSON.stringify({
        os: 'Windows',
        browser: 'Discord Client',
        release_channel: 'stable',
        client_version: '1.0.9163',
        os_version: '10.0.19045',
        os_arch: 'x64',
        app_arch: 'x64',
        system_locale: 'en-US',
        browser_user_agent: QUEST_UA,
        browser_version: '28.2.10',
        client_build_number: build,
        native_build_number: null,
        client_event_source: null,
        has_client_mods: false,
      }),
    ).toString('base64');
  }
  function qHeaders(build, extra) {
    return {
      Authorization: token,
      'Content-Type': 'application/json',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://discord.com',
      Referer: 'https://discord.com/channels/@me',
      'User-Agent': QUEST_UA,
      'X-Discord-Locale': 'en-US',
      'X-Discord-Timezone': 'Europe/Bucharest',
      'X-Debug-Options': 'bugReporterEnabled',
      'X-Super-Properties': qSuperProps(build),
      ...(extra || {}),
    };
  }
  const QUEST_DONE_FILE = path.join(DATA_DIR, 'quests_done.json');
  function questLoadDone() {
    try {
      const arr = JSON.parse(fs.readFileSync(QUEST_DONE_FILE, 'utf8'));
      if (Array.isArray(arr)) for (const id of arr) questState.done.add(id);
    } catch {}
  }
  function questSaveDone() {
    try {
      fs.mkdirSync(DATA_DIR, {
        recursive: true,
      });
      fs.writeFileSync(QUEST_DONE_FILE, JSON.stringify([...questState.done]));
    } catch {}
  }
  questLoadDone();
  const QUEST_VERBOSE = process.env.QUEST_VERBOSE === '1';
  let qNotifyLast = '';
  let qNotifyAt = 0;
  function qlog(line, loud) {
    const t = new Date().toLocaleTimeString('ro-RO');
    questState.log.unshift('[' + t + '] ' + line);
    if (questState.log.length > 60) questState.log.pop();
    if (QUEST_VERBOSE) console.log('[quest]', line);
    if (loud) qNotify(line);
  }
  function qNotify(line) {
    const ch = questState.channel;
    if (!ch) return;
    const now = Date.now();
    if (line === qNotifyLast && now - qNotifyAt < 60000) return;
    qNotifyLast = line;
    qNotifyAt = now;
    try {
      safeSend(ch, '-# quest: ' + line);
    } catch {}
  }
  async function qreq(method, url, data) {
    const build = await questBuildNumber();
    for (let i = 0; i < 3; i++) {
      const r = await axios({
        method,
        url: 'https://discord.com/api/v9' + url,
        data,
        headers: qHeaders(build),
        timeout: 20000,
        validateStatus: () => true,
      }).catch((e) => ({
        status: 0,
        data: {
          error: String(e.message || e),
        },
      }));
      if (r.status === 429) {
        const wait = Math.min(30, Number(r.data?.retry_after || 3)) * 1000 + 500;
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      if (r.status === 0 && i < 2) {
        await new Promise((res) => setTimeout(res, 3000));
        continue;
      }
      return r;
    }
    return {
      status: 0,
      data: null,
    };
  }
  let questCache = {
    at: 0,
    list: [],
  };
  async function fetchQuests(force) {
    if (!force && questCache.list.length && Date.now() - questCache.at < 20000) return questCache.list;
    const build = await questBuildNumber();
    const paths = [
      '/quests/@me?with_status=true',
      '/quests/@me',
      '/quests/@me/bounties',
      '/quests/@me/eligible',
    ];
    let sawOk = false;
    for (const p of paths) {
      const r = await qreq('get', p);
      if (r.status >= 400) {
        qlog('ruta ' + p + ' -> ' + r.status + ' ' + String(JSON.stringify(r.data || '')).slice(0, 90));
        if (r.status === 401) {
          qlog('invalid/expired TOKEN for quests', true);
          return [];
        }
        continue;
      }
      sawOk = true;
      questLastRaw = JSON.stringify(r.data || {}).slice(0, 1500);
      const d = r.data || {};
      const list =
        d.quests ||
        d.eligible_quests ||
        d.quest_bounties ||
        d.bounties ||
        d.active_quests ||
        (Array.isArray(d) ? d : []);
      if (list.length) {
        questState.raw = list;
        questCache = {
          at: Date.now(),
          list,
        };
        return list;
      }
      const excl = d.excluded_quests || d.quests_excluded || [];
      if (excl.length) qlog('Discord are ' + excl.length + " quests but the account isn't eligible");
    }
    if (sawOk) qlog('empty list (build ' + build + ') - the account has no active quests right now');
    else qlog("didn't receive any quest list from Discord");
    return [];
  }
  function questTasks(q) {
    const cfg = q.config || q || {};
    const t =
      cfg.task_config_v2?.tasks ||
      cfg.task_config?.tasks ||
      cfg.taskConfig?.tasks ||
      cfg.tasks ||
      q.task_config_v2?.tasks ||
      q.task_config?.tasks ||
      {};
    return t && typeof t === 'object' ? t : {};
  }
  function questExpired(q) {
    const e = q.config?.expires_at || q.config?.dates?.expires_at || q.expires_at;
    if (!e) return false;
    const ts = Date.parse(e);
    return Number.isFinite(ts) && ts < Date.now();
  }
  function questName(q) {
    return q.config?.messages?.quest_name || q.config?.application?.name || q.id;
  }
  function questIsOrbs(q) {
    try {
      const raw = JSON.stringify(q.config?.rewards_config || q.config?.reward_config || {});
      return /orb/i.test(raw);
    } catch {
      return false;
    }
  }
  async function enrollQuest(q) {
    if (q.user_status?.enrolled_at) return true;
    for (const body of [
      {
        location: 2,
      },
      {
        location: 6,
      },
      {
        location: 9,
      },
      {},
    ]) {
      const r = await qreq('post', '/quests/' + q.id + '/enroll', body);
      if (r.status < 300) return true;
      if (r.status === 400 && /already/i.test(JSON.stringify(r.data || ''))) return true;
    }
    return false;
  }
  async function claimQuest(q) {
    const routes = [
      [
        '/quests/' + q.id + '/claim-reward',
        {
          platform: 'desktop',
        },
      ],
      [
        '/quests/' + q.id + '/claim-reward',
        {
          platform: 'desktop',
          location: 11,
        },
      ],
      ['/quests/' + q.id + '/claim-reward', {}],
      [
        '/quests/' + q.id + '/claim',
        {
          platform: 'desktop',
        },
      ],
      ['/quests/' + q.id + '/rewards', {}],
    ];
    for (let attempt = 1; attempt <= 2; attempt++) {
      for (const [url, body] of routes) {
        const r = await qreq('post', url, body);
        if (r.status < 300) return true;
        if (r.status === 404) continue;
        if (r.status === 400 && /already|claimed/i.test(JSON.stringify(r.data || ''))) return true;
      }
      const fresh = await questRefresh(q);
      if (fresh?.user_status?.claimed_at) return true;
      if (attempt === 1) await new Promise((res) => setTimeout(res, 5000));
    }
    return false;
  }
  async function claimFinishedQuests(list) {
    let n = 0;
    for (const q of list) {
      const st = q.user_status || {};
      if (!st.completed_at || st.claimed_at) continue;
      if (questState.done.has(q.id)) continue;
      const okc = await claimQuest(q);
      if (okc) {
        n++;
        questState.done.add(q.id);
        questSaveDone();
        qlog('claimed reward for "' + questName(q) + '"', true);
      }
    }
    return n;
  }
  function anyVoiceChannelId() {
    for (const g of botClient.guilds.cache.values()) {
      const ch = g.channels.cache.find((c) => c.type === 'GUILD_VOICE');
      if (ch)
        return {
          guildId: g.id,
          channelId: ch.id,
        };
    }
    return null;
  }
  function pushGameActivity(appId, name) {
    try {
      botClient.ws.broadcast({
        op: 3,
        d: {
          since: 0,
          afk: false,
          status: vrActive ? vrStatus : desiredStatus,
          activities: [
            {
              name: name || 'Quest',
              type: 0,
              application_id: appId,
              created_at: Date.now(),
              timestamps: {
                start: Date.now(),
              },
            },
          ],
        },
      });
    } catch {}
  }
  function clearGameActivity() {
    try {
      botClient.ws.broadcast({
        op: 3,
        d: {
          since: 0,
          afk: false,
          status: vrActive ? vrStatus : desiredStatus,
          activities: [],
        },
      });
    } catch {}
  }
  function videoProgressSecs(q, kind) {
    const pr = q.user_status?.progress || {};
    const v = pr[kind] || pr.WATCH_VIDEO || pr.WATCH_VIDEO_ON_MOBILE || pr.WATCH_VIDEO_V2 || {};
    return Math.floor(v.value || v.progress || 0);
  }
  async function doVideoQuest(q, target, kind) {
    const name = questName(q);
    kind = kind || 'WATCH_VIDEO';
    let secs = videoProgressSecs(q, kind);
    qlog('video quest "' + name + '" ' + secs + '/' + target + 's');
    const post = async (ts, terminal) => {
      for (const body of [
        {
          timestamp: Math.floor(ts),
          terminal: !!terminal,
        },
        {
          timestamp: Math.floor(ts),
        },
      ]) {
        const r = await qreq('post', '/quests/' + q.id + '/video-progress', body);
        if (r.status < 400) return r;
        if (r.status !== 400) return r;
      }
      return {
        status: 400,
        data: null,
      };
    };
    let fails = 0;
    while (questState.running && secs < target) {
      const step = Math.min(10, target - secs);
      await new Promise((res) => setTimeout(res, step * 1000 + 500 + Math.floor(Math.random() * 800)));
      if (!questState.running) break;
      const next = Math.min(target, secs + step);
      const r = await post(next, next >= target);
      if (r.status >= 400) {
        fails++;
        qlog('video-progress ' + r.status + ' in "' + name + '"');
        if (fails >= 4) break;
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }
      fails = 0;
      const got = r.data?.user_status?.progress || r.data?.progress || {};
      const gv = got[kind]?.value ?? got.WATCH_VIDEO?.value;
      secs = Math.floor(typeof gv === 'number' ? gv : next);
      if (r.data?.user_status?.completed_at || r.data?.completed_at) {
        secs = target;
        break;
      }
    }
    if (questState.running && secs >= target) {
      try {
        await post(target, true);
      } catch {}
    }
    if (secs < target) {
      const fresh = await questRefresh(q);
      if (fresh?.user_status?.completed_at) return true;
      secs = Math.max(secs, videoProgressSecs(fresh, kind));
    }
    return secs >= target;
  }
  async function doHeartbeatQuest(q, target, kind) {
    const name = questName(q);
    const appId = q.config?.application?.id;
    const appName = q.config?.application?.name || 'Quest';
    const vc = anyVoiceChannelId();
    const streamKey = vc ? 'call:' + vc.channelId + ':1' : 'guild:0:0:' + appId;
    let secs = Math.floor(q.user_status?.progress?.[kind]?.value || 0);
    qlog(kind + ' "' + name + '" ' + secs + '/' + target + 's');
    const isPlay = kind.startsWith('PLAY_ON_DESKTOP') || kind === 'PLAY_ACTIVITY';
    if (isPlay) pushGameActivity(appId, appName);
    let beatBody = null;
    const bodies = (terminal) => {
      const base = [
        {
          terminal: !!terminal,
        },
        {
          stream_key: streamKey,
          terminal: !!terminal,
        },
        {
          stream_key: streamKey,
          terminal: !!terminal,
          quest_id: q.id,
        },
      ];
      if (kind === 'STREAM_ON_DESKTOP' || kind === 'PLAY_ACTIVITY') base.reverse();
      return base;
    };
    const sendBeat = async (terminal) => {
      if (beatBody) {
        return qreq('post', '/quests/' + q.id + '/heartbeat', {
          ...beatBody,
          terminal: !!terminal,
        });
      }
      let last = {
        status: 400,
        data: null,
      };
      for (const b of bodies(terminal)) {
        const r = await qreq('post', '/quests/' + q.id + '/heartbeat', b);
        if (r.status < 400) {
          beatBody = {
            ...b,
          };
          delete beatBody.terminal;
          return r;
        }
        last = r;
      }
      return last;
    };
    const readSecs = (r, fallback) => {
      const p = r.data?.progress || r.data?.user_status?.progress || {};
      const v =
        p[kind]?.value ??
        Object.values(p)
          .map((x) => x?.value)
          .find((x) => typeof x === 'number');
      return Math.floor(typeof v === 'number' ? v : fallback);
    };
    let fails = 0;
    const first = await sendBeat(false);
    if (first.status < 400) secs = readSecs(first, secs);
    else qlog('heartbeat initial ' + first.status + ' in "' + name + '"');
    while (questState.running && secs < target) {
      await new Promise((res) => setTimeout(res, 30000));
      if (!questState.running) break;
      const nearEnd = secs + 30 >= target;
      const r = await sendBeat(nearEnd);
      if (r.status >= 400) {
        fails++;
        qlog('heartbeat ' + r.status + ' in "' + name + '"');
        if (fails >= 4) break;
        beatBody = null;
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }
      fails = 0;
      if (r.data?.user_status?.completed_at || r.data?.completed_at) {
        secs = target;
        break;
      }
      secs = readSecs(r, secs + 30);
    }
    if (questState.running && secs >= target) {
      try {
        await sendBeat(true);
      } catch {}
    }
    if (isPlay) clearGameActivity();
    if (secs < target) {
      const fresh = await questRefresh(q);
      if (fresh?.user_status?.completed_at) return true;
      secs = Math.max(secs, Math.floor(fresh?.user_status?.progress?.[kind]?.value || 0));
    }
    return secs >= target;
  }
  function questAlreadyDone(q) {
    if (q.user_status?.claimed_at) return true;
    if (q.user_status?.completed_at && !q.user_status?.claimed_at) return false;
    if (questState.done.has(q.id)) return true;
    return false;
  }
  async function questRefresh(q) {
    try {
      const list = await fetchQuests(true);
      const f = list.find((x) => x.id === q.id);
      return f || q;
    } catch {
      return q;
    }
  }
  const questCooldown = new Map();
  function questOnCooldown(id) {
    const t = questCooldown.get(id) || 0;
    return t > Date.now();
  }
  async function processQuest(q) {
    const name = questName(q);
    if (questAlreadyDone(q)) return true;
    const tasks = questTasks(q);
    const ok = await enrollQuest(q);
    if (!ok) {
      qlog('couldn\'t enroll in "' + name + '"');
      return false;
    }
    let completed = !!q.user_status?.completed_at;
    if (!completed) {
      const order = [
        'WATCH_VIDEO',
        'WATCH_VIDEO_V2',
        'WATCH_VIDEO_ON_MOBILE',
        'PLAY_ON_DESKTOP',
        'PLAY_ON_DESKTOP_V2',
        'PLAY_ACTIVITY',
        'STREAM_ON_DESKTOP',
        'PLAY_ON_XBOX',
        'PLAY_ON_PLAYSTATION',
      ];
      const kinds = [
        ...order.filter((k) => tasks[k]),
        ...Object.keys(tasks).filter((k) => !order.includes(k)),
      ];
      if (!kinds.length) {
        qlog('quest "' + name + '" has no tasks: ' + (Object.keys(tasks).join(',') || 'niciunul'));
        return false;
      }
      qlog('incep questul "' + name + '"', true);
      for (const kind of kinds) {
        const t = tasks[kind];
        if (!t) continue;
        const target = t.target || t.threshold || t.duration || 0;
        if (!target) continue;
        if (/VIDEO/i.test(kind)) completed = await doVideoQuest(q, target, kind);
        else completed = await doHeartbeatQuest(q, target, kind);
        if (completed) break;
        if (!questState.running) return false;
        qlog('taskul ' + kind + ' didn\'t work for "' + name + '", incerc altul');
      }
    }
    if (!completed) {
      const videoKind = Object.keys(tasks).find((k) => /VIDEO/i.test(k));
      const t = videoKind ? tasks[videoKind] : null;
      const anyTarget = t ? t.target || t.threshold || t.duration || 0 : 0;
      if (anyTarget && questState.running) {
        qlog('incerc "' + name + '" prin videoclip');
        completed = await doVideoQuest(q, anyTarget, videoKind);
      }
    }
    if (!completed) {
      const fresh = await questRefresh(q);
      completed = !!fresh.user_status?.completed_at;
    }
    if (completed) {
      const claimed = await claimQuest(q);
      if (claimed) {
        questState.done.add(q.id);
        questSaveDone();
      }
      if (questIsOrbs(q)) questState.orbs++;
      qlog(
        (claimed
          ? 'done: "' + name + '" - premiul luat'
          : 'done: "' + name + '" - finished, prize not claimed') + (questIsOrbs(q) ? ' [orbs]' : ''),
        true,
      );
      return true;
    }
    questCooldown.set(q.id, Date.now() + 30 * 60 * 1000);
    qlog('"' + name + '" didn\'t work now, retrying in 30 min');
    return false;
  }
  async function questCycle() {
    if (!questState.running || questState.busy) return;
    questState.busy = true;
    questState.lastRun = Date.now();
    try {
      const quests = await fetchQuests(true);
      try {
        await claimFinishedQuests(quests);
      } catch {}
      const todo = quests.filter((q) => !questAlreadyDone(q) && !questExpired(q) && !questOnCooldown(q.id));
      if (todo.length) {
        qlog('de facut (' + todo.length + '): ' + todo.map((q) => questName(q)).join(', '));
        let gata = 0;
        for (const q of todo) {
          if (!questState.running) break;
          let done = false;
          for (let tryNo = 1; tryNo <= 2 && questState.running && !done; tryNo++) {
            done = await processQuest(tryNo === 1 ? q : await questRefresh(q));
            if (!done && questState.running) await new Promise((r) => setTimeout(r, 15000));
          }
          if (done) gata++;
        }
        if (questState.running && gata)
          qlog('round done: ' + gata + '/' + todo.length + ' questuri terminate', true);
      }
    } catch (e) {
      qlog('error: ' + String(e.message || e).slice(0, 120), true);
    } finally {
      questState.busy = false;
    }
  }
  function startQuests(channel) {
    if (questState.running) return false;
    questState.running = true;
    questState.channel = channel || null;
    qlog('auto quest started', true);
    questCycle();
    questState.timer = setInterval(
      () => {
        questCycle();
      },
      5 * 60 * 1000,
    );
    return true;
  }
  function stopQuests() {
    if (!questState.running) return false;
    questState.running = false;
    if (questState.timer) {
      clearInterval(questState.timer);
      questState.timer = null;
    }
    clearGameActivity();
    qlog('auto quest stopped', true);
    return true;
  }
  function getVoiceState(guildId) {
    if (!voiceStates[guildId])
      voiceStates[guildId] = {
        connection: null,
        player: null,
        volume: 150,
        currentFile: null,
        loop: true,
        selfDeaf: true,
        selfMute: false,
        stream: null,
      };
    return voiceStates[guildId];
  }
// ── PARTAJARE ECRAN (poza statica / ecran negru) ────────────────────────
let VideoStreamLib = null, VideoStreamErr = null;
let VideoStreamLoadPromise = null;

// Versiunile noi ale modulului sunt ESM-only: require() da eroare chiar daca pachetul e instalat.
// Importul dinamic functioneaza din acest script CommonJS si lasa Node sa gaseasca singur node_modules.
// ── REPARARE AUTOMATA ADDON VIDEO (node-datachannel) ──
// Modulul video cauta o piesa nativa cu versiunea EXACTA a lui node-datachannel,
// pentru procesorul (arm64/x64) si sistemul (gnu/musl) serverului. O instalam singuri inainte de import.
let ndcPrepPromise = null;
let ndcPrepInfo = '';
function ndcFindDir() {
  const cands = [
    path.join(__dirname, 'node_modules', '@dank074', 'discord-video-stream', 'node_modules', '@lng2004', 'node-datachannel'),
    path.join(__dirname, 'node_modules', '@lng2004', 'node-datachannel'),
    path.join(process.cwd(), 'node_modules', '@lng2004', 'node-datachannel'),
  ];
  for (const d of cands) { try { if (fs.existsSync(path.join(d, 'package.json'))) return d; } catch {} }
  return null;
}
function ndcPlatformName() {
  const plat = process.platform, arch = process.arch;
  if (plat === 'linux') {
    let libc = 'gnu';
    try { const h = process.report?.getReport?.()?.header; if (h && !h.glibcVersionRuntime) libc = 'musl'; } catch {}
    try { if (fs.existsSync('/etc/alpine-release')) libc = 'musl'; } catch {}
    return `linux-${arch}-${libc}`;
  }
  if (plat === 'win32') return `win32-${arch}-msvc`;
  if (plat === 'darwin') return `darwin-${arch}`;
  if (plat === 'android') return `android-${arch}`;
  return `${plat}-${arch}`;
}
function ndcPrepare() {
  if (ndcPrepPromise) return ndcPrepPromise;
  ndcPrepPromise = new Promise(resolve => {
    try {
      const [maj, min] = process.versions.node.split('.').map(Number);
      if (maj < 22 || (maj === 22 && min < 4)) {
        ndcPrepInfo = `Node ${process.versions.node} e prea vechi, modulul video cere Node 22.4+ (schimba imaginea din panou pe Node 22 sau 24)`;
        console.warn('[video]', ndcPrepInfo);
      }
      const dir = ndcFindDir();
      if (!dir) { ndcPrepInfo = ndcPrepInfo || 'node-datachannel nu e instalat (npm i @dank074/discord-video-stream@latest)'; return resolve(false); }
      const ver = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
      const pkgName = `@lng2004/ndc-${ndcPlatformName()}`;
      let haveVer = null;
      try { haveVer = JSON.parse(fs.readFileSync(require.resolve(pkgName + '/package.json', { paths: [dir] }), 'utf8')).version; } catch {}
      if (haveVer === ver) { console.log(`[video] addon ok: ${pkgName}@${ver}`); return resolve(true); }
      console.log(`[video] instalez addon-ul ${pkgName}@${ver} (gasit: ${haveVer || 'nimic'})...`);
      exec(`npm install --no-save --include=optional ${pkgName}@${ver}`, { cwd: __dirname, timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (err, _o, se) => {
        if (err) {
          ndcPrepInfo = `nu am putut instala ${pkgName}@${ver}: ${String(se || err.message).split('\n').filter(Boolean).slice(-1)[0] || ''}`.slice(0, 220);
          console.error('[video]', ndcPrepInfo);
          return resolve(false);
        }
        console.log(`[video] addon instalat: ${pkgName}@${ver}`);
        resolve(true);
      });
    } catch (e) { ndcPrepInfo = 'verificare addon esuata: ' + String(e.message).slice(0, 120); resolve(false); }
  });
  return ndcPrepPromise;
}

async function loadVideoStreamLib() {
  if (VideoStreamLib) return VideoStreamLib;
  if (!VideoStreamLoadPromise) {
    VideoStreamLoadPromise = ndcPrepare().then(() => import('@dank074/discord-video-stream'))
      .then(mod => {
        VideoStreamLib = mod?.default && !mod.Streamer ? { ...mod.default, ...mod } : mod;
        VideoStreamErr = null;
        return VideoStreamLib;
      })
      .catch(err => {
        VideoStreamErr = err;
        console.error('[video] import esuat:', String(err?.message || err).slice(0, 300));
        // nu resetam promisiunea: un import esuat ramane in cache pana la repornire
        return null;
      });
  }
  return VideoStreamLoadPromise;
}
const screenShares = new Map(); // guildId -> { streamer, ff, controller }
let sharedStreamer = null;
function getVoiceConnectionSafe(gid) { try { return require('@discordjs/voice').getVoiceConnection(gid, VOICE_GROUP); } catch { return null; } }
// preincarca modulul video la pornire ca sa porneasca instant camera/partaj
setTimeout(() => { loadVideoStreamLib().catch(() => {}); }, 3000);

// descarca poza/video local (link-urile cu ?query nu merg direct in ffmpeg)
async function fetchMediaLocal(url) {
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 200 * 1024 * 1024, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const ct = String(r.headers['content-type'] || '').toLowerCase();
  const isVideo = ct.startsWith('video/') || /\.(mp4|webm|mov|mkv|gif)(\?|$)/i.test(url);
  const ext = isVideo ? (ct.includes('gif') || /\.gif/i.test(url) ? '.gif' : '.mp4') : '.img';
  const file = path.join(require('os').tmpdir(), 'share_' + Date.now() + ext);
  fs.writeFileSync(file, Buffer.from(r.data));
  return { file, isVideo };
}

function buildShareArgs(media) {
  let input;
  if (!media) input = ['-re', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30'];
  else if (media.isVideo) input = ['-re', '-stream_loop', '-1', '-i', media.file];
  else input = ['-re', '-loop', '1', '-framerate', '30', '-i', media.file];
  // fara audio fals si fara probesize mic: altfel Discord primeste cadre pe care nu le poate afisa (doar "se incarca")
  return [
    '-hide_banner', '-loglevel', 'error',
    ...input,
    '-map', '0:v:0', '-an',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-level', '3.1',
    '-g', '30', '-keyint_min', '30', '-bf', '0', '-x264-params', 'repeat-headers=1',
    '-b:v', '2500k', '-maxrate', '2500k', '-bufsize', '5000k',
    '-f', 'nut', 'pipe:1',
  ];
}

// mode: 'go-live' (partaj) sau 'camera'
async function startScreenShare(guildId, channelId, imgUrl, mode = 'go-live') {
  const videoLib = await loadVideoStreamLib();
  if (!videoLib) {
    const reason = String(VideoStreamErr?.message || VideoStreamErr?.code || 'eroare necunoscuta').replace(/\s+/g, ' ').slice(0, 180);
    const native = /native addon|ndc-|node_datachannel/i.test(reason);
    let hint;
    if (ndcPrepInfo) hint = ndcPrepInfo;
    else if (native) hint = `addon-ul ${'@lng2004/ndc-' + ndcPlatformName()} a fost instalat acum, reporneste botul o data si incearca iar`;
    else hint = 'reinstaleaza cu npm i @dank074/discord-video-stream@latest';
    return { ok: false, msg: 'modulul video nu poate porni (' + ndcPlatformName() + ', Node ' + process.versions.node + '): ' + hint };
  }
  if (screenShares.has(guildId)) { const o = screenShares.get(guildId); try { o.ff?.kill('SIGKILL'); } catch {} try { o.streamer?.stopStream?.(); } catch {} screenShares.delete(guildId); }
  let media = null;
  if (imgUrl) {
    try { media = await fetchMediaLocal(imgUrl); }
    catch (e) { return { ok: false, msg: 'nu pot descarca linkul: ' + String(e.message).slice(0, 80) }; }
  }
  try {
    const { Streamer } = videoLib;
    // conexiunea @discordjs/voice din acelasi server intra in conflict cu streamerul (eroare 2012 / kick din voice)
    try { const vs = voiceStates[guildId]; if (vs?.connection) { vs.connection.destroy(); vs.connection = null; } } catch {}
    try { getVoiceConnectionSafe(guildId)?.destroy(); } catch {}
    if (!sharedStreamer) sharedStreamer = new Streamer(botClient);
    const streamer = sharedStreamer;
    const curCh = streamer.voiceConnection?.channelId;
    if (curCh !== channelId) {
      try { if (curCh) streamer.leaveVoice(); } catch {}
      await Promise.race([
        streamer.joinVoice(guildId, channelId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout la intrarea in voice')), 10000)),
      ]);
    }
    const st = { streamer, media, mode };
    if (typeof videoLib.playStream === 'function') {
      const ff = spawn(ffmpegPath || 'ffmpeg', buildShareArgs(media), { stdio: ['ignore', 'pipe', 'pipe'] });
      ff.stderr.on('data', d => { if (process.env.SHARE_VERBOSE) console.error('[share ff]', String(d).slice(0, 200)); });
      st.ff = ff;
      const opts = { type: mode === 'camera' ? 'camera' : 'go-live', width: 1280, height: 720, frameRate: 30, readrateInitialBurst: undefined };
      videoLib.playStream(ff.stdout, streamer, opts).catch(e => console.error('[share]', String(e?.message || e).slice(0, 120)));
    } else if (typeof videoLib.streamLivestreamVideo === 'function') {
      let udp;
      if (mode === 'camera') {
        udp = streamer.voiceConnection;
        try { streamer.signalVideo?.(guildId, channelId, true); } catch {}
      } else udp = await streamer.createStream();
      udp.mediaConnection ? udp.mediaConnection.setSpeaking(true) : udp.setSpeaking?.(true);
      udp.mediaConnection ? udp.mediaConnection.setVideoStatus(true) : udp.setVideoStatus?.(true);
      const src = media ? media.file : 'color=c=black:s=1280x720:r=30';
      videoLib.streamLivestreamVideo(src, udp).catch(() => {});
      st.udp = udp;
    } else {
      return { ok: false, msg: 'versiunea modulului video nu e compatibila (npm i @dank074/discord-video-stream@latest)' };
    }
    screenShares.set(guildId, st);
    const what = media ? (media.isVideo ? 'cu video' : 'cu poza') : '(negru)';
    return { ok: true, msg: (mode === 'camera' ? 'camera pornita ' : 'partajare pornita ') + what };
  } catch (e) {
    return { ok: false, msg: 'eroare ' + (mode === 'camera' ? 'camera' : 'partajare') + ': ' + String(e.message).slice(0, 120) };
  }
}

async function stopScreenShare(guildId) {
  const st = screenShares.get(guildId);
  if (!st) return { ok: false, msg: 'nu partajez nimic' };
  try { st.ff?.kill('SIGKILL'); } catch {}
  try { st.streamer?.stopStream?.(); } catch {}
  try { st.streamer?.leaveVoice?.(); } catch {}
  sharedStreamer = null;
  try { if (st.media?.file) fs.unlinkSync(st.media.file); } catch {}
  screenShares.delete(guildId);
  return { ok: true, msg: (st.mode === 'camera' ? 'camera oprita' : 'partajare oprita') };
}


  const SESSION_FILE = path.join(
    DATA_DIR,
    BOT_INDEX === 1 ? 'session.json' : 'session_' + BOT_INDEX + '.json',
  );
  let sessionSaveTimer = null;
  function saveSession() {
    if (sessionSaveTimer) return;
    sessionSaveTimer = setTimeout(() => {
      sessionSaveTimer = null;
      try {
        const data = {
          reply: {
            running: replyState.running,
            targets: replyState.targets,
          },
          spam: spamState.running
            ? {
                type: spamState.type,
                channelId: spamState.channelId,
                targets: spamState.targets,
              }
            : null,
          repeat: repeatState.running
            ? {
                channelId: repeatState.channelId,
                target: repeatState.target,
                text: repeatState.text,
              }
            : null,
          steal: stealState.active
            ? {
                sourceChannelId: stealState.sourceChannelId,
                targets: [...stealState.targets],
                anyUser: stealState.anyUser,
                fileName: stealState.fileName,
                outputChannelId: stealState.outputChannel?.id || null,
                byUser: [...stealState.byUser.entries()],
                names: [...stealState.names.entries()],
              }
            : null,
          delays: {
            globalDelay,
            channelDelay,
          },
          savedAt: Date.now(),
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
      } catch (e) {
        console.error('[session save]', e.message);
      }
    }, 1500);
  }
  function startChannelSpamLoop() {
    if (spamState.interval) clearLive(spamState.interval);
    spamState.interval = liveLoop(
      () => channelDelay,
      () => !spamState.running,
      async () => {
        if (!spamState.running) {
          clearLive(spamState.interval);
          spamState.interval = null;
          return;
        }
        if (spamState.phraseIndex >= spamPhrases.length) spamState.phraseIndex = 0;
        const p = spamPhrases[spamState.phraseIndex++];
        if (p?.trim()) {
          try {
            const ch =
              botClient.channels.cache.get(spamState.channelId) ||
              (await botClient.channels.fetch(spamState.channelId).catch(() => null));
            if (ch) {
              await ch.sendTyping();
              await ch.send(spamState.targets.map((t) => '<@' + t + '>').join(' ') + '\n' + p);
            }
          } catch {}
        }
      },
    );
  }
  function startRepeatLoop() {
    if (repeatState.interval) clearLive(repeatState.interval);
    repeatState.interval = liveLoop(
      () => globalDelay,
      () => !repeatState.running,
      async () => {
        if (!repeatState.running) {
          clearLive(repeatState.interval);
          repeatState.interval = null;
          return;
        }
        try {
          const ch =
            botClient.channels.cache.get(repeatState.channelId) ||
            (await botClient.channels.fetch(repeatState.channelId).catch(() => null));
          if (ch && repeatState.text?.trim()) {
            await ch.sendTyping();
            await ch.send('<@' + repeatState.target + '> ' + repeatState.text);
          }
        } catch {}
      },
    );
  }
  async function restoreSession() {
    let data = null;
    try {
      data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch {
      return;
    }
    if (!data) return;
    try {
      if (data.delays) {
        globalDelay = data.delays.globalDelay || globalDelay;
        channelDelay = data.delays.channelDelay || channelDelay;
      }
      if (data.reply?.targets?.length) {
        replyState.targets = data.reply.targets.slice(0, 10);
        replyState.running = !!data.reply.running;
      }
      if (data.spam?.channelId && spamPhrases.length) {
        spamState.running = true;
        spamState.type = data.spam.type || 'channel';
        spamState.channelId = data.spam.channelId;
        spamState.targets = data.spam.targets || [];
        spamState.phraseIndex = 0;
        spamState.startedAt = Date.now();
        startChannelSpamLoop();
      }
      if (data.repeat?.channelId) {
        repeatState.running = true;
        repeatState.channelId = data.repeat.channelId;
        repeatState.target = data.repeat.target;
        repeatState.text = data.repeat.text;
        repeatState.startedAt = Date.now();
        startRepeatLoop();
      }
      if (data.steal) {
        stealState.active = true;
        stealState.sourceChannelId = data.steal.sourceChannelId || null;
        stealState.targets = new Set(data.steal.targets || []);
        stealState.anyUser = !!data.steal.anyUser;
        stealState.fileName = data.steal.fileName || null;
        stealState.byUser = new Map((data.steal.byUser || []).map(([k, v]) => [k, v]));
        stealState.names = new Map(data.steal.names || []);
        stealState.seen = new Set();
        for (const [uid, arr] of stealState.byUser)
          for (const l of arr) stealState.seen.add(uid + '|' + stolenKey(l));
        stealState.startedAt = Date.now();
        if (data.steal.outputChannelId) {
          stealState.outputChannel =
            botClient.channels.cache.get(data.steal.outputChannelId) ||
            (await botClient.channels.fetch(data.steal.outputChannelId).catch(() => null));
        }
        stealIdleReset();
      }
      console.log('[session] active commands were restarted automatically');
    } catch (e) {
      console.error('[session restore]', e.message);
    }
  }
  async function parseUser(userArg) {
    if (!userArg) return null;
    const match = userArg.match(/<@!?(\d+)>/);
    if (match) {
      try {
        return await botClient.users.fetch(match[1]);
      } catch {
        return null;
      }
    }
    if (/^\d{17,20}$/.test(userArg)) {
      try {
        return await botClient.users.fetch(userArg);
      } catch {
        return null;
      }
    }
    return null;
  }
  async function parseUsers(userArgs) {
    const users = [];
    for (const arg of userArgs) {
      const u = await parseUser(arg);
      if (u && !users.find((x) => x.id === u.id)) users.push(u);
      if (users.length >= MAX_TARGETS) break;
    }
    return users;
  }
  function stripTagsFromText(text) {
    let t = String(text || '');
    t = t.replace(/<a?:\w+:\d+>/g, ' ');
    t = t.replace(/<@[!&]?\d+>/g, ' ');
    t = t.replace(/<#\d+>/g, ' ');
    t = t.replace(/<t:\d+(?::[a-zA-Z])?>/g, ' ');
    t = t.replace(/@(everyone|here)/gi, ' ');
    t = t.replace(/^[\s>*_~`-]+/gm, '');
    t = t.replace(/[ \t]+/g, ' ');
    return t;
  }
  function cleanStolenLine(line) {
    return stripTagsFromText(line).replace(/\r/g, '').trim();
  }
  function stolenKey(line) {
    return cleanStolenLine(line).replace(/\s+/g, ' ').toLocaleLowerCase('ro-RO');
  }
  function stealIdleReset() {
    stealState.lastActivity = Date.now();
    if (stealState.idleTimer) clearTimeout(stealState.idleTimer);
    stealState.idleTimer = setTimeout(() => {
      finishSteal('idle').catch(() => {});
    }, STEAL_IDLE_MS);
  }
  function stealTotalLines() {
    let n = 0;
    for (const arr of stealState.byUser.values()) n += arr.length;
    return n;
  }
  function stealFileName() {
    const custom = String(stealState.fileName || '').trim();
    if (custom) {
      const safe = custom
        .replace(/[^a-z0-9 _.-]/gi, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60);
      return safe.toLowerCase().endsWith('.txt') ? safe : safe + '.txt';
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return 'steal_' + stamp + '.txt';
  }
  async function finishSteal(reason) {
    if (!stealState.active) return false;
    stealState.active = false;
    if (stealState.idleTimer) {
      clearTimeout(stealState.idleTimer);
      stealState.idleTimer = null;
    }
    const output = stealState.outputChannel;
    const filename = stealFileName();
    const total = stealTotalLines();
    const blocks = [];
    for (const [uid, arr] of stealState.byUser) {
      if (!arr.length) continue;
      const name = stealState.names.get(uid) || uid;
      blocks.push('=== ' + name + ' (' + uid + ') ===\n\n' + arr.join('\n\n'));
    }
    const body = blocks.join('\n\n\n') + (blocks.length ? '\n' : '');
    const data = Buffer.from(body, 'utf8');
    try {
      fs.writeFileSync(path.join(DATA_DIR, filename), body, 'utf8');
    } catch (e) {
      console.error('[steal save]', e.message);
    }
    const people = stealState.anyUser ? 'tot canalul' : stealState.byUser.size + ' persoane';
    const why =
      reason === 'idle'
        ? ' | stopped automatically (1h of inactivity)'
        : reason === 'duplicate'
          ? ' | stopped automatically (duplicate session)'
          : '';
    stealState.byUser = new Map();
    stealState.names = new Map();
    stealState.seen.clear();
    stealState.targets = new Set();
    stealState.anyUser = false;
    stealState.sourceChannelId = null;
    stealState.fileName = null;
    saveSession();
    const label = 'notepad furat (' + people + ')' + why + ' | ' + total + ' paragrafe';
    if (total) {
      let sent = false;
      if (output)
        sent = !!(await output
          .send({
            content: '-# ' + label,
            files: [new MessageAttachment(data, filename)],
          })
          .catch((e) => {
            console.error('[stopsteal]', e.message);
            return null;
          }));
      if (!sent) {
        try {
          const me = await botClient.users.fetch(botClient.user.id);
          const dm = await me.createDM();
          await dm.send({
            content: '-# ' + label,
            files: [new MessageAttachment(data, filename)],
          });
        } catch (e) {
          console.error('[stopsteal dm]', e.message);
        }
      }
    } else if (output) {
      await output.send("-# didn't catch any paragraph").catch(() => {});
    }
    return true;
  }
  async function captureStealMessage(message) {
    if (!stealState.active) return;
    if (stealState.sourceChannelId && message.channel.id !== stealState.sourceChannelId) return;
    if (!stealState.anyUser && !stealState.targets.has(message.author.id)) return;
    if (message.author.id === botClient.user.id) return;
    const incoming = String(message.content || '')
      .split(/\n{2,}/)
      .map(cleanStolenLine)
      .filter(Boolean);
    if (!incoming.length) return;
    const uid = message.author.id;
    if (!stealState.names.has(uid)) stealState.names.set(uid, message.author.username || uid);
    if (!stealState.byUser.has(uid)) stealState.byUser.set(uid, []);
    let added = false;
    for (const para of incoming) {
      const key = uid + '|' + stolenKey(para);
      if (!key) continue;
      if (stealState.seen.has(key)) continue;
      stealState.seen.add(key);
      stealState.byUser.get(uid).push(para);
      added = true;
    }
    if (added) {
      stealIdleReset();
      saveSession();
    }
  }
  function spotifyConnectUrl() {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) return null;
    const state = crypto.randomBytes(24).toString('hex');
    spotifyOauthStates.set(state, Date.now() + 10 * 60 * 1000);
    const q = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
      scope: 'user-read-currently-playing user-read-playback-state',
      show_dialog: 'true',
    });
    return 'https://accounts.spotify.com/authorize?' + q.toString();
  }
  async function syncSpotifyPresence() {
    let auth = await refreshSpotifyAuth(loadSpotifyAuth());
    const r = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: 'Bearer ' + auth.access_token,
      },
      validateStatus: () => true,
      timeout: 12000,
    });
    if (r.status === 204 || !r.data?.item || !r.data?.is_playing) {
      if (spotifyLastTrack) {
        clearTimedActivity();
        spotifyLastTrack = '';
        spotifyLastProgress = -1;
        try {
          await botClient.user.setPresence({
            activities: [],
            status: desiredStatus,
          });
        } catch {}
      }
      return;
    }
    if (r.status >= 400) throw new Error('Spotify API ' + r.status);
    const item = r.data.item;
    const artists = (item.artists || []).map((a) => a.name).join(', ');
    const label = `${item.name} — ${artists}`.slice(0, 120);
    const progress = Math.max(0, Number(r.data.progress_ms || 0));
    const duration = Math.max(progress + 1000, Number(item.duration_ms || 0));
    const drift = Math.abs(progress - spotifyLastProgress);
    if (spotifyLastTrack !== item.id || drift > 12000 || !presenceData) {
      clearTimedActivity();
      presenceData = {
        name: label,
        type: 'LISTENING',
        start: Date.now() - progress,
        end: Date.now() - progress + duration,
      };
      await pushPresence();
      spotifyLastTrack = item.id;
      spotifyLastProgress = progress;
    }
  }
  function startSpotifySync() {
    if (spotifyPoll) clearInterval(spotifyPoll);
    syncSpotifyPresence().catch((e) => console.error('[spotify]', e.message));
    spotifyPoll = setInterval(
      () => syncSpotifyPresence().catch((e) => console.error('[spotify]', e.message)),
      5000,
    );
  }
  function stopSpotifySync() {
    if (spotifyPoll) clearInterval(spotifyPoll);
    spotifyPoll = null;
    spotifyLastTrack = '';
    spotifyLastProgress = -1;
  }
  async function ytmClear() {
    if (!ytmState.key) return;
    ytmState.key = '';
    ytmState.playing = false;
    clearTimedActivity();
    try {
      await botClient.user.setPresence({
        activities: [],
        status: desiredStatus,
      });
    } catch {}
  }
  async function ytmUpdate(d) {
    ytmState.last = Date.now();
    if (!ytmWatch)
      ytmWatch = setInterval(() => {
        if (ytmState.key && Date.now() - ytmState.last > 15000) ytmClear().catch(() => {});
      }, 5000);
    if (!d || !d.playing || !d.title) {
      await ytmClear();
      return;
    }
    stopSpotifySync();
    const pos = Math.max(0, Number(d.position || 0) * 1000);
    const dur = Math.max(pos + 1000, Number(d.duration || 0) * 1000);
    const key = d.title + '|' + d.artist;
    const expectStart = Date.now() - pos;
    const drift = presenceData ? Math.abs((presenceData.start || 0) - expectStart) : 1e9;
    ytmState.playing = true;
    ytmState.title = String(d.title);
    ytmState.artist = String(d.artist || '');
    if (key === ytmState.key && drift < 4000 && presenceData) return;
    ytmState.key = key;
    clearTimedActivity();
    const cover = /^https:\/\//.test(d.cover || '') ? d.cover : undefined;
    presenceData = {
      name: 'YouTube Music',
      type: 'LISTENING',
      details: String(d.title).slice(0, 120),
      state: ('de ' + (d.artist || 'necunoscut')).slice(0, 120),
      imageUrl: cover,
      start: expectStart,
      end: expectStart + dur,
    };
    await pushPresence();
  }
  const LASTFM_FILE = path.join(DATA_DIR, 'lastfm_user.txt');
  let lastfmPoll = null,
    lastfmKey = '';
  function lastfmUser() {
    try {
      return fs.readFileSync(LASTFM_FILE, 'utf8').trim();
    } catch {
      return '';
    }
  }
  async function syncLastfm() {
    const user = lastfmUser();
    const key = process.env.LASTFM_API_KEY || '';
    if (!user || !key) return;
    const r = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'user.getrecenttracks',
        user,
        api_key: key,
        format: 'json',
        limit: 1,
      },
      timeout: 10000,
    });
    let t = r.data?.recenttracks?.track;
    if (Array.isArray(t)) t = t[0];
    const playing = t && t['@attr']?.nowplaying === 'true';
    if (!playing) {
      if (lastfmKey) {
        lastfmKey = '';
        await ytmClear();
      }
      return;
    }
    const title = t.name,
      artist = t.artist?.['#text'] || t.artist?.name || '';
    const k = title + '|' + artist;
    if (k === lastfmKey) {
      ytmState.last = Date.now();
      return;
    }
    lastfmKey = k;
    let dur = 0;
    try {
      const i = await axios.get('https://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'track.getInfo',
          track: title,
          artist,
          api_key: key,
          format: 'json',
        },
        timeout: 8000,
      });
      dur = Number(i.data?.track?.duration || 0) / 1000;
    } catch {}
    const img =
      (t.image || [])
        .map((x) => x['#text'])
        .filter(Boolean)
        .pop() || '';
    ytmState.key = '';
    await ytmUpdate({
      playing: true,
      title,
      artist,
      cover: img,
      position: 0,
      duration: dur || 210,
    });
  }
  function startLastfm() {
    if (lastfmPoll) clearInterval(lastfmPoll);
    lastfmKey = '';
    syncLastfm().catch(() => {});
    lastfmPoll = setInterval(() => {
      ytmState.last = Date.now();
      syncLastfm().catch((e) => console.error('[lastfm]', e.message));
    }, 4000);
  }
  function stopLastfm() {
    if (lastfmPoll) clearInterval(lastfmPoll);
    lastfmPoll = null;
    lastfmKey = '';
  }
  const ACT_TYPE_NUM = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    COMPETING: 5,
  };
  let presenceTimeout = null;
  let presenceRefresh = null;
  let presenceData = null;
  let cachedAsset = {
    url: '',
    key: '',
  };
  function clearTimedActivity() {
    if (presenceTimeout) {
      clearTimeout(presenceTimeout);
      presenceTimeout = null;
    }
    if (presenceRefresh) {
      clearInterval(presenceRefresh);
      presenceRefresh = null;
    }
    presenceData = null;
  }
  function longTimeout(ms, cb) {
    const STEP = 21600000;
    if (ms <= STEP) return setTimeout(cb, Math.max(1000, ms));
    return setTimeout(() => {
      presenceTimeout = longTimeout(ms - STEP, cb);
    }, STEP);
  }
  async function resolveLargeImage(imageUrl = STREAM_IMAGE_URL, applicationId = STREAM_APP_ID) {
    if (!imageUrl) return '';
    if (cachedAsset.url === imageUrl && cachedAsset.applicationId === applicationId && cachedAsset.key)
      return cachedAsset.key;
    try {
      const external = await RichPresence.getExternal(botClient, applicationId, imageUrl);
      const asset = external?.[0]?.external_asset_path;
      if (asset) {
        cachedAsset = {
          url: imageUrl,
          applicationId,
          key: `mp:${asset}`,
        };
        return cachedAsset.key;
      }
    } catch (e) {
      console.error('[presence asset]', String(e.message || e).slice(0, 80));
    }
    return '';
  }
  function normalizeGameName(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function gameMatchScore(query, name) {
    const a = normalizeGameName(query),
      b = normalizeGameName(name);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const qa = a.split(' '),
      nb = b.split(' ');
    const common = qa.filter((word) => nb.includes(word)).length;
    return common === qa.length ? (2 * common) / (qa.length + nb.length) : 0;
  }
  async function findGame(query) {
    const clean = String(query || '').trim();
    if (!clean) return null;
    const aliases = {
      csgo: 'Counter-Strike 2',
      cs2: 'Counter-Strike 2',
      gta: 'Grand Theft Auto V',
      gta5: 'Grand Theft Auto V',
      'gta v': 'Grand Theft Auto V',
      brawl: 'Brawl Stars',
      brawlstars: 'Brawl Stars',
      clashroyale: 'Clash Royale',
      coc: 'Clash of Clans',
      clashofclans: 'Clash of Clans',
      lol: 'League of Legends',
      freefire: 'Free Fire',
      pubgmobile: 'PUBG MOBILE',
    };
    const term = aliases[clean.toLowerCase()] || clean;
    const options = {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    };
    const results = await Promise.allSettled([
      axios.get('https://discord.com/api/v9/applications/detectable', options),
      axios.get('https://itunes.apple.com/search', {
        ...options,
        params: {
          term,
          entity: 'software',
          country: 'us',
          limit: 20,
        },
      }),
      axios.get('https://store.steampowered.com/api/storesearch/', {
        ...options,
        params: {
          term,
          l: 'english',
          cc: 'US',
        },
      }),
    ]);
    const candidates = [];
    const discord = results[0].status === 'fulfilled' ? results[0].value.data : [];
    if (Array.isArray(discord))
      for (const app of discord) {
        if (!app.id || !app.name) continue;
        const score = Math.max(
          ...[app.name, ...(app.aliases || [])].map((name) => gameMatchScore(term, name)),
        );
        if (score < 0.75) continue;
        candidates.push({
          name: app.name,
          applicationId: String(app.id),
          score,
          priority: 3,
          imageUrl: app.icon_hash
            ? `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon_hash}.png?size=512`
            : '',
          source: 'Discord',
        });
      }
    const mobile = results[1].status === 'fulfilled' ? results[1].value.data?.results : [];
    if (Array.isArray(mobile))
      for (const app of mobile) {
        if (app.primaryGenreName !== 'Games' && !(app.genreIds || []).includes('6014')) continue;
        const score = gameMatchScore(term, app.trackName);
        if (score < 0.75) continue;
        candidates.push({
          name: app.trackName,
          applicationId: '',
          score,
          priority: 2,
          imageUrl: app.artworkUrl512 || app.artworkUrl100 || '',
          source: 'App Store',
        });
      }
    const steam = results[2].status === 'fulfilled' ? results[2].value.data?.items : [];
    if (Array.isArray(steam))
      for (const app of steam) {
        if (!app.id || !app.name) continue;
        const score = gameMatchScore(term, app.name);
        if (score < 0.75) continue;
        candidates.push({
          name: app.name,
          applicationId: '',
          score,
          priority: 1,
          imageUrl: app.tiny_image || `https://cdn.akamai.steamstatic.com/steam/apps/${app.id}/header.jpg`,
          source: 'Steam',
        });
      }
    candidates.sort((a, b) => b.score - a.score || b.priority - a.priority);
    const best = candidates[0];
    if (!best)
      return {
        name: term,
        applicationId: '',
        imageUrl: '',
        source: '',
      };
    if (!best.imageUrl) {
      const artwork = candidates.find((item) => item.imageUrl && gameMatchScore(best.name, item.name) === 1);
      if (artwork) best.imageUrl = artwork.imageUrl;
    }
    return best;
  }
  async function setGameActivity(query) {
    const game = await findGame(query);
    if (!game) return null;
    stopSpotifySync();
    clearTimedActivity();
    presenceData = {
      name: game.name,
      type: 'PLAYING',
      start: Date.now(),
      end: null,
      imageUrl: game.imageUrl,
      applicationId: game.applicationId || STREAM_APP_ID,
      simpleGame: true,
    };
    if (!(await pushPresence())) throw new Error('Discord did not accept the activity');
    presenceRefresh = setInterval(() => {
      pushPresence().catch(() => {});
    }, 60000);
    return game;
  }
  async function pushPresence() {
    if (!presenceData) return false;
    const { name, type, start, end, imageUrl, details, state, simpleGame } = presenceData;
    const applicationId = presenceData.applicationId || STREAM_APP_ID;
    const image = await resolveLargeImage(
      simpleGame ? imageUrl : imageUrl || STREAM_IMAGE_URL,
      applicationId,
    );
    try {
      const rp = new RichPresence(botClient)
        .setApplicationId(applicationId)
        .setType(type)
        .setName(name)
        .setStartTimestamp(start);
      if (!simpleGame) rp.setDetails(details || name);
      if (state) {
        try {
          rp.setState(state);
        } catch {}
      }
      if (end) {
        try {
          rp.setEndTimestamp(end);
        } catch {}
      }
      if (image) {
        try {
          rp.setAssetsLargeImage(image).setAssetsLargeText(name);
        } catch {}
      }
      if (!simpleGame) {
        try {
          rp.setURL(STREAM_LINK);
        } catch {}
      }
      await botClient.user.setPresence({
        activities: [rp],
        status: desiredStatus,
      });
      return true;
    } catch (e) {
      try {
        botClient.ws.broadcast({
          op: 3,
          d: {
            since: 0,
            status: desiredStatus,
            afk: false,
            activities: [
              {
                name,
                type: ACT_TYPE_NUM[type] ?? 0,
                application_id: applicationId,
                url: simpleGame ? undefined : STREAM_LINK,
                details: simpleGame ? undefined : details || name,
                state: state || undefined,
                assets: image
                  ? {
                      large_image: image,
                      large_text: name,
                    }
                  : undefined,
                timestamps: end
                  ? {
                      start,
                      end,
                    }
                  : {
                      start,
                    },
              },
            ],
          },
        });
        return true;
      } catch (e2) {
        console.error('[presence]', String(e2.message || e2).slice(0, 80));
      }
      return false;
    }
  }
  const LISTEN_CYCLE_MS = 3600000;
  async function setTimedActivity(name, type = 'LISTENING', minutes = 0) {
    clearTimedActivity();
    const start = Date.now();
    const ms = Math.round(Math.max(0, Number(minutes) || 0) * 60000);
    const isListen = type === 'LISTENING';
    const end = ms > 0 ? start + ms : isListen ? start + LISTEN_CYCLE_MS : null;
    presenceData = {
      name,
      type,
      start,
      end,
    };
    await pushPresence();
    presenceRefresh = setInterval(() => {
      pushPresence().catch(() => {});
    }, 60000);
    if (ms > 0) {
      presenceTimeout = longTimeout(ms, async () => {
        presenceTimeout = null;
        clearTimedActivity();
        try {
          await botClient.user.setPresence({
            activities: [],
            status: desiredStatus,
          });
        } catch {}
      });
    } else if (isListen) {
      presenceTimeout = longTimeout(LISTEN_CYCLE_MS, () => {
        presenceTimeout = null;
        setTimedActivity(name, type, 0).catch(() => {});
      });
    }
    return true;
  }
  async function setRichActivity(name, type = 'STREAMING', minutes = 0) {
    return setTimedActivity(name, type, minutes);
  }
  const botClient = new Client({
    checkUpdate: false,
    readyStatus: false,
    ws: {
      properties: {
        os: 'Windows',
        browser: 'Discord Client',
        device: '',
        system_locale: 'en-US',
        browser_user_agent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36',
        browser_version: '28.2.10',
        os_version: '10',
        referrer: '',
        referring_domain: '',
        referrer_current: '',
        referring_domain_current: '',
        release_channel: 'stable',
        client_build_number: 289985,
        client_event_source: null,
      },
    },
    retryLimit: 5,
    failIfNotExists: false,
    partials: ['CHANNEL', 'MESSAGE', 'GUILD_MEMBER', 'REACTION', 'USER'],
  });
  botClient.on('warn', () => {});
  botClient.on('error', (err) => {
    const m = err?.message || String(err);
    if (/heartbeat|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Unauthorized|503|502/i.test(m)) return;
    console.error('[WS ERROR]', m.slice(0, 120));
  });
  botClient.on('shardDisconnect', () => {});
  botClient.on('shardReconnecting', () => {});
  botClient.on('shardResume', () => {
    if (botClient.user) {
      try {
        botClient.user.setStatus(desiredStatus);
      } catch {}
      if (vrActive && !vrSessions.length) startVrMode(vrStatus);
    }
  });
  botClient.on('invalidated', () => {
    console.error('[FATAL] Token invalidat — oprire client');
    activeBots.delete(token);
    botControls.delete(token);
  });
  botClient.on('ready', () => {
    console.log(`${SCRIPT_NAME} - conectat ca ${botClient.user.tag}`);
    console.log(
      `fraze spam: ${spamPhrases.length} | reply-uri: ${replyWords.length} | beef: ${beefPhrases.length}`,
    );
    applyStatus('online')
      .then(() => startPcMode('online'))
      .catch(() => {});
    if (loadSpotifyAuth().refresh_token) startSpotifySync();
    if (lastfmUser() && process.env.LASTFM_API_KEY) startLastfm();
    activeBots.set(token, botClient);
    restoreSession().catch(() => {});
    setInterval(() => saveSession(), 30000);
    botIndexes.set(BOT_INDEX, {
      token,
      index: BOT_INDEX,
      client: botClient,
      commands: COMMANDS_ENABLED,
      tag: botClient.user?.tag || '?',
      exec: remoteExec,
    });
    if (BOT_INDEX !== 1) rememberToken(token, BOT_INDEX, COMMANDS_ENABLED);
    console.log(
      '[index ' +
        BOT_INDEX +
        '] ' +
        (botClient.user?.tag || '?') +
        ' | comenzi: ' +
        (COMMANDS_ENABLED ? 'da' : 'no (main account only)'),
    );
    botControls.set(token, {
      getBotUser: () => ({
        tag: botClient.user?.tag,
        username: botClient.user?.username,
      }),
      getGuilds: () =>
        [...botClient.guilds.cache.values()].map((g) => ({
          id: g.id,
          name: g.name,
        })),
      getFiles: () => listAudioFiles().map((f) => path.basename(f)),
      startSpotifySync: () => startSpotifySync(),
      ytmUpdate: (d) => ytmUpdate(d),
      getVoiceStatus: (guildId) => {
        const vs = voiceStates[guildId];
        if (!vs || !vs.connection)
          return {
            connected: false,
            file: null,
            volume: 100,
            loop: false,
          };
        return {
          connected: vs.connection.state?.status === VoiceConnectionStatus.Ready,
          file: vs.currentFile ? path.basename(vs.currentFile) : null,
          volume: vs.volume || 100,
          loop: vs.loop || false,
        };
      },
      join: async (channelId, guildId, filename) => {
        const guild = botClient.guilds.cache.get(guildId);
        if (!guild)
          return {
            ok: false,
            msg: 'Guild negasit',
          };
        let channel;
        try {
          channel = botClient.channels.cache.get(channelId) || (await botClient.channels.fetch(channelId));
        } catch (e) {
          return {
            ok: false,
            msg: e.message,
          };
        }
        if (!channel || !['GUILD_VOICE', 'GUILD_STAGE_VOICE'].includes(channel.type))
          return {
            ok: false,
            msg: 'Not a voice channel',
          };
        let audioPath;
        if (filename) {
          audioPath = findAudioFile(filename);
          if (!audioPath)
            return {
              ok: false,
              msg: `Fisierul "${filename}" doesn't exist`,
            };
        } else {
          const flist = listAudioFiles();
          if (!flist.length)
            return {
              ok: false,
              msg: 'No audio files in hosting',
            };
          audioPath = flist[0];
        }
        const vs = getVoiceState(guildId);
        if (vs.connection?.state?.status === VoiceConnectionStatus.Ready)
          return {
            ok: false,
            msg: 'Already in voice. Leave first.',
          };
        try {
          if (vs.connection) {
            vs.loop = false;
            try {
              vs.player?.stop(true);
            } catch {}
            try {
              vs.connection.destroy();
            } catch {}
            vs.connection = null;
            await sleep(500);
          }
          const connection = joinVoiceChannel({
            group: VOICE_GROUP,
            channelId: channel.id,
            guildId,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
          });
          const player = createAudioPlayer();
          vs.connection = connection;
          vs.player = player;
          vs.currentFile = audioPath;
          vs.loop = true;
          if (!vs.volume) vs.volume = 150;
          connection.on('error', (e) => console.error('[VOICE]', e.message));
          player.on('error', (e) => console.error('[PLAYER]', e.message));
          connection.once(VoiceConnectionStatus.Ready, () => {
            try {
              connection.rejoin({
                channelId: connection.joinConfig.channelId,
                selfDeaf: !!vs.selfDeaf,
                selfMute: !!vs.selfMute,
              });
            } catch {}
            connection.subscribe(player);
            playLoop(vs);
          });
          return {
            ok: true,
            msg: `intrat in voice | reda: ${path.basename(audioPath)}`,
          };
        } catch (e) {
          return {
            ok: false,
            msg: e.message,
          };
        }
      },
      play: async (guildId, filename) => {
        const vs = getVoiceState(guildId);
        if (!vs.connection || vs.connection.state.status !== VoiceConnectionStatus.Ready)
          return {
            ok: false,
            msg: 'Not in voice',
          };
        const audioPath = findAudioFile(filename);
        if (!audioPath)
          return {
            ok: false,
            msg: `Fisierul "${filename}" doesn't exist`,
          };
        if (!vs.player)
          return {
            ok: false,
            msg: 'Player invalid',
          };
        vs.loop = false;
        try {
          vs.player.stop(true);
        } catch {}
        await sleep(400);
        vs.currentFile = audioPath;
        vs.loop = true;
        vs.connection.subscribe(vs.player);
        playLoop(vs);
        return {
          ok: true,
          msg: `redau: ${path.basename(audioPath)}`,
        };
      },
      stop: (guildId) => {
        const vs = getVoiceState(guildId);
        if (!vs.connection || vs.connection.state.status !== VoiceConnectionStatus.Ready)
          return {
            ok: false,
            msg: 'Not in voice',
          };
        vs.loop = false;
        try {
          vs.player?.stop(true);
        } catch {}
        vs.currentFile = null;
        return {
          ok: true,
          msg: 'redare oprita',
        };
      },
      leave: (guildId) => {
        const vs = getVoiceState(guildId);
        if (!vs.connection)
          return {
            ok: false,
            msg: 'Not in voice',
          };
        vs.loop = false;
        if (vs.player) {
          try {
            vs.player.stop(true);
          } catch {}
          vs.player = null;
        }
        try {
          vs.connection.destroy();
        } catch {}
        vs.connection = null;
        vs.currentFile = null;
        return {
          ok: true,
          msg: 'left voice',
        };
      },
      volume: (guildId, vol) => {
        const v = Math.max(1, Math.min(400, parseInt(vol)));
        if (isNaN(v))
          return {
            ok: false,
            msg: 'Volum invalid (1-400)',
          };
        const vs = getVoiceState(guildId);
        vs.volume = v;
        if (vs.loop && vs.currentFile && vs.connection?.state?.status === VoiceConnectionStatus.Ready) {
          try {
            vs.player?.stop(true);
          } catch {}
        }
        return {
          ok: true,
          msg: `volum setat: ${v}%`,
        };
      },
    });
  });
  botClient.on('messageDelete', (msg) => {
    if (!msg.author) return;
    if (msg.author.id === botClient.user?.id) return;
    const isDM = msg.channel.type === 'DM';
    const isGroup = msg.channel.type === 'GROUP_DM';
    const isServer = !isDM && !isGroup;
    if (isDM && !dmlogActive) return;
    if ((isServer || isGroup) && !svlogActive) return;
    snipeCache[msg.channel.id] = {
      author: msg.author,
      content: msg.content || '',
      attachment: msg.attachments?.first()?.url || null,
      timestamp: Date.now(),
      isDM,
      guildName: msg.guild?.name || null,
      channelName: msg.channel.name || (isDM ? 'DM' : 'grup'),
    };
  });
  botClient.on('messageUpdate', (oldMsg, newMsg) => {
    if (!oldMsg.author) return;
    if (oldMsg.author.id === botClient.user?.id) return;
    if (!oldMsg.content || oldMsg.content === newMsg.content) return;
    const isDM = oldMsg.channel.type === 'DM';
    const isGroup = oldMsg.channel.type === 'GROUP_DM';
    const isServer = !isDM && !isGroup;
    if (isDM && !dmlogActive) return;
    if ((isServer || isGroup) && !svlogActive) return;
    editSnipeCache[oldMsg.channel.id] = {
      author: oldMsg.author,
      oldContent: oldMsg.content || '',
      newContent: newMsg.content || '',
      attachment: oldMsg.attachments?.first()?.url || null,
      timestamp: Date.now(),
      isDM,
      guildName: oldMsg.guild?.name || null,
      channelName: oldMsg.channel.name || (isDM ? 'DM' : 'grup'),
    };
  });
  const antiGcSeen = new Set();
  async function antiGcHandle(chId, ownerId) {
    if (!antiGc || !chId || antiGcSeen.has(chId)) return;
    if (ownerId && ownerId === botClient.user?.id) return;
    antiGcSeen.add(chId);
    setTimeout(() => antiGcSeen.delete(chId), 60000);
    await silentLeaveGc(chId);
  }
  botClient.on('raw', (pkt) => {
    try {
      if (!antiGc || !pkt || !pkt.d) return;
      if (pkt.t === 'CHANNEL_CREATE' && pkt.d.type === 3) antiGcHandle(pkt.d.id, pkt.d.owner_id);
      else if (pkt.t === 'CHANNEL_RECIPIENT_ADD' && pkt.d.user?.id === botClient.user?.id)
        antiGcHandle(pkt.d.channel_id, null);
    } catch {}
  });
  const SELF_OUTPUT_IDS = new Set();
  const SELF_PENDING_TEXT = new Map();
  function markPendingSelfText(t) {
    try {
      const k = String(t || '').trim();
      if (!k) return;
      SELF_PENDING_TEXT.set(k, (SELF_PENDING_TEXT.get(k) || 0) + 1);
      setTimeout(() => {
        const n = (SELF_PENDING_TEXT.get(k) || 0) - 1;
        if (n > 0) SELF_PENDING_TEXT.set(k, n);
        else SELF_PENDING_TEXT.delete(k);
      }, 15000);
    } catch {}
  }
  function isPendingSelfText(t) {
    try {
      const k = String(t || '').trim();
      if (!k) return false;
      const n = SELF_PENDING_TEXT.get(k) || 0;
      if (n <= 0) return false;
      if (n === 1) SELF_PENDING_TEXT.delete(k);
      else SELF_PENDING_TEXT.set(k, n - 1);
      return true;
    } catch {
      return false;
    }
  }
  function markSelfOutput(m) {
    try {
      if (!m) return m;
      const list = Array.isArray(m) ? m : [m];
      for (const x of list) {
        if (x && x.id) {
          SELF_OUTPUT_IDS.add(x.id);
          setTimeout(() => SELF_OUTPUT_IDS.delete(x.id), 60000);
        }
      }
    } catch {}
    return m;
  }
  botClient.on('messageCreate', async (message) => {
    try {
      if (giftSniper.on) giftSniperCheck(message);
    } catch {}
    if (message.author.id === botClient.user.id) {
      if (SELF_OUTPUT_IDS.has(message.id)) return;
      if (isPendingSelfText(message.content)) {
        markSelfOutput(message);
        return;
      }
      await processCommands(message);
      if (!message._finesseProcessed) {
        let content = message.content;
        let edited = false;
        if (reverseMode) {
          content = content.split('').reverse().join('');
          edited = true;
        }
        if (mentionTargetId) {
          const mention = `<@${mentionTargetId}>`;
          if (!content.includes(mention)) {
            content = content + ' ' + mention;
            edited = true;
          }
        }
        if (edited && content !== message.content) {
          try {
            await message.edit(content);
            message._finesseProcessed = true;
          } catch {}
        }
      }
      return;
    }
    await captureStealMessage(message);
    await handleAutoResponses(message);
  });
  async function handleAutoResponses(message) {
    if (message.author.id === botClient.user.id) return;
    try {
      if (specialUsers && specialUsers.has(message.author.id)) {
        const _txt = (message.content || '').toLowerCase();
        const _INSULTS = [
          'pula',
          'pizda',
          'pizdii',
          'pzd',
          'muie',
          'muist',
          'fut',
          'futu',
          'coaie',
          'dracu',
          'handicap',
          'handicapat',
          'prost',
          'tampit',
          'idiot',
          'curva',
          'curvo',
          'sugi',
          'morti',
          'pisa',
          'fmm',
          'bagmi',
          'bagami',
          'labar',
          'bou',
          'vaca',
          'porc',
          'retardat',
          'retard',
          'javra',
          'jegos',
          'nesimtit',
          'pulifrici',
          'poponar',
          'muist',
          'muisto',
        ];
        const _hasInsult = _INSULTS.some((w) => new RegExp('\\b' + w, 'i').test(_txt));
        if (_hasInsult) {
          const _pool =
            typeof beefPhrases !== 'undefined' && beefPhrases.length
              ? beefPhrases
              : typeof replyWords !== 'undefined' && replyWords.length
                ? replyWords
                : [];
          if (_pool.length) {
            const _line = _pool[Math.floor(Math.random() * _pool.length)];
            try {
              await message.reply(_line);
            } catch {
              try {
                await message.channel.send('<@' + message.author.id + '> ' + _line);
              } catch {}
            }
          }
          return;
        }
      }
    } catch (e) {
      console.error('[special-insult]', e.message);
    }
    const now = Date.now();
    if (autoreactActive[message.author.id]) {
      try {
        await message.react(autoreactActive[message.author.id]);
      } catch (e) {
        console.error('[autoreact]', e.message?.slice(0, 80));
      }
    }
    if (channelReact[message.channel.id]) {
      try {
        await message.react(channelReact[message.channel.id]);
      } catch (e) {
        console.error('[channelreact]', e.message?.slice(0, 80));
      }
    }
    if (afkMode && message.mentions.has(botClient.user.id)) {
      await message.reply(afkReplyText()).catch(() => {});
    }
    if (afkCheckMode) {
      const rawTxt = (message.content || '').toLowerCase();
      const isAfkCheckWord = /\bafk\s*check\b/.test(rawTxt);
      let repliesToMe = false;
      if (message.reference?.messageId) {
        try {
          const ref = await message.channel.messages.fetch(message.reference.messageId);
          if (ref?.author?.id === botClient.user.id) repliesToMe = true;
        } catch {}
      }
      const mentionsMe = message.mentions.has(botClient.user.id);
      const wKey = message.channel.id + ':' + message.author.id;
      if (isAfkCheckWord && (mentionsMe || repliesToMe)) {
        afkCheckChannel = message.channel.id;
        await sleep(1000 + Math.floor(Math.random() * 2000));
        const phrase = afkNextPhrase();
        if (phrase) await message.reply(phrase).catch(() => {});
        afkCheckWatch.set(wKey, {
          until: Date.now() + AFKCHECK_WATCH_MS,
          last: Date.now(),
        });
        return;
      }
      const w = afkCheckWatch.get(wKey);
      if (w) {
        if (Date.now() > w.until) {
          afkCheckWatch.delete(wKey);
        } else if (isCountingMessage(message.content)) {
          if (Date.now() - w.last >= AFKCHECK_MIN_GAP) {
            w.last = Date.now();
            w.until = Date.now() + AFKCHECK_WATCH_MS;
            const phrase = afkNextPhrase();
            if (phrase) await message.reply(phrase).catch(() => {});
          }
          return;
        }
      }
    }
    if (customReplyState[message.author.id]) {
      const state = customReplyState[message.author.id];
      const text = state.text;
      if (!text) return;
      const cycle = state.cycle || 1;
      try {
        if (cycle === 1) {
          await message.reply(text);
        } else if (cycle === 2) {
          await message.channel.send(`<@${message.author.id}> ${text}`);
        } else {
          await message.channel.send(text);
        }
      } catch (e) {
        console.error('[customreply] trimitere esuata:', e.message);
      }
      state.cycle = (cycle % 3) + 1;
      return;
    }
    if (mockTargets[message.author.id] && message.content && message.content.trim()) {
      const mLast = mockLastTime[message.author.id] || 0;
      if (now - mLast >= REPLY_COOLDOWN) {
        mockLastTime[message.author.id] = now;
        const mocked = mockText(message.content);
        await message.channel.sendTyping().catch(() => {});
        await sleep(1000);
        try {
          await message.reply(mocked).catch(async () => {
            await message.channel.send('<@' + message.author.id + '> ' + mocked).catch(() => {});
          });
        } catch {}
      }
      return;
    }
    if (copyTargets[message.author.id] && message.content && message.content.trim()) {
      const cLast = copyLastTime[message.author.id] || 0;
      if (now - cLast >= REPLY_COOLDOWN) {
        copyLastTime[message.author.id] = now;
        await message.channel.sendTyping().catch(() => {});
        await sleep(800);
        try {
          await message.reply(message.content).catch(async () => {
            await message.channel.send('<@' + message.author.id + '> ' + message.content).catch(() => {});
          });
        } catch {}
      }
      return;
    }
    if (replyState.running && replyState.targets.includes(message.author.id)) {
      replyState.busy = replyState.busy || {};
      if (replyState.busy[message.author.id]) return;
      const last = replyState.lastReplyTime[message.author.id] || 0;
      if (now - last < Math.max(REPLY_COOLDOWN, replyGap * 1000)) return;
      replyState.busy[message.author.id] = true;
      replyState.lastReplyTime[message.author.id] = now;
      try {
        const effectiveDelay =
          replyState.replyDelays[message.author.id] !== undefined
            ? replyState.replyDelays[message.author.id]
            : replyDelay;
        await message.channel.sendTyping().catch(() => {});
        await liveWait(
          () =>
            replyState.replyDelays[message.author.id] !== undefined
              ? replyState.replyDelays[message.author.id]
              : replyDelay,
          () => !replyState.running,
        );
        if (!replyState.running || !replyState.targets.includes(message.author.id)) return;
        if (!replyWords.length) return;
        if (replyState.lineIndex >= replyWords.length) replyState.lineIndex = 0;
        const line = replyWords[replyState.lineIndex];
        replyState.lineIndex = (replyState.lineIndex + 1) % replyWords.length;
        if (!line?.trim()) return;
        try {
          if (replyState.cycle === 1) await message.reply(line);
          else if (replyState.cycle === 2) await message.channel.send(`<@${message.author.id}> ${line}`);
          else await message.channel.send(line);
        } catch {}
        replyState.cycle = (replyState.cycle % 3) + 1;
      } finally {
        replyState.busy[message.author.id] = false;
        replyState.lastReplyTime[message.author.id] = Date.now();
      }
      return;
    }
    if (aiState.running && aiState.targets.includes(message.author.id)) {
      const last = aiState.lastReplyTime[message.author.id] || 0;
      if (now - last < REPLY_COOLDOWN) return;
      aiState.lastReplyTime[message.author.id] = now;
      await message.channel.sendTyping().catch(() => {});
      await sleep(replyDelay * 1000);
      if (!aiState.running) return;
      if (!aiState.history[message.author.id]) aiState.history[message.author.id] = [];
      aiState.history[message.author.id].push({
        role: 'user',
        content: message.content,
      });
      if (aiState.history[message.author.id].length > 20) aiState.history[message.author.id].shift();
      const reply = await askGemini(message.content, aiState.history[message.author.id]);
      aiState.history[message.author.id].push({
        role: 'assistant',
        content: reply,
      });
      if (!reply?.trim()) return;
      try {
        if (aiState.cycle === 1) await message.reply(reply);
        else if (aiState.cycle === 2) await message.channel.send(`<@${message.author.id}> ${reply}`);
        else await message.channel.send(reply);
      } catch {}
      aiState.cycle = (aiState.cycle % 3) + 1;
      return;
    }
    if (
      antiTag.on &&
      message.author.id !== botClient.user.id &&
      message.mentions?.users?.has(botClient.user.id)
    ) {
      const scopeOk =
        !antiTag.scope || antiTag.scope === message.channel.id || antiTag.scope === message.guild?.id;
      if (scopeOk) {
        const pool =
          antiTag.lines && antiTag.lines.length ? antiTag.lines : antiTag.text ? [antiTag.text] : [];
        if (pool.length) {
          const line = pool[Math.floor(Math.random() * pool.length)];
          try {
            await message.reply(line);
          } catch {}
        }
      }
    }
  }
  const ALIASES = {
    av: 'avatar',
    pfp: 'avatar',
    pb: 'banner',
    esnipe: 'snipeedit',
    csnipe: 'clearsnipe',
    rsnipe: 'snipe',
    arhiva: 'files',
    unlogin: 'removetoken',
    typing: 'typingfake',
    stoptyping: 'stoptypingfake',
    vstatus: 'voicestatus',
    mainuptime: 'uptime',
    spam: 'start',
    stopspam: 'stop',
    vol: 'volume',
    j: 'join',
    l: 'leave',
    sinfo: 'serverinfo',
    ui: 'info',
    vtokens: 'vtoken',
  };
  const DOLLAR_CMDS = new Set([
    'game',
    'gameoff',
    'customloop',
    'stopcustomloop',
    'delayloop',
    'stopdelayloop',
    'stopallloops',
    'loopinfo',
    'start',
    'pic',
    'tts',
    'reply',
    'stopreply',
    'reai',
    'stopreai',
    'delayreply',
    'replydelay',
    'replygap',
    'customreply',
    'customspam',
    'stopcustomreply',
    'stopcustomspam',
    'listcustomreply',
    'listcustomspam',
    'startchannel',
    'stopchannel',
    'startrepeat',
    'stoprepeat',
    'delay',
    'delayspiced',
    'delaychannel',
    'gc',
    'gcadd',
    'gcleave',
    'gcrename',
    'streamimage',
    'stream',
    'stopstream',
    'watching',
    'stopwatching',
    'playing',
    'stopplaying',
    'listening',
    'stoplistening',
    'afk',
    'afkmsg',
    'addafkmsg',
    'listafkmsg',
    'clearafkmsg',
    'afkcheck',
    'autoreact',
    'stopautoreact',
    'tagall',
    'addnotepadspam',
    'addnotepad',
    'addnotepadreply',
    'addnotepadbeef',
    'addnotepadgroup',
    'addnotepadafk',
    'addnotepadafkcheck',
    'listnotepadafk',
    'clearnotepadafk',
    'groupname',
    'stopgroupname',
    'listnotepadgroup',
    'clearnotepadgroup',
    'snipe',
    'snipeedit',
    'clearsnipe',
    'reverse',
    'stopreverse',
    'mention',
    'stopmention',
    'avatar',
    'banner',
    'typingfake',
    'stoptypingfake',
    'autobeefer',
    'stopautobeefer',
    'delayatbf',
    'addtoken',
    'removetoken',
    'mock',
    'stopmock',
    'copymsg',
    'stopcopy',
    'listtargets',
    'clearall',
    'uptime',
    'ping',
    'say',
    'clear',
    'info',
    'serverav',
    'serverbanner',
    'stealnotepad',
    'stopsteal',
    'spotifyconnect',
    'spotifystatus',
    'stopspotify',
    'ytmconnect',
    'ytm',
    'ytmstatus',
    'stopytm',
    'ytmapp',
    'lastfm',
  ]);
  const EQUAL_CMDS = new Set([
    'nsniper',
    'sniper',
    'giftsniper',
    'stopsniper',
    'stopnsniper',
    'sniperoff',
    'sniperstatus',
    'nitrostatus',
    'quest',
    'queston',
    'quests',
    'stopquest',
    'questoff',
    'queststatus',
    'questlist',
    'questdebug',
    'troll',
    'gay',
    'ghostping',
    'weather',
    'drag',
    'offdrag',
    'status',
    'channelreact',
    'stopchannelreact',
    'serverinfo',
    '0',
    'mp3',
    'voice',
    'vm',
    'vocal',
  ]);
  const EXCL_CMDS = new Set([
    'join',
    'leave',
    'files',
    'volume',
    'voicestatus',
    'def',
    'undef',
    'mute',
    'unmute',
    'partaj',
    'partaon',
    'partaoff',
    'camera',
    'cam',
    'cameraoff',
    'camoff',
  ]);
  const HELP_MAIN = `# finesse14
startrepeat 
stoprepeat
start spiced 
stop spiced
startchannel
stopchannel
partaj 
partaoff
camera
cameraoff
start 
stop
pic 
tts 
reply 
stopreply 
customspam 
customreply 
gc 
stream
status 
nsniper
quest
join 
clear-0
loops
uptime`;
  function smallFont(txt) {
    return txt
      .split('\n')
      .map((l) => (l.trim() && !l.startsWith('-# ') ? '-# ' + l : l))
      .join('\n');
  }
  const AUTO_DELETE_MS = 1000;
  const NO_AUTO_DELETE = new Set([
    'sniperstatus',
    'nitrostatus',
    'queststatus',
    'questlist',
    'questdebug',
    'quest',
    'queston',
    'quests',
    'stopquest',
    'questoff',
    'nsniper',
    'nitrosniper',
    'sniper',
    'giftsniper',
    'stopsniper',
    'stopnsniper',
    'stopnitrosniper',
    'sniperoff',
    'scriptstatus',
    'spotifystatus',
    'ytmstatus',
    'ytmconnect',
    'ytm',
    'vstatus',
    'voicestatus',
    'status',
    'tokens',
    'indexlist',
    'indexuri',
    'dlist',
    'antitagshow',
    'showspecial',
    'loops',
    'runstatus',
    'loopsusage',
    'counters',
    'listtargets',
    'listcustomspam',
    'listcustomreply',
    'listafkmsg',
    'listnotepadafk',
    'listnotepadgroup',
    'afkcheck',
    'uptime',
    'ping',
    'info',
    'files',
    'listfiles',
    'voiceall',
    'vall',
    'sayall',
    'weather',
    'snipe',
    'snipeedit',
    'esnipe',
    'rsnipe',
    'csnipe',
    'clearsnipe',
    'help',
    'list',
    'cmds',
    'tklist',
    'tkuser',
    'serverinfo',
    'calculate',
    'calc',
    'showfile',
    'showfiles',
    'namegenerator',
    'namegen',
    'ascii',
    'massban',
    'nickall',
    'lachiti',
    'admin',
  ]);
  let AUTO_DELETE_UNTIL = 0;
  function armAutoDelete(cmd) {
    AUTO_DELETE_UNTIL = NO_AUTO_DELETE.has(cmd) ? 0 : Date.now() + 20000;
  }
  async function buildRemoteCtx(origin, opts = {}) {
    const chId = origin.channel?.id || origin.channelId;
    let channel = chId ? botClient.channels.cache.get(chId) : null;
    if (!channel && chId) {
      try {
        channel = await botClient.channels.fetch(chId);
      } catch {}
    }
    if (!channel && origin.__console) channel = origin.__consoleChannel;
    if (!channel) return null;
    const outChannel = opts.quiet
      ? new Proxy(channel, {
          get(t, p) {
            if (p === 'send')
              return async () => ({
                edit: async () => {},
                delete: async () => {},
              });
            const v = t[p];
            return typeof v === 'function' ? v.bind(t) : v;
          },
        })
      : channel;
    return {
      channel: outChannel,
      guild: channel.guild || null,
      client: botClient,
      author: botClient.user,
      member: channel.guild?.members?.cache?.get(botClient.user.id) || null,
      content: origin.content,
      mentions: origin.mentions,
      id: origin.id,
      createdTimestamp: origin.createdTimestamp,
      delete: async () => {},
      react: async () => {},
      reply: async (t) => outChannel.send(t),
    };
  }
  async function remoteExec(origin, rawCmd, args, opts = {}) {
    let cmd = String(rawCmd || '').toLowerCase();
    if (ALIASES[cmd]) cmd = ALIASES[cmd];
    const ctx = await buildRemoteCtx(origin, opts);
    if (!ctx)
      return {
        error: 'account on index ' + BOT_INDEX + " doesn't have access to this channel",
      };
    try {
      KNULL_COUNTERS.cmds++;
      if (UTIL_CMDS.has(cmd)) {
        await handleUtility(ctx, cmd, args);
        return {
          ok: true,
        };
      }
      if (cmd === 'stop') {
        if (args[0] === 'spiced') await handleDollar(ctx, 'stop', args);
        else await handleExclamation(ctx, 'stop', args);
        return {
          ok: true,
        };
      }
      if (DOLLAR_CMDS.has(cmd)) {
        await handleDollar(ctx, cmd, args);
        return {
          ok: true,
        };
      }
      if (EQUAL_CMDS.has(cmd)) {
        await handleEqual(ctx, cmd, args);
        return {
          ok: true,
        };
      }
      if (EXCL_CMDS.has(cmd)) {
        await handleExclamation(ctx, cmd === 'voicestatus' ? 'status' : cmd, args);
        return {
          ok: true,
        };
      }
      return {
        error: 'command "' + cmd + '" doesn\'t exist',
      };
    } catch (e) {
      return {
        error: String(e?.message || e).slice(0, 120),
      };
    }
  }
  const REPLY_ALL_MAP = {
    replyall: 'reply',
    stopreplyall: 'stopreply',
    replydelayall: 'replydelay',
    delayreplyall: 'replydelay',
    reaiall: 'reai',
    stopreaiall: 'stopreai',
    customreplyall: 'customreply',
    stopcustomreplyall: 'stopcustomreply',
  };
  const NEEDS_PREFIX = new Set([
    '0',
    'say',
    'pic',
    'tts',
    'start',
    'stop',
    'stopall',
    'info',
    'status',
    'clear',
    'delay',
    'reply',
    'mock',
    'drag',
    'gay',
    'troll',
    'files',
    'arhiva',
    'join',
    'leave',
    'ping',
    'admin',
    'ascii',
    'calc',
    'calculate',
    'reverse',
    'mention',
    'snipe',
    'stream',
    'game',
    'playing',
    'listening',
    'watching',
    'afk',
    'volume',
    'vol',
    'weather',
    'gc',
    'avatar',
    'banner',
    'av',
    'pb',
    'j',
    'l',
    'def',
    'undef',
    'mute',
    'unmute',
  ]);
  const SAFE_ARG =
    /^(?:<[@#!&]{1,2}\d{5,25}>|\d{1,25}|\d+-\d+|on|off|https?:\/\/\S+|[\w.\-]+\.(?:mp3|ogg|wav|m4a|opus))$/i;
  function looksLikeCommand(cmd, args, raw) {
    if (cmd === 'sayall' || cmd === 'voiceall' || cmd === 'vall' || REPLY_ALL_MAP[cmd]) return true;
    if (NEEDS_PREFIX.has(cmd)) return false;
    if (args.length > 5) return false;
    if (/[?!,;:]/.test(raw)) return false;
    return args.every((a) => SAFE_ARG.test(a));
  }
  const { AsyncLocalStorage } = require('async_hooks');
  const SILENT_ALS = new AsyncLocalStorage();
  const CONFIRM_TEXTS = new Set();
  const KEEP_REPLY = new Set([
    'voice',
    'vm',
    'vocal',
    'pic',
    'tts',
    'help',
    'list',
    'cmds',
    'avatar',
    'banner',
    'translate',
    'translatefile',
    'stealnotepad',
    'weather',
    'mp3',
    'ping',
    'gay',
    'troll',
  ]);
  function markConfirm(t) {
    if (typeof t === 'string') {
      CONFIRM_TEXTS.add(t);
      if (CONFIRM_TEXTS.size > 500) CONFIRM_TEXTS.delete(CONFIRM_TEXTS.values().next().value);
    }
    return t;
  }
  (function patchSend() {
    const lib = require('discord.js-selfbot-v13');
    for (const k of Object.keys(lib)) {
      const C = lib[k];
      if (
        typeof C !== 'function' ||
        !C.prototype ||
        typeof C.prototype.send !== 'function' ||
        C.prototype.__silentPatched
      )
        continue;
      const orig = C.prototype.send;
      C.prototype.send = function (content, ...rest) {
        const st = SILENT_ALS.getStore();
        if (st && st.silent) {
          const txt =
            typeof content === 'string'
              ? content
              : content && typeof content.content === 'string' && !content.files && !content.embeds
                ? content.content
                : null;
          if (txt !== null && (CONFIRM_TEXTS.has(txt) || txt.startsWith('-# '))) return Promise.resolve(null);
        }
        return orig.call(this, content, ...rest);
      };
      C.prototype.__silentPatched = true;
    }
  })();
  async function processCommands(message) {
    let raw = (message.content || '').trim();
    if ('$=!'.includes(raw[0])) raw = raw.slice(1).trim();
    let c = (raw.split(/\s+/)[0] || '').toLowerCase();
    if (typeof ALIASES !== 'undefined' && ALIASES[c]) c = ALIASES[c];
    const silent = false; // Keep command responses visible in chat.
    return SILENT_ALS.run(
      {
        silent,
      },
      () => _processCommandsInner(message),
    );
  }
  async function _processCommandsInner(message) {
    if (!COMMANDS_ENABLED) return;
    const content = message.content;
    if (!content) return;
    let raw = content.trim();
    if ('$=!'.includes(raw[0])) {
      raw = raw.slice(1).trim();
    } else if ('.,/;>#&*?+-~^%'.includes(raw[0])) return;
    if (!raw) return;
    const args = raw.split(/\s+/);
    let cmd = args.shift().toLowerCase();
    if (ALIASES[cmd]) cmd = ALIASES[cmd];
    armAutoDelete(cmd);
    if (cmd === 'tokens' || cmd === 'indexlist' || cmd === 'indexuri') {
      try {
        await message.delete();
      } catch {}
      const lines = [...botIndexes.values()]
        .sort((a, b) => a.index - b.index)
        .map(
          (b) =>
            'index ' +
            b.index +
            ': ' +
            (b.client?.user?.tag || b.tag) +
            (b.index === 1 ? ' (principal)' : b.commands ? ' (acces comenzi)' : ' (no access)'),
        );
      try {
        await message.channel.send(smallFont(lines.length ? lines.join('\n') : 'no account added on index'));
      } catch {}
      return;
    }
    if (cmd === 'voiceall' || cmd === 'vall') {
      try {
        await message.delete();
      } catch {}
      const chId = (args[0] || '').replace(/\D/g, '');
      const file = args[1] || null;
      if (!/^\d{5,25}$/.test(chId)) {
        try {
          await message.channel.send(smallFont('usage: voiceall <channel_id> <fisier.mp3>'));
        } catch {}
        return;
      }
      const slots = [...botIndexes.values()].filter((s) => s.index !== BOT_INDEX && s.token !== token);
      if (!slots.length) {
        try {
          await message.channel.send(smallFont('no account on index (addtoken <token> <index>)'));
        } catch {}
        return;
      }
      const okList = [],
        errList = [];
      for (const slot of slots) {
        const res = await slot.exec(message, 'join', file ? [chId, file] : [chId], {
          quiet: true,
        });
        if (res && res.error) errList.push('index ' + slot.index + ': ' + res.error);
        else okList.push('index ' + slot.index);
        await sleep(700);
      }
      const out =
        (okList.length ? 'intrate in voice: ' + okList.join(', ') : 'no account joined') +
        (errList.length ? '\n' + errList.join('\n') : '');
      try {
        await message.channel.send(smallFont(out));
      } catch {}
      return;
    }
    if (REPLY_ALL_MAP[cmd]) {
      try {
        await message.delete();
      } catch {}
      const sub = REPLY_ALL_MAP[cmd];
      const slots = [...botIndexes.values()].sort((a, b) => a.index - b.index);
      const ok = [],
        bad = [];
      for (const slot of slots) {
        try {
          const res = await slot.exec(message, sub, args, {
            quiet: true,
          });
          if (res && res.error) bad.push('index ' + slot.index + ': ' + res.error);
          else ok.push(String(slot.index));
        } catch (e) {
          bad.push('index ' + slot.index + ': ' + String(e.message).slice(0, 60));
        }
        await sleep(400);
      }
      const out =
        '**' +
        sub.toUpperCase() +
        ' ON ALL ACCOUNTS**\n' +
        (ok.length ? '**OK:** index ' + ok.join(', ') : '**no accounts**') +
        (bad.length ? '\n' + bad.join('\n') : '');
      try {
        await message.channel.send(out);
      } catch {}
      return;
    }
    if (cmd === 'sayall' || (cmd === 'say' && /^(?:[2-9]|1\d|20)$/.test(args[0] || ''))) {
      try {
        await message.delete();
      } catch {}
      let slots, text;
      if (cmd === 'sayall') {
        text = args.join(' ').trim();
        slots = [...botIndexes.values()].filter((s) => s.index !== BOT_INDEX && s.token !== token);
      } else {
        const idx = parseInt(args[0], 10);
        text = args.slice(1).join(' ').trim();
        const slot = botIndexes.get(idx);
        slots = slot ? [slot] : [];
        if (!slot) {
          try {
            await message.channel.send(smallFont('no account on index ' + idx));
          } catch {}
          return;
        }
      }
      if (!text) {
        try {
          await message.channel.send(smallFont('usage: sayall <text>  /  say <index> <text>'));
        } catch {}
        return;
      }
      if (!slots.length) {
        try {
          await message.channel.send(smallFont('no account on index'));
        } catch {}
        return;
      }
      const missing = [];
      for (const slot of slots) {
        const cl = slot.client;
        let ch = cl?.channels?.cache?.get(message.channel.id);
        if (!ch) {
          try {
            ch = await cl.channels.fetch(message.channel.id);
          } catch {}
        }
        if (!ch) {
          missing.push('index ' + slot.index + ' (no access here)');
          continue;
        }
        try {
          await ch.send(text);
        } catch (e) {
          missing.push('index ' + slot.index + ': ' + String(e.message).slice(0, 60));
        }
        await sleep(600);
      }
      if (missing.length) {
        try {
          await message.channel.send(smallFont(missing.join('\n')));
        } catch {}
      }
      return;
    }
    if (
      args.length &&
      /^(?:[2-9]|1\d|20)$/.test(args[0]) &&
      !NO_INDEX_ROUTE.has(cmd) &&
      botIndexes.has(parseInt(args[0], 10)) &&
      looksLikeCommand(cmd, args.slice(1), args.slice(1).join(' '))
    ) {
      const idx = parseInt(args[0], 10);
      const slot = botIndexes.get(idx);
      if (slot && slot.token !== token) {
        try {
          await message.delete();
        } catch {}
        const res = await slot.exec(message, cmd, args.slice(1));
        if (res && res.error) {
          try {
            await message.channel.send(smallFont('[index ' + idx + '] ' + res.error));
          } catch {}
        }
        return;
      }
      if (!slot) {
        try {
          await message.delete();
        } catch {}
        return;
      }
    }
    if (cmd === 'help' || cmd === 'list' || cmd === 'cmds') {
      try {
        await message.delete();
      } catch {}
      try {
        await message.channel.send(HELP_MAIN);
      } catch {}
      return;
    }
    if (cmd === 'loops' || cmd === 'loopsusage' || cmd === 'runstatus' || cmd === 'rs') {
      try {
        await message.delete();
      } catch {}
      let body = renderRunStatus();
      if (cmd === 'loopsusage') {
        body +=
          '\n\ntyping loops: ' +
          typingFakeIntervals.size +
          '\nconturi active: ' +
          activeBots.size +
          '\nmesaje trimise: ' +
          KNULL_COUNTERS.sent +
          '\ncomenzi rulate: ' +
          KNULL_COUNTERS.cmds +
          '\nuptime: ' +
          uptime();
      }
      try {
        await message.channel.send(body);
      } catch {}
      return;
    }
    if (cmd === 'counters') {
      try {
        await message.delete();
      } catch {}
      try {
        await message.channel.send(
          smallFont(`mesaje: ${KNULL_COUNTERS.sent}\ncomenzi: ${KNULL_COUNTERS.cmds}`),
        );
      } catch {}
      return;
    }
    if (cmd === 'resetcounters') {
      try {
        await message.delete();
      } catch {}
      KNULL_COUNTERS.sent = 0;
      KNULL_COUNTERS.cmds = 0;
      try {
        await message.channel.send(smallFont('countere resetate'));
      } catch {}
      return;
    }
    if (UTIL_CMDS.has(cmd)) {
      KNULL_COUNTERS.cmds++;
      try {
        await message.delete();
      } catch {}
      try {
        await handleUtility(message, cmd, args);
      } catch (err) {
        try {
          await message.channel.send('-# error at ' + cmd + ': ' + String(err.message).slice(0, 100));
        } catch {}
      }
      return;
    }
    let target = null;
    if (cmd === 'stop') target = args[0] === 'spiced' ? 'dollar' : 'excl';
    else if (DOLLAR_CMDS.has(cmd)) target = 'dollar';
    else if (EQUAL_CMDS.has(cmd)) target = 'equal';
    else if (EXCL_CMDS.has(cmd)) target = 'excl';
    if (!target) return;
    KNULL_COUNTERS.cmds++;
    try {
      await message.delete();
    } catch {}
    try {
      if (target === 'dollar') await handleDollar(message, cmd, args);
      else if (target === 'equal') await handleEqual(message, cmd, args);
      else await handleExclamation(message, cmd === 'voicestatus' ? 'status' : cmd, args);
    } catch (err) {
      console.error(`[COMMAND FAILED] ${cmd}:`, err.message);
      try {
        await message.channel.send(`-# error at ${cmd}: ${err.message.slice(0, 100)}`);
      } catch {}
    }
  }
  const UTIL_CMDS = new Set([
    'listfiles',
    'delay',
    'rdelay',
    'dlist',
    'cleardlist',
    'tkuser',
    'tklist',
    'vusername',
    'vtoken',
    'login',
    'addspecial',
    'removespecial',
    'showspecial',
    'hypesquad',
    'startscript',
    'stopscript',
    'scriptstatus',
    'stopscriptall',
    'antigc',
    'antitag',
    'antitagshow',
    'calculate',
    'calc',
    'showfile',
    'showfiles',
    'namegenerator',
    'namegen',
    'ascii',
    'sreact',
    'sreactall',
    'reactall',
    'massban',
    'nickall',
    'restart',
    'nuke',
    'lachiti',
    'dmall',
    'admin',
  ]);
  async function handleUtility(ctx, cmd, args) {
    const small = (t) =>
      markConfirm(
        t
          .split('\n')
          .map((l) => (l.trim() && !l.startsWith('-# ') ? '-# ' + l : l))
          .join('\n'),
      );
    const usend = async (t) => {
      try {
        KNULL_COUNTERS.sent++;
        return await ctx.channel.send(small(t));
      } catch (e) {
        console.error('[util send]', e.message);
      }
    };
    const api = (p) => 'https://discord.com/api/v9' + p;
    if (cmd === 'delay') {
      if (parseDelaySec(args[0]) === null)
        return usend('delay <0-50> [channel_id] (ex: 0, 0.1, 0.5, 1.3, 50)');
      const sec = parseDelaySec(args[0]);
      const key = args[1] && /^\d{5,}$/.test(args[1]) ? args[1] : 'global';
      delayList.set(key, {
        type: 'fix',
        sec,
      });
      if (key === 'global') globalDelay = sec;
      wakeDelays();
      persistUtil();
      return usend('delay ' + sec + 'is set for ' + (key === 'global' ? 'global' : key));
    }
    if (cmd === 'rdelay') {
      const m = (args[0] || '').match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
      if (!m) return usend('rdelay <min-max> [channel_id]');
      const min = parseFloat(m[1]),
        max = parseFloat(m[2]);
      if (min < 0 || max > 50 || max <= min) return usend('interval invalid (0-50, max > min)');
      wakeDelays();
      const key = args[1] && /^\d{5,}$/.test(args[1]) ? args[1] : 'global';
      delayList.set(key, {
        type: 'rand',
        min,
        max,
      });
      persistUtil();
      return usend('rdelay ' + min + '-' + max + 'is set for ' + (key === 'global' ? 'global' : key));
    }
    if (cmd === 'dlist') {
      if (!delayList.size) return usend('no delay set');
      const lines = [...delayList.entries()].map(
        ([k, v]) => k + ': ' + (v.type === 'rand' ? v.min + '-' + v.max + 's random' : v.sec + 's'),
      );
      return usend(lines.join('\n'));
    }
    if (cmd === 'cleardlist') {
      const n = delayList.size;
      delayList.clear();
      persistUtil();
      return usend('sterse ' + n + ' delay-uri');
    }
    if (cmd === 'listfiles') {
      const roots = [__dirname, process.cwd(), '/home/container', '/app'].filter(
        (v, i, a) => v && a.indexOf(v) === i,
      );
      const seen = new Set();
      const out = [];
      const walk = (dir, depth) => {
        if (depth > 3 || out.length > 200) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, {
            withFileTypes: true,
          });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (!['node_modules', '.git', '.cache', '.npm'].includes(e.name) && !e.name.startsWith('.'))
              walk(full, depth + 1);
          } else if (/\.txt$/i.test(e.name) && !seen.has(e.name.toLowerCase())) {
            seen.add(e.name.toLowerCase());
            out.push(e.name);
          }
        }
      };
      for (const r of roots) {
        try {
          if (fs.existsSync(r)) walk(r, 0);
        } catch {}
      }
      if (!out.length) return usend('no .txt file in host');
      out.sort();
      try {
        KNULL_COUNTERS.sent++;
        return await ctx.channel.send(out.map((f) => '\u0060' + f + '\u0060').join('\n'));
      } catch (e) {
        console.error('[listfiles]', e.message);
        return;
      }
    }
    if (cmd === 'calculate' || cmd === 'calc') {
      const expr = args.join(' ').trim();
      if (!expr) return usend('calculate <expresie>  (ex: calculate (2^64)/3 + sqrt(144))');
      let result;
      try {
        let mj = null;
        try {
          mj = require('mathjs');
        } catch {}
        if (mj) {
          result = mj.evaluate(expr);
        } else {
          const safe = expr.replace(/\^/g, '**');
          if (/[^0-9+\-*/().,%\s*eE_a-zA-Z]/.test(safe)) throw new Error('caractere invalide');
          const fn = new Function('with(Math){return (' + safe + ')}');
          result = fn();
        }
        const str = typeof result === 'object' ? JSON.stringify(result) : String(result);
        try {
          KNULL_COUNTERS.sent++;
          return await ctx.channel.send('**' + expr + ' = ' + str + '**');
        } catch {}
      } catch (e) {
        return usend('calculation error: ' + e.message);
      }
      return;
    }
    if (cmd === 'showfile' || cmd === 'showfiles') {
      const roots = [__dirname, process.cwd(), '/home/container', '/app'].filter(
        (v, i, a) => v && a.indexOf(v) === i,
      );
      const seen = new Set();
      const out = [];
      const walk = (dir, depth) => {
        if (depth > 5 || out.length > 1500) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, {
            withFileTypes: true,
          });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (!['node_modules', '.git', '.cache', '.npm'].includes(e.name)) walk(full, depth + 1);
          } else if (!seen.has(full)) {
            seen.add(full);
            out.push(e.name);
          }
        }
      };
      for (const r of roots) {
        try {
          if (fs.existsSync(r)) walk(r, 0);
        } catch {}
      }
      if (!out.length) return usend('no file');
      out.sort();
      const header = '**FILES (' + out.length + ')**\n';
      const chunks = [];
      let cur = header;
      for (const f of out) {
        const line = '`' + f + '`\n';
        if (cur.length + line.length > 1900) {
          chunks.push(cur);
          cur = '';
        }
        cur += line;
      }
      if (cur) chunks.push(cur);
      for (const c of chunks) {
        try {
          KNULL_COUNTERS.sent++;
          await ctx.channel.send(c);
        } catch (e) {
          console.error('[showfile]', e.message);
        }
      }
      return;
    }
    if (cmd === 'namegenerator' || cmd === 'namegen') {
      const syllA = [
        'Ael',
        'Bran',
        'Cael',
        'Dain',
        'Ely',
        'Fen',
        'Gar',
        'Hal',
        'Ily',
        'Jor',
        'Kael',
        'Lyr',
        'Mor',
        'Nyx',
        'Or',
        'Pyr',
        'Qor',
        'Rae',
        'Syl',
        'Thal',
        'Ul',
        'Vex',
        'Wyn',
        'Xar',
        'Yor',
        'Zan',
        'Aur',
        'Bel',
        'Cyr',
        'Dre',
        'Esh',
        'Fyn',
        'Gwyn',
        'Hex',
        'Ith',
        'Jyn',
        'Kry',
        'Lox',
        'Myr',
        'Nev',
        'Oth',
        'Ply',
        'Qua',
        'Ryn',
        'Sae',
        'Tyv',
        'Umb',
        'Vry',
        'Wex',
        'Xyl',
        'Yll',
        'Zae',
      ];
      const syllB = [
        'ric',
        'vor',
        'mir',
        'yth',
        'arn',
        'oren',
        'yl',
        'en',
        'iel',
        'oth',
        'ax',
        'wyn',
        'ir',
        'on',
        'eth',
        'and',
        'iar',
        'us',
        'ion',
        'ael',
        'yn',
        'or',
        'em',
        'iss',
        'arn',
        'uld',
        'esh',
        'ovs',
        'yre',
        'wen',
        'oda',
        'ith',
        'arel',
        'elin',
        'oras',
        'ymar',
        'ivel',
        'usha',
        'anir',
      ];
      const syllC = [
        'son',
        'ov',
        'ski',
        'ford',
        'wood',
        'stone',
        'ander',
        'wick',
        'more',
        'field',
        'vale',
        'borne',
        'hardt',
        'strom',
        'light',
        'shade',
        'crest',
        'holm',
        'bane',
        'thorne',
      ];
      const rnd = (a) => a[Math.floor(Math.random() * a.length)];
      const n = rnd(syllA) + rnd(syllB) + (Math.random() < 0.55 ? rnd(syllC) : '');
      return usend('**' + n + '**');
    }
    if (cmd === 'ascii') {
      const text = args.join(' ');
      if (!text) return usend('ascii <text>');
      const ASCII_FONT = 'Graffiti';
      let out = null;
      try {
        const figlet = require('figlet');
        out = await new Promise((res, rej) =>
          figlet.text(
            text,
            {
              font: ASCII_FONT,
              horizontalLayout: 'default',
              verticalLayout: 'default',
              width: 80,
              whitespaceBreak: false,
            },
            (e, r) => (e ? rej(e) : res(r)),
          ),
        );
      } catch {
        const urls = [
          'https://asciified.thelicato.io/api/v2/ascii?font=' +
            encodeURIComponent(ASCII_FONT.toLowerCase()) +
            '&text=' +
            encodeURIComponent(text),
          'https://artii.herokuapp.com/make?font=graffiti&text=' + encodeURIComponent(text),
        ];
        for (const u of urls) {
          try {
            const r = await axios.get(u, {
              timeout: 8000,
            });
            if (r.data && String(r.data).trim()) {
              out = String(r.data);
              break;
            }
          } catch {}
        }
      }
      if (!out) return usend("couldn't generate ascii for this text");
      out = out.replace(/\s+$/, '');
      if (out.length > 1900) out = out.slice(0, 1900);
      const body = '```\n' + out + '\n```';
      try {
        KNULL_COUNTERS.sent++;
        return await ctx.channel.send(body);
      } catch (e) {
        console.error('[ascii]', e.message);
      }
      return;
    }
    if (cmd === 'sreact') {
      if (args.length < 2) return usend('sreact <mesajID|userID> <emoji>  (necesita Nitro)');
      const idOrUser = args[0].replace(/[<@!>]/g, '');
      const emoji = args.slice(1).join(' ');
      try {
        let msg = null;
        try {
          msg = await ctx.channel.messages.fetch(idOrUser);
        } catch {}
        if (!msg) {
          const list = await ctx.channel.messages.fetch({
            limit: 50,
          });
          msg = list.find((m) => m.author?.id === idOrUser);
        }
        if (!msg) return usend("couldn't find message/user");
        await msg.react(emoji, true);
        return usend('sreact aplicat');
      } catch (e) {
        return usend('sreact error: ' + (e.message || '').slice(0, 100));
      }
    }
    if (cmd === 'sreactall' || cmd === 'reactall') {
      if (args.length < 2) return usend(cmd + ' <channelID> <emoji>');
      const chId = args[0];
      const emoji = args.slice(1).join(' ');
      const burst = cmd === 'sreactall';
      try {
        const ch = await ctx.client.channels.fetch(chId);
        if (!ch) return usend('channel not found');
        const list = await ch.messages.fetch({
          limit: 100,
        });
        let ok = 0,
          ko = 0;
        for (const m of list.values()) {
          try {
            await m.react(emoji, burst);
            ok++;
          } catch {
            ko++;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
        return usend('**' + (burst ? 'SREACTALL' : 'REACTALL') + '** — ok: ' + ok + ' | fail: ' + ko);
      } catch (e) {
        return usend('error: ' + (e.message || '').slice(0, 120));
      }
    }
    if (cmd === 'massban') {
      if (!args[0]) return usend('massban <serverID> [motiv]');
      const gid = args[0];
      const reason = args.slice(1).join(' ') || 'massban';
      try {
        const g = await ctx.client.guilds.fetch(gid);
        if (!g) return usend('server negasit');
        const me = await g.members.fetch(ctx.client.user.id).catch(() => null);
        if (!me || !me.permissions.has('BAN_MEMBERS'))
          return usend("you don't have enough perms (ban members is missing)");
        const members = await g.members.fetch();
        let ok = 0,
          ko = 0;
        for (const m of members.values()) {
          if (m.id === ctx.client.user.id || m.id === g.ownerId) continue;
          try {
            await m.ban({
              reason,
            });
            ok++;
          } catch {
            ko++;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        return usend('**MASSBAN ' + g.name + '** — ban: ' + ok + ' | fail: ' + ko);
      } catch (e) {
        return usend('massban error: ' + (e.message || '').slice(0, 120));
      }
    }
    if (cmd === 'nickall') {
      if (args.length < 2) return usend('nickall <serverID> <nick>');
      const gid = args[0];
      const nick = args.slice(1).join(' ').slice(0, 32);
      try {
        const g = await ctx.client.guilds.fetch(gid);
        if (!g) return usend('server negasit');
        const me = await g.members.fetch(ctx.client.user.id).catch(() => null);
        if (!me || !me.permissions.has('MANAGE_NICKNAMES'))
          return usend("you don't have enough perms (manage nicknames is missing)");
        const members = await g.members.fetch();
        let ok = 0,
          ko = 0;
        for (const m of members.values()) {
          try {
            await m.setNickname(nick, 'nickall');
            ok++;
          } catch {
            ko++;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
        return usend(
          '**NICKALL ' + g.name + '** — set: ' + ok + ' | fail: ' + ko + ' | nick: `' + nick + '`',
        );
      } catch (e) {
        return usend('nickall error: ' + (e.message || '').slice(0, 120));
      }
    }
    if (cmd === 'restart') {
      try {
        await ctx.channel.send('**RESTART...**');
      } catch {}
      setTimeout(() => {
        try {
          const args2 = process.argv.slice(1);
          const child = spawn(process.execPath, args2, {
            detached: true,
            stdio: 'inherit',
            env: process.env,
          });
          child.unref();
        } catch (e) {
          console.error('[restart spawn]', e.message);
        }
        process.exit(0);
      }, 800);
      return;
    }
    if (cmd === 'tkuser') {
      if (!activeBots.size) return ctx.channel.send('**no active accounts**').catch(() => {});
      const lines = [];
      for (const [tok, bc] of activeBots) {
        lines.push(
          '**' + (bc.user?.username || bc.user?.tag || 'necunoscut') + ' | ' + (bc.user?.id || '?') + '**',
        );
      }
      try {
        KNULL_COUNTERS.sent++;
        return await ctx.channel.send(lines.join('\n'));
      } catch (e) {
        console.error('[tkuser]', e.message);
        return;
      }
    }
    if (cmd === 'tklist') {
      if (!activeBots.size) return ctx.channel.send('**no active accounts**').catch(() => {});
      const names = [...activeBots.values()].map((bc) => bc.user?.username || bc.user?.tag || 'necunoscut');
      const out = '**TOKENS LIST**\n' + names.map((x) => '\u0060' + x + '\u0060').join('\n');
      try {
        KNULL_COUNTERS.sent++;
        return await ctx.channel.send(out);
      } catch (e) {
        console.error('[tklist]', e.message);
        return;
      }
    }
    if (cmd === 'vusername') {
      if (!args.length) return usend('vusername <username> [username2 ...]');
      const checkUsername = async (raw) => {
        const name = String(raw || '')
          .trim()
          .replace(/^@+/, '')
          .toLowerCase();
        if (!name) return null;
        if (name.length < 2 || name.length > 32) return name + ': invalid (2-32 caractere)';
        if (!/^[a-z0-9._]+$/.test(name)) return name + ': invalid (only a-z 0-9 . _)';
        if (name.includes('..') || /^[._]|[._]$/.test(name))
          return name + ': invalid (puncte/underscore gresite)';
        const UA =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
        const SUPER = Buffer.from(
          JSON.stringify({
            os: 'Windows',
            browser: 'Chrome',
            device: '',
            system_locale: 'en-US',
            browser_user_agent: UA,
            browser_version: '125.0.0.0',
            os_version: '10',
            referrer: '',
            referring_domain: '',
            referrer_current: '',
            referring_domain_current: '',
            release_channel: 'stable',
            client_build_number: 300000,
            client_event_source: null,
          }),
        ).toString('base64');
        const baseHeaders = {
          'Content-Type': 'application/json',
          'User-Agent': UA,
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Discord-Locale': 'en-US',
          'X-Debug-Options': 'bugReporterEnabled',
          'X-Super-Properties': SUPER,
          Origin: 'https://discord.com',
          Referer: 'https://discord.com/channels/@me',
        };
        try {
          const cr = await axios.get('https://discord.com/login', {
            headers: {
              'User-Agent': UA,
              'Accept-Language': 'en-US,en;q=0.9',
              Accept: 'text/html,*/*',
            },
            timeout: 12000,
            validateStatus: () => true,
          });
          const sc = cr.headers?.['set-cookie'] || [];
          const cookie = sc
            .map((c) => String(c).split(';')[0])
            .filter(Boolean)
            .join('; ');
          if (cookie) baseHeaders['Cookie'] = cookie;
        } catch {}
        const bases = [
          'https://discord.com/api/v9',
          'https://canary.discord.com/api/v9',
          'https://ptb.discord.com/api/v9',
        ];
        const routes = [];
        for (const b of bases) {
          if (token)
            routes.push({
              url: b + '/users/@me/pomelo-attempt',
              auth: true,
            });
          routes.push({
            url: b + '/unique-username/username-attempt-unauthed',
            auth: false,
          });
          if (token)
            routes.push({
              url: b + '/unique-username/username-attempt-unauthed',
              auth: true,
            });
        }
        let r = null,
          lastStatus = 0;
        outer: for (const route of routes) {
          for (let i = 0; i < 3; i++) {
            const headers = {
              ...baseHeaders,
            };
            if (route.auth && token) headers.Authorization = token;
            let resp;
            try {
              resp = await axios.post(
                route.url,
                {
                  username: name,
                },
                {
                  headers,
                  timeout: 15000,
                  validateStatus: () => true,
                },
              );
            } catch (e) {
              await new Promise((res) => setTimeout(res, 600));
              continue;
            }
            lastStatus = resp.status;
            if (resp.status === 429) {
              const wait = Math.min(Math.ceil((resp.data?.retry_after || 3) * 1000), 8000);
              await new Promise((res) => setTimeout(res, wait));
              continue;
            }
            if (
              typeof resp.data?.taken === 'boolean' ||
              resp.status === 400 ||
              (resp.status >= 200 && resp.status < 300)
            ) {
              r = resp;
              break outer;
            }
            if (resp.status === 403 && i < 2) {
              await new Promise((res) => setTimeout(res, 900));
              continue;
            }
            break;
          }
        }
        if (!r) {
          if (lastStatus === 429) return name + ': rate limit (incearca peste cateva secunde)';
          if (lastStatus === 401) return name + ': token invalid/expirat';
          if (lastStatus === 403)
            return name + ': blocked on all routes (use a valid token with login to be sure)';
          return name + ': http error ' + (lastStatus || '?');
        }
        const d = r.data || {};
        if (typeof d.taken === 'boolean') return name + ': ' + (d.taken ? 'taken' : 'valid');
        if (r.status === 400) {
          const errs = d.errors?.username?._errors;
          const msg = (Array.isArray(errs) && errs[0]?.message) || d.message || '';
          if (/taken|already|unavailable/i.test(msg)) return name + ': taken';
          return name + ': invalid' + (msg ? ' (' + String(msg).slice(0, 60) + ')' : '');
        }
        return name + ': http error ' + r.status;
      };
      try {
        const list = args.slice(0, 10);
        const out = [];
        for (const u of list) {
          const line = await checkUsername(u);
          if (line) out.push(line);
          if (list.length > 1) await new Promise((res) => setTimeout(res, 600));
        }
        if (!out.length) return usend('vusername <username> [username2 ...]');
        return usend(out.join('\n'));
      } catch (e) {
        return usend('error: ' + String(e.message || e).slice(0, 80));
      }
    }
    if (cmd === 'vtoken' || cmd === 'login') {
      if (!args.length) return usend(cmd + ' <token>');
      const tk = args[0].trim();
      let me = null;
      try {
        const r = await axios.get(api('/users/@me'), {
          headers: {
            Authorization: tk,
          },
          validateStatus: () => true,
        });
        if (r.status === 200) me = r.data;
      } catch {}
      if (!me) return usend('token invalid');
      if (cmd === 'vtoken')
        return usend(
          'valid: ' +
            (me.username + (me.discriminator && me.discriminator !== '0' ? '#' + me.discriminator : '')) +
            ' | id ' +
            me.id +
            ' | email ' +
            (me.email || '-') +
            ' | 2fa ' +
            (me.mfa_enabled ? 'da' : 'nu'),
        );
      if (activeBots.has(tk)) return;
      let li = null;
      if (args[1] !== undefined) {
        const n = parseInt(args[1], 10);
        if (!(n >= 2 && n <= 20)) return usend('index invalid (2-20)');
        if (botIndexes.has(n)) return usend('indexul ' + n + ' is already in use');
        li = n;
      }
      const useIdx = li || nextFreeIndex();
      if (!useIdx) return usend('toate indexurile sunt ocupate');
      try {
        createBot(tk, {
          index: useIdx,
          commands: li === null,
        });
        rememberToken(tk, useIdx, li === null);
      } catch (e) {
        console.error('[login]', e.message);
      }
      return usend(
        'account started on index ' +
          useIdx +
          (li === null ? ' (acces comenzi)' : ' (no access to commands)'),
      );
    }
    if (cmd === 'addspecial') {
      const id = (args[0] || '').replace(/\D/g, '');
      if (!id) return usend('addspecial <user_id>');
      specialUsers.add(id);
      persistUtil();
      return usend('adaugat special: ' + id + ' (total ' + specialUsers.size + ')');
    }
    if (cmd === 'removespecial') {
      const id = (args[0] || '').replace(/\D/g, '');
      if (!specialUsers.has(id)) return usend('the user is not on the list');
      specialUsers.delete(id);
      persistUtil();
      return usend('sters special: ' + id);
    }
    if (cmd === 'showspecial') {
      if (!specialUsers.size) return usend('special list is empty');
      return usend([...specialUsers].map((id, i) => i + 1 + '. ' + id).join('\n'));
    }
    if (cmd === 'lachiti') {
      const sub = (args[0] || '').toLowerCase();
      const rawSend = async (t) => {
        try {
          KNULL_COUNTERS.sent++;
          return await ctx.channel.send(t);
        } catch (e) {
          console.error('[lachiti send]', e.message);
        }
      };
      if (sub === 'add') {
        if (args.length < 3) return usend('lachiti add <nume> <user_id/@user>');
        const idRaw = args[args.length - 1];
        const id = String(idRaw).replace(/\D/g, '');
        if (!id) return usend('id invalid');
        const name = args.slice(1, -1).join(' ').trim() || 'necunoscut';
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const time =
          pad(now.getHours()) +
          ':' +
          pad(now.getMinutes()) +
          ':' +
          pad(now.getSeconds()) +
          ' ' +
          pad(now.getDate()) +
          '/' +
          pad(now.getMonth() + 1) +
          '/' +
          now.getFullYear();
        lachitiList = lachitiList.filter((e) => e.id !== id);
        lachitiList.push({
          name,
          id,
          time,
        });
        persistUtil();
        return usend('adaugat in lachiti: ' + name + ' (' + id + ')');
      }
      if (sub === 'remove' || sub === 'rm' || sub === 'del') {
        const id = (args[1] || '').replace(/\D/g, '');
        if (!id) return usend('lachiti remove <user_id>');
        const before = lachitiList.length;
        lachitiList = lachitiList.filter((e) => e.id !== id);
        if (lachitiList.length === before) return usend('not on the list');
        persistUtil();
        return usend('removed from lachiti: ' + id);
      }
      if (sub === 'clear') {
        lachitiList = [];
        persistUtil();
        return usend('lachiti list golita');
      }
      if (!lachitiList.length) return rawSend('** LACHITI LIST **\n`list is empty`');
      const lines = lachitiList.map((e) => '`' + e.name + ' , ' + e.id + ' , ' + e.time + '`').join('\n');
      return rawSend('** LACHITI LIST **\n' + lines);
    }
    if (cmd === 'dmall') {
      const text = args.join(' ').trim();
      if (!text) return usend('dmall <text>');
      const dms = [...botClient.channels.cache.values()].filter(
        (c) => c && (c.type === 'DM' || c.type === 1 || c.constructor?.name === 'DMChannel'),
      );
      if (!dms.length) return usend('i have no open dms in cache');
      await usend('sending to ' + dms.length + ' dm-uri...');
      let ok = 0,
        fail = 0;
      for (const dm of dms) {
        try {
          await dm.send(text);
          ok++;
          KNULL_COUNTERS.sent++;
        } catch (e) {
          fail++;
        }
        await new Promise((r) => setTimeout(r, 900));
      }
      return usend('dmall done: ' + ok + ' trimise, ' + fail + ' esuate');
    }
    if (cmd === 'admin') {
      try {
        KNULL_COUNTERS.sent++;
        markPendingSelfText('admin `Finesse`');
        return markSelfOutput(await ctx.channel.send('admin `Finesse`'));
      } catch (e) {
        console.error('[admin]', e.message);
      }
      return;
    }
    if (cmd === 'nuke') {
      const guild = ctx.guild;
      if (!guild) return usend('nuke only works on servers, not in dms');
      let meMember = guild.members.cache.get(botClient.user.id);
      if (!meMember) {
        try {
          meMember = await guild.members.fetch(botClient.user.id);
        } catch {}
      }
      const perms = meMember && meMember.permissions;
      const hasPerm =
        perms && (perms.has('ADMINISTRATOR') || (perms.has('MANAGE_CHANNELS') && perms.has('MANAGE_GUILD')));
      if (!hasPerm) return usend("you don't have high enough perms on this server, can't nuke");
      const gname = guild.name;
      await usend('nuke started on ' + gname);
      const chans = [...guild.channels.cache.values()];
      await Promise.all(chans.map((c) => c.delete('nuke').catch(() => {})));
      const rawName = 'naduf owns ' + gname;
      const textSafe =
        rawName
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 90) || 'naduf-owns';
      const voiceSafe = rawName.slice(0, 90);
      const created = [];
      for (let i = 0; i < 10; i++) {
        try {
          const tc = await guild.channels.create(textSafe, {
            type: 'GUILD_TEXT',
          });
          created.push(tc);
        } catch (e) {
          console.error('[nuke text]', e.message);
        }
        try {
          await guild.channels.create(voiceSafe, {
            type: 'GUILD_VOICE',
          });
        } catch (e) {
          console.error('[nuke voice]', e.message);
        }
      }
      const spamText = 'naduf owns @everyone';
      await Promise.all(
        created.map(async (tc) => {
          for (let i = 0; i < 99; i++) {
            try {
              await tc.send(spamText);
            } catch {}
          }
        }),
      );
      try {
        await guild.setName('nuked by naduf');
      } catch (e) {
        console.error('[nuke name]', e.message);
      }
      try {
        await guild.setDescription('server nuked by naduf');
      } catch (e) {
        console.error('[nuke desc]', e.message);
      }
      let rolesDeleted = 0;
      try {
        const roles = await guild.roles.fetch();
        const myTop =
          guild.ownerId === botClient.user.id ? 9999 : meMember?.roles?.highest?.position || 0;
        for (const [, role] of roles) {
          if (role.id === guild.id || role.managed) continue;
          if (role.position >= myTop) continue;
          try {
            await role.delete('nuke');
            rolesDeleted++;
          } catch {}
          await sleep(200);
        }
      } catch (e) {
        console.error('[nuke roles del]', e.message);
      }
      const NUKE_COLORS = [
        0xff0000, 0xff5500, 0xffaa00, 0xffff00, 0xaaff00, 0x00ff00, 0x00ffaa, 0x00ffff, 0x00aaff,
        0x0000ff, 0x5500ff, 0xaa00ff, 0xff00ff, 0xff00aa, 0xffffff, 0xff3399, 0x33ff99, 0x9933ff,
        0xff9933, 0x33ccff,
      ];
      let rolesCreated = 0;
      for (let i = 0; i < 60; i++) {
        try {
          await guild.roles.create({
            name: 'naduf',
            color: NUKE_COLORS[i % NUKE_COLORS.length],
            reason: 'nuke',
          });
          rolesCreated++;
        } catch (e) {
          console.error('[nuke role]', e.message);
          break;
        }
        await sleep(250);
      }
      await usend('nuke done | roluri sterse: ' + rolesDeleted + ' | roluri create: ' + rolesCreated);
      return;
    }
    if (cmd === 'hypesquad') {
      const houses = {
        bravery: 1,
        brilliance: 2,
        balance: 3,
      };
      const opt = (args[0] || '').toLowerCase();
      if (!opt || (!houses[opt] && opt !== 'remove'))
        return usend('hypesquad <bravery/brilliance/balance/remove>');
      try {
        if (opt === 'remove') {
          const r = await axios.delete(api('/hypesquad/online'), {
            headers: {
              Authorization: token,
            },
            validateStatus: () => true,
          });
          return usend(r.status < 300 ? 'hypesquad sters' : 'esuat (' + r.status + ')');
        }
        const r = await axios.post(
          api('/hypesquad/online'),
          {
            house_id: houses[opt],
          },
          {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json',
            },
            validateStatus: () => true,
          },
        );
        return usend(r.status < 300 ? 'hypesquad setat: ' + opt : 'esuat (' + r.status + ')');
      } catch (e) {
        return usend('error: ' + e.message.slice(0, 80));
      }
    }
    if (cmd === 'startscript') {
      let file = args[0];
      try {
        const att = ctx.attachments?.first?.();
        if (att && /\.py$/i.test(att.name || '')) {
          const resp = await axios.get(att.url, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          fs.writeFileSync(path.join(__dirname, att.name), Buffer.from(resp.data));
          file = att.name;
        }
      } catch (e) {
        return usend("couldn't save the file: " + e.message.slice(0, 60));
      }
      if (!file) return usend('startscript <filename.py> (or send the file along with the command)');
      const full = path.join(__dirname, file);
      if (!fs.existsSync(full)) return usend("file doesn't exist: " + file);
      if (runningScripts.has(file)) return usend('the script is already running');
      try {
        const proc = spawn('python3', [full], {
          cwd: __dirname,
        });
        runningScripts.set(file, proc);
        proc.stdout?.on('data', (d) => console.log('[' + file + ']', String(d).trim().slice(0, 200)));
        proc.stderr?.on('data', (d) => console.error('[' + file + ']', String(d).trim().slice(0, 200)));
        proc.on('exit', (code) => {
          runningScripts.delete(file);
          console.log('[' + file + '] stopped with code ' + code);
        });
        return usend('started: ' + file + ' (pid ' + proc.pid + ')');
      } catch (e) {
        return usend('startup error: ' + e.message.slice(0, 80));
      }
    }
    if (cmd === 'stopscript') {
      const file = args[0];
      if (!file) return usend('stopscript <filename.py>');
      const proc = runningScripts.get(file);
      if (!proc) return usend('the script is not running');
      try {
        proc.kill('SIGKILL');
      } catch {}
      runningScripts.delete(file);
      return usend('stopped: ' + file);
    }
    if (cmd === 'scriptstatus') {
      if (!runningScripts.size) return usend('no active scripts');
      return usend([...runningScripts.entries()].map(([f, p]) => f + ' | pid ' + p.pid).join('\n'));
    }
    if (cmd === 'stopscriptall') {
      const n = runningScripts.size;
      for (const [, p] of runningScripts) {
        try {
          p.kill('SIGKILL');
        } catch {}
      }
      runningScripts.clear();
      return usend('oprite ' + n + ' scripturi');
    }
    if (cmd === 'antigc') {
      const opt = (args[0] || '').toLowerCase();
      if (opt !== 'on' && opt !== 'off') return usend('antigc <on/off>');
      antiGc = opt === 'on';
      persistUtil();
      return usend('antigc ' + (antiGc ? 'pornit' : 'oprit'));
    }
    if (cmd === 'antitag') {
      const opt = (args[0] || '').toLowerCase();
      if (opt !== 'on' && opt !== 'off')
        return usend('antitag <on/off> [channel_id/server_id] [file.txt] [text]');
      if (opt === 'off') {
        antiTag.on = false;
        persistUtil();
        return usend('antitag stopped');
      }
      const rest = args.slice(1);
      let scope = null;
      if (rest[0] && /^\d{5,}$/.test(rest[0])) scope = rest.shift();
      let lines = [];
      if (rest[0] && rest[0].endsWith('.txt')) {
        const f = path.join(ARHIVA_DIR, rest[0]);
        const f2 = path.join(__dirname, rest.shift());
        const use = fs.existsSync(f) ? f : f2;
        if (!fs.existsSync(use)) return usend("file doesn't exist");
        lines = fs
          .readFileSync(use, 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
      }
      const text = rest.join(' ').trim();
      if (!lines.length && !text) return usend('give a .txt file or text to reply with');
      antiTag.on = true;
      antiTag.scope = scope;
      antiTag.lines = lines;
      antiTag.text = text;
      persistUtil();
      return usend('antitag on | scope: ' + (scope || 'tot') + ' | raspunsuri: ' + (lines.length || 1));
    }
    if (cmd === 'antitagshow') {
      if (!antiTag.on) return usend('antitag is off');
      const pool = antiTag.lines.length ? antiTag.lines : antiTag.text ? [antiTag.text] : [];
      return usend(
        'antitag on\nscope: ' +
          (antiTag.scope || 'tot') +
          '\nraspunsuri (' +
          pool.length +
          '):\n' +
          pool.slice(0, 15).join('\n'),
      );
    }
  }
  async function handleDollar(message, cmd, args) {
    const ctx = message;
    if (cmd === 'stealnotepad') {
      if (stealState.active) {
        await ctx.channel.send('-# a capture is already running; use stopsteal');
        return;
      }
      if (!args.length) {
        await ctx.channel.send(
          '-# stealnotepad <id1> <id2> ... <channel_id> [nume fisier]  |  stealnotepad <channel_id>',
        );
        return;
      }
      const userIds = [];
      let sourceChan = null;
      const nameParts = [];
      for (const raw of args) {
        const mention = String(raw).match(/^<@!?(\d{15,25})>$/);
        if (mention) {
          if (!userIds.includes(mention[1])) userIds.push(mention[1]);
          continue;
        }
        const chanMention = String(raw).match(/^<#(\d{15,25})>$/);
        if (chanMention) {
          const c =
            botClient.channels.cache.get(chanMention[1]) ||
            (await botClient.channels.fetch(chanMention[1]).catch(() => null));
          if (c) {
            sourceChan = c;
            continue;
          }
        }
        if (/^\d{15,25}$/.test(String(raw))) {
          if (!sourceChan) {
            const c =
              botClient.channels.cache.get(raw) || (await botClient.channels.fetch(raw).catch(() => null));
            if (c && typeof c.send === 'function' && !c.recipient) {
              sourceChan = c;
              continue;
            }
          }
          if (!userIds.includes(String(raw))) userIds.push(String(raw));
          continue;
        }
        nameParts.push(String(raw));
      }
      const fileName = nameParts.join(' ').trim() || null;
      if (!userIds.length && !sourceChan) {
        await ctx.channel.send('-# no valid id found');
        return;
      }
      stealState.active = true;
      stealState.sourceChannelId = sourceChan ? sourceChan.id : null;
      stealState.targets = new Set(userIds);
      stealState.anyUser = userIds.length === 0;
      stealState.outputChannel = ctx.channel;
      stealState.byUser = new Map();
      stealState.names = new Map();
      stealState.seen = new Set();
      stealState.fileName = fileName;
      stealState.startedAt = Date.now();
      for (const id of userIds) {
        const u = await botClient.users.fetch(id).catch(() => null);
        if (u) stealState.names.set(id, u.username || id);
      }
      stealIdleReset();
      saveSession();
      const who = stealState.anyUser
        ? 'toti userii'
        : [...stealState.targets].map((id) => stealState.names.get(id) || id).join(', ');
      await ctx.channel.send(
        '-# steal started for ' +
          who +
          (sourceChan ? ' in <#' + sourceChan.id + '>' : ' (toate canalele)') +
          (fileName ? ' | fisier: ' + stealFileName() : '') +
          ' | auto-stopping after 1h of inactivity',
      );
      return;
    }
    if (cmd === 'stopsteal') {
      if (!stealState.active) {
        await ctx.channel.send('-# no capture is running');
        return;
      }
      await finishSteal('manual');
      return;
    }
    if (cmd === 'ytmconnect' || cmd === 'ytm' || cmd === 'spotifyconnect') {
      const link = ytmPublicUrl() + '/ytm/script.user.js?key=' + getYtmKey();
      await ctx.channel.send(
        '**YouTube Music presence**\n1. install Tampermonkey (PC: Chrome/Edge/Firefox, phone: Kiwi/Firefox Android or Safari with Userscripts)\n2. open the link and press Install:\n' +
          link +
          "\n3. open music.youtube.com and start a song — it'll show up on your profile immediately",
      );
      return;
    }
    if (cmd === 'ytmstatus' || cmd === 'spotifystatus') {
      const on = ytmState.last && Date.now() - ytmState.last < 15000;
      await ctx.channel.send(
        on
          ? ytmState.playing
            ? `-# YouTube Music activ: ${ytmState.title} — ${ytmState.artist}`
            : '-# YouTube Music connected, nothing is playing'
          : "-# YouTube Music isn't sending data; use ytmconnect",
      );
      return;
    }
    if (cmd === 'ytmapp' || cmd === 'lastfm') {
      const u = (args[0] || '').trim();
      if (!process.env.LASTFM_API_KEY) {
        await ctx.channel.send('-# put LASTFM_API_KEY in the hosting settings (last.fm/api/account/create)');
        return;
      }
      if (!u) {
        await ctx.channel.send('-# foloseste: ytmapp <username last.fm>');
        return;
      }
      try {
        fs.writeFileSync(LASTFM_FILE, u);
      } catch {}
      startLastfm();
      await ctx.channel.send('-# aplicatia YouTube Music conectata prin Last.fm: ' + u);
      return;
    }
    if (cmd === 'stopytm' || cmd === 'stopspotify') {
      stopLastfm();
      try {
        fs.unlinkSync(LASTFM_FILE);
      } catch {}
      await ytmClear();
      stopSpotifySync();
      ytmState.last = 0;
      await ctx.channel.send(
        "-# YouTube Music status cleared (it'll come back when the browser sends data again)",
      );
      return;
    }
    if (cmd === 'spotifyconnect_old') {
      const url = spotifyConnectUrl();
      if (!url) {
        await ctx.channel.send('-# set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI');
        return;
      }
      await ctx.channel.send('-# connect Spotify from the official link (valid for 10 minutes):\n' + url);
      return;
    }
    if (cmd === 'spotifystatus') {
      const auth = loadSpotifyAuth();
      await ctx.channel.send(
        auth.refresh_token
          ? '-# Spotify connected; sync is active'
          : "-# Spotify isn't connected; use spotifyconnect",
      );
      return;
    }
    if (cmd === 'stopspotify') {
      stopSpotifySync();
      clearTimedActivity();
      try {
        await botClient.user.setPresence({
          activities: [],
          status: desiredStatus,
        });
      } catch {}
      await ctx.channel.send('-# sincronizare Spotify oprita');
      return;
    }
    function stripCmdPrefix(text) {
      if (typeof text !== 'string' || !text) return text;
      return text.replace(/(^|[\s\n(\[<])[$=!]([a-zA-Z][a-zA-Z0-9_]{1,24})\b/g, '$1$2');
    }
    function fmtReply(content) {
      if (typeof content !== 'string' || !content.trim()) return content;
      content = stripCmdPrefix(content);
      if (content.startsWith('-# ')) return content;
      return '-# ' + content.split('\n').join('\n-# ');
    }
    async function safeSend(channel, content, opts) {
      if (!channel) return;
      try {
        KNULL_COUNTERS.sent++;
        let msg;
        if (opts)
          msg = await channel.send({
            content: fmtReply(content),
            ...opts,
          });
        else if (!content || (typeof content === 'string' && !content.trim())) return;
        else msg = await channel.send(fmtReply(content));
        return msg;
      } catch (e) {
        console.error('[safeSend $]', e.message?.slice(0, 80));
      }
    }
    async function resolveChan(id) {
      try {
        return botClient.channels.cache.get(id) || (await botClient.channels.fetch(id));
      } catch {
        return null;
      }
    }
    function loopPickText(arr, entry) {
      if (!arr.length) return null;
      const t = arr[entry.index % arr.length];
      entry.index++;
      return t;
    }
    if (cmd === 'delayloop' || cmd === 'customloop') {
      const kind = cmd === 'delayloop' ? 'delay' : 'custom';
      if (!args.length) {
        await safeSend(ctx.channel, cmd + ' [channelID] [seconds] [optional text]');
        return;
      }
      const channelId = args[0].replace(/\D/g, '');
      const chan = await resolveChan(channelId);
      if (!chan || !chan.send) {
        await safeSend(ctx.channel, 'invalid channel');
        return;
      }
      let sec = 5;
      let rest = args.slice(1);
      if (rest.length && parseDelaySec(rest[0], 3600) !== null) {
        sec = parseDelaySec(rest[0], 3600);
        rest = rest.slice(1);
      }
      const fixed = rest.join(' ').trim();
      const existingLoop = [...LOOPS[kind].values()].find((e) => e.channelId === String(channelId));
      if (existingLoop && !fixed && args.length >= 2) {
        existingLoop.sec = sec;
        wakeDelays();
        await safeSend(ctx.channel, kind + ' loop <#' + channelId + '> delay: ' + sec + 's');
        return;
      }
      const pool = kind === 'delay' ? spamPhrases : [];
      if (!fixed && !pool.length) {
        await safeSend(ctx.channel, 'no text: provide some in the command or upload a notepad file');
        return;
      }
      const entry = loopAdd(kind, channelId, {
        index: 0,
        sec,
        text: fixed,
      });
      entry.interval = liveLoop(
        () => entry.sec,
        () => entry.stopped,
        async () => {
          if (entry.stopped) return;
          const arr = spamPhrases;
          const txt = fixed || loopPickText(arr, entry);
          if (!txt) return;
          try {
            KNULL_COUNTERS.sent++;
            await chan.send(txt);
          } catch (e) {
            console.error('[loop ' + kind + ']', e.message?.slice(0, 80));
          }
        },
      );
      await safeSend(ctx.channel, kind + ' loop started in <#' + channelId + '> at ' + sec + 's');
      return;
    }
    if (cmd === 'stopdelayloop' || cmd === 'stopcustomloop') {
      const kind = cmd === 'stopdelayloop' ? 'delay' : 'custom';
      const channelId = args[0] ? args[0].replace(/\D/g, '') : null;
      const n = loopStopChannel(kind, channelId);
      await safeSend(ctx.channel, n ? kind + ' loop stopped (' + n + ')' : 'no ' + kind + ' loop activ');
      return;
    }
    if (cmd === 'stopallloops') {
      const n = loopStopAll();
      await safeSend(ctx.channel, 'toate loop-urile oprite (' + n + ')');
      return;
    }
    if (cmd === 'loopinfo') {
      try {
        await ctx.channel.send(renderRunStatus());
      } catch {}
      return;
    }
    if (cmd === 'pic') {
      if (!args.length) {
        await safeSend(ctx.channel, 'pic [text]');
        return;
      }
      const customText = args.join(' ').trim();
      try {
        const buffer = await generatePicImage(customText);
        await ctx.channel.send({
          files: [new MessageAttachment(buffer, 'image.png')],
        });
      } catch (err) {
        console.error('[pic] generation error:', err);
        await safeSend(ctx.channel, `image generation error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'tts') {
      if (!args.length) {
        await safeSend(ctx.channel, 'tts [text]');
        return;
      }
      let text = args.join(' ');
      let lang = 'ro';
      if (args.length >= 2 && /^[a-z]{2}$/.test(args[0])) {
        lang = args[0];
        text = args.slice(1).join(' ');
      }
      if (text.length > 200) {
        await safeSend(ctx.channel, 'textul e prea lung (max 200 caractere)');
        return;
      }
      try {
        const os = require('os');
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&ttsspeed=1`;
        const resp = await axios.get(ttsUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
        fs.writeFileSync(tmpFile, Buffer.from(resp.data));
        await ctx.channel.send({
          files: [new MessageAttachment(tmpFile, 'tts.mp3')],
        });
        fs.unlinkSync(tmpFile);
      } catch (err) {
        await safeSend(ctx.channel, `tts error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'reply') {
      if (!args.length) {
        await safeSend(ctx.channel, 'reply [userID/@user] — adauga un target (max 10)');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (replyState.targets.includes(user.id)) {
        await safeSend(ctx.channel, `${user.username} already on the reply list`);
        return;
      }
      if (replyState.targets.length >= 10) {
        await safeSend(ctx.channel, "you've reached the 10 target limit, delete some with stopreply [id]");
        return;
      }
      replyState.running = true;
      replyState.targets.push(user.id);
      saveSession();
      await safeSend(
        ctx.channel,
        `reply adaugat: ${user.username} (${replyState.targets.length}/10 targeti activi)`,
      );
      return;
    }
    if (cmd === 'stopreply') {
      if (!args.length) {
        replyState.running = false;
        replyState.targets = [];
        replyState.lastReplyTime = {};
        saveSession();
        await safeSend(ctx.channel, 'reply stopped for everyone');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      const idx = replyState.targets.indexOf(user.id);
      if (idx === -1) {
        await safeSend(ctx.channel, `${user.username} isn't on the reply list`);
        return;
      }
      replyState.targets.splice(idx, 1);
      delete replyState.lastReplyTime[user.id];
      delete replyState.replyDelays[user.id];
      if (replyState.targets.length === 0) replyState.running = false;
      saveSession();
      await safeSend(ctx.channel, `reply stopped: ${user.username} (${replyState.targets.length} ramasi)`);
      return;
    }
    if (cmd === 'reai') {
      if (!args.length) {
        await safeSend(ctx.channel, 'reai [userID/@user] — add an AI target (max 10)');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (aiState.targets.includes(user.id)) {
        await safeSend(ctx.channel, `${user.username} already on the ai reply list`);
        return;
      }
      if (aiState.targets.length >= 10) {
        await safeSend(ctx.channel, 'limita de 10 targeti atinsa');
        return;
      }
      aiState.running = true;
      aiState.targets.push(user.id);
      if (!aiState.history[user.id]) aiState.history[user.id] = [];
      await safeSend(ctx.channel, `ai reply activated: ${user.username} (${aiState.targets.length}/10)`);
      return;
    }
    if (cmd === 'stopreai') {
      if (!args.length) {
        aiState.running = false;
        aiState.targets = [];
        aiState.history = {};
        await safeSend(ctx.channel, 'ai reply stopped for everyone');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      const idx = aiState.targets.indexOf(user.id);
      if (idx === -1) {
        await safeSend(ctx.channel, `${user.username} isn't on the ai reply list`);
        return;
      }
      aiState.targets.splice(idx, 1);
      delete aiState.history[user.id];
      delete aiState.lastReplyTime[user.id];
      if (aiState.targets.length === 0) aiState.running = false;
      await safeSend(ctx.channel, `ai reply stopped for ${user.username}`);
      return;
    }
    if (cmd === 'replygap') {
      const sv = parseDelaySec(args[0], 60);
      if (sv === null) {
        await safeSend(ctx.channel, `replygap [0-60] — pause after each reply, currently: ${replyGap}s`);
        return;
      }
      replyGap = sv;
      await safeSend(ctx.channel, `pauza intre reply-uri: ${sv}s`);
      return;
    }
    if (cmd === 'delayreply' || cmd === 'replydelay') {
      if (!args.length) {
        await safeSend(
          ctx.channel,
          'replydelay [secunde] — delay global\nreplydelay [userID/@user] [secunde] — delay per persoana',
        );
        return;
      }
      if (args.length >= 2 && /^\d+$/.test(args[1])) {
        const user = await parseUser(args[0]);
        if (user) {
          {
            const sv = parseDelaySec(args[1]);
            if (sv === null) {
              await safeSend(ctx.channel, 'replydelay [userID/@user] [0-50]');
              return;
            }
            replyState.replyDelays[user.id] = sv;
            wakeDelays();
          }
          await safeSend(ctx.channel, `delay reply for ${user.username}: ${args[1]}s`);
          return;
        }
      }
      if (parseDelaySec(args[0]) === null) {
        await safeSend(ctx.channel, 'replydelay [0-50]');
        return;
      }
      replyDelay = parseDelaySec(args[0]);
      wakeDelays();
      await safeSend(ctx.channel, `delay reply global: ${replyDelay}s`);
      return;
    }
    if (cmd === 'customreply' || cmd === 'customspam') {
      if (args.length < 2) {
        await ctx.channel
          .send('customreply [userID/@user] [text]\nstopcustomreply [userID]\nlistcustomreply')
          .catch(() => {});
        return;
      }
      const crRaw = args[0];
      const crMention = crRaw.match(/<@!?(\d+)>/);
      const crId = crMention ? crMention[1] : crRaw.replace(/\D/g, '');
      if (!crId || crId.length < 17) return;
      const crText = args.slice(1).join(' ');
      customReplyState[crId] = {
        text: crText,
        cycle: 1,
      };
      console.log('[customreply] set for', crId, ':', crText.slice(0, 60));
      return;
    }
    if (cmd === 'stopcustomreply' || cmd === 'stopcustomspam') {
      if (!args.length) {
        await ctx.channel.send('stopcustomreply [userID]').catch(() => {});
        return;
      }
      const srRaw = args[0];
      const srMention = srRaw.match(/<@!?(\d+)>/);
      const srId = srMention ? srMention[1] : srRaw.replace(/\D/g, '');
      if (!customReplyState[srId]) return;
      delete customReplyState[srId];
      console.log('[customreply] stopped for', srId);
      return;
    }
    if (cmd === 'listcustomreply' || cmd === 'listcustomspam') {
      const lrKeys = Object.keys(customReplyState);
      if (!lrKeys.length) {
        await ctx.channel.send('no active customreply').catch(() => {});
        return;
      }
      const lrLines = lrKeys.map((uid) => `<@${uid}>: ${(customReplyState[uid].text || '').slice(0, 80)}`);
      await ctx.channel.send('CUSTOMREPLY ACTIV:\n' + lrLines.join('\n')).catch(() => {});
      return;
    }
    if (cmd === 'start' && args[0] === 'spiced') {
      const user = await parseUser(args[1]);
      if (!user) {
        await safeSend(ctx.channel, 'start spiced @user');
        return;
      }
      if (spamState.running) {
        await safeSend(ctx.channel, 'spam already active');
        return;
      }
      if (!spamPhrases.length) {
        await safeSend(ctx.channel, 'notepad spam is empty, add some with addnotepadspam');
        return;
      }
      spamState.running = true;
      spamState.type = 'spiced';
      spamState.target = user.id;
      spamState.phraseIndex = 0;
      spamState.channelId = ctx.channel.id;
      spamState.startedAt = Date.now();
      if (spamState.interval) clearLive(spamState.interval);
      spamState.interval = liveLoop(
        () => spamDelay,
        () => !spamState.running,
        async () => {
          if (!spamState.running) {
            clearLive(spamState.interval);
            spamState.interval = null;
            return;
          }
          if (spamState.phraseIndex >= spamPhrases.length) spamState.phraseIndex = 0;
          const p = spamPhrases[spamState.phraseIndex++];
          if (p?.trim()) {
            try {
              await ctx.channel.sendTyping();
              await ctx.channel.send(`<@${spamState.target}>\n${p}`);
            } catch {}
          }
        },
      );
      await safeSend(ctx.channel, `spam started: ${user.username} (${spamDelay}s)`);
      return;
    }
    if (cmd === 'stop' && args[0] === 'spiced') {
      if (!spamState.running) {
        await safeSend(ctx.channel, "spam isn't running");
        return;
      }
      spamState.running = false;
      spamState.type = null;
      spamState.target = null;
      spamState.phraseIndex = 0;
      spamState.channelId = null;
      spamState.startedAt = 0;
      if (spamState.interval) {
        clearLive(spamState.interval);
        spamState.interval = null;
      }
      await safeSend(ctx.channel, 'spam stopped');
      return;
    }
    if (cmd === 'startchannel') {
      if (!args.length) {
        await safeSend(ctx.channel, 'startchannel [canalID] [@user1 ...]');
        return;
      }
      const channelId = args[0].replace(/[<#>]/g, '');
      const targetUsers = await parseUsers(args.slice(1));
      if (args.length > 1 && !targetUsers.length) {
        await safeSend(ctx.channel, 'no valid user');
        return;
      }
      const channel =
        botClient.channels.cache.get(channelId) ||
        (await botClient.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        await safeSend(ctx.channel, 'invalid channel');
        return;
      }
      if (!spamPhrases.length) {
        await safeSend(ctx.channel, 'notepad spam gol');
        return;
      }
      const entry = loopAdd('channel', channelId, {
        targets: targetUsers.map((u) => u.id),
        idx: 0,
        label: 'startchannel',
      });
      const tick = async () => {
        if (entry.stopped) return;
        if (spamPhrases.length) {
          if (entry.idx >= spamPhrases.length) entry.idx = 0;
          const p = spamPhrases[entry.idx++];
          if (p?.trim()) {
            try {
              const ch =
                botClient.channels.cache.get(entry.channelId) ||
                (await botClient.channels.fetch(entry.channelId).catch(() => null));
              if (ch) {
                await ch.sendTyping().catch(() => {});
                const mentions = entry.targets.map((t) => `<@${t}>`).join(' ');
                if (mentions) await ch.send(`${mentions}\n${p}`);
                else await ch.send({ content: p, allowedMentions: { parse: [] } });
                KNULL_COUNTERS.sent++;
              }
            } catch {}
          }
        }
      };
      entry.interval = liveLoop(
        () => channelDelay,
        () => entry.stopped,
        tick,
      );
      await safeSend(
        ctx.channel,
        `channel spam on <#${channelId}> (${channelDelay}s) • active: ${LOOPS.channel.size}`,
      );
      return;
    }
    if (cmd === 'stopchannel') {
      const n = loopStopChannel('channel', args[0] && args[0] !== 'all' ? args[0] : null);
      await safeSend(ctx.channel, n ? `channel spam off (${n})` : "spam isn't running");
      return;
    }
    if (cmd === 'startrepeat') {
      if (!args.length) {
        await safeSend(ctx.channel, 'startrepeat [canalID] [@user] [text]');
        return;
      }
      const channelId = args[0].replace(/[<#>]/g, '');
      const hasTarget = /^<@!?\d+>$/.test(args[1] || '') || /^\d{17,20}$/.test(args[1] || '');
      const user = hasTarget ? await parseUser(args[1]) : null;
      const text = args.slice(hasTarget ? 2 : 1).join(' ').trim();
      if (hasTarget && !user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (!text && !spamPhrases.length) {
        await safeSend(ctx.channel, 'notepad spam gol, adauga texte cu addnotepadspam');
        return;
      }
      const channel =
        botClient.channels.cache.get(channelId) ||
        (await botClient.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        await safeSend(ctx.channel, 'invalid channel');
        return;
      }
      const entry = loopAdd('repeat', channelId, {
        target: user ? user.id : null,
        text,
        index: 0,
        label: 'startrepeat',
      });
      const tick = async () => {
        if (entry.stopped) return;
        try {
          const ch =
            botClient.channels.cache.get(entry.channelId) ||
            (await botClient.channels.fetch(entry.channelId).catch(() => null));
          if (ch) {
            const phrase = entry.text || loopPickText(spamPhrases, entry);
            if (!phrase?.trim()) return;
            if (entry.target) await ch.send(`<@${entry.target}> ${phrase}`);
            else await ch.send({ content: phrase, allowedMentions: { parse: [] } });
            KNULL_COUNTERS.sent++;
          }
        } catch {}
      };
      entry.interval = liveLoop(
        () => globalDelay,
        () => entry.stopped,
        tick,
      );
      await safeSend(
        ctx.channel,
        `repeat on <#${channelId}>: ${user ? user.username : 'fara ping'} (${globalDelay}s) • active: ${LOOPS.repeat.size}`,
      );
      return;
    }
    if (cmd === 'stoprepeat') {
      const n = loopStopChannel('repeat', args[0] && args[0] !== 'all' ? args[0] : null);
      await safeSend(ctx.channel, n ? `repeat off (${n})` : "repeat isn't active");
      return;
    }
    if (cmd === 'delay') {
      const sec = parseDelaySec(args[0]);
      if (sec === null) {
        await safeSend(ctx.channel, 'delay [0-50] (ex: 0, 0.1, 0.5, 1.3, 50)');
        return;
      }
      globalDelay = sec;
      wakeDelays();
      saveSession();
      await safeSend(ctx.channel, `delay repeat: ${sec}s`);
      return;
    }
    if (cmd === 'delayspiced') {
      const sec = parseDelaySec(args[0]);
      if (sec === null) {
        await safeSend(ctx.channel, 'delayspiced [0-50] (ex: 0, 0.1, 0.5, 1.3, 50)');
        return;
      }
      spamDelay = sec;
      wakeDelays();
      await safeSend(ctx.channel, `delay spam user: ${sec}s`);
      return;
    }
    if (cmd === 'delaychannel') {
      const sec = parseDelaySec(args[0]);
      if (sec === null) {
        await safeSend(ctx.channel, 'delaychannel [0-50] (ex: 0, 0.1, 0.5, 1.3, 50)');
        return;
      }
      channelDelay = sec;
      wakeDelays();
      saveSession();
      await safeSend(ctx.channel, `channel delay: ${sec}s`);
      return;
    }
    if (
      cmd === 'gc' &&
      args.length &&
      ['add', 'leave', 'rename', 'create', 'new'].includes(args[0].toLowerCase())
    ) {
      const sub = args.shift().toLowerCase();
      if (sub === 'add') cmd = 'gcadd';
      else if (sub === 'leave') cmd = 'gcleave';
      else if (sub === 'rename') cmd = 'gcrename';
    }
    if (cmd === 'gcadd') {
      const ids = args.map((a) => String(a).replace(/[<@!>#]/g, '')).filter((a) => /^\d{17,20}$/.test(a));
      const gcId = ids.length > 1 ? ids.shift() : ctx.channel?.type === 'GROUP_DM' ? ctx.channel.id : null;
      const users = ids;
      if (!gcId || !users.length) {
        await safeSend(ctx.channel, 'gcadd [id_gc] [id_user] [id_user2...]');
        return;
      }
      const headers = {
        Authorization: token,
        'Content-Type': 'application/json',
      };
      let ok = 0,
        bad = 0;
      for (const uid of users.slice(0, 20)) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await axios.put(
              `https://discord.com/api/v9/channels/${gcId}/recipients/${uid}`,
              {},
              {
                headers,
                timeout: 15000,
              },
            );
            ok++;
            break;
          } catch (e) {
            const st = e.response?.status;
            if (st === 429) {
              await sleep(Math.ceil((e.response.data?.retry_after || 1) * 1000) + 250);
              continue;
            }
            bad++;
            console.error('[gcadd]', e.response?.data?.message || e.message);
            break;
          }
        }
        await sleep(400);
      }
      await safeSend(ctx.channel, `gcadd: ${ok} adaugati${bad ? ` (${bad} esuate)` : ''}`);
      return;
    }
    if (cmd === 'gcleave') {
      const list = args.map((a) => String(a).replace(/[<#>]/g, '')).filter((a) => /^\d{17,20}$/.test(a));
      if (!list.length && ctx.channel?.type === 'GROUP_DM') list.push(ctx.channel.id);
      if (!list.length) {
        await safeSend(ctx.channel, 'gcleave [id_gc] (or run the command in the group)');
        return;
      }
      const headers = {
        Authorization: token,
      };
      const here = ctx.channel?.id;
      let ok = 0,
        bad = 0;
      for (const gid of list.slice(0, 25)) {
        if (await silentLeaveGc(gid)) ok++;
        else bad++;
        await sleep(350);
      }
      if (!(list.length === 1 && list[0] === here))
        await safeSend(ctx.channel, `gcleave: ${ok} parasite${bad ? ` (${bad} esuate)` : ''}`);
      return;
    }
    if (cmd === 'gcrename') {
      let gcId = null;
      const first = args[0] ? String(args[0]).replace(/[<#>]/g, '') : '';
      if (/^\d{17,20}$/.test(first)) {
        gcId = first;
        args.shift();
      } else if (ctx.channel?.type === 'GROUP_DM') gcId = ctx.channel.id;
      const newName = args
        .join(' ')
        .replace(/^(name|text)=/i, '')
        .trim();
      if (!gcId || !newName) {
        await safeSend(ctx.channel, 'gcrename [id_gc] [nume nou]');
        return;
      }
      const headers = {
        Authorization: token,
        'Content-Type': 'application/json',
      };
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await axios.patch(
            `https://discord.com/api/v9/channels/${gcId}`,
            {
              name: newName.slice(0, 100),
            },
            {
              headers,
              timeout: 15000,
            },
          );
          await safeSend(ctx.channel, `gc redenumit: ${newName.slice(0, 100)}`);
          return;
        } catch (e) {
          if (e.response?.status === 429) {
            await sleep(Math.ceil((e.response.data?.retry_after || 1) * 1000) + 250);
            continue;
          }
          await safeSend(
            ctx.channel,
            `gcrename error: ${String(e.response?.data?.message || e.message).slice(0, 80)}`,
          );
          return;
        }
      }
      await safeSend(ctx.channel, 'gcrename: rate limit, incearca iar');
      return;
    }
    if (cmd === 'gc') {
      if (args.length < 3) {
        await safeSend(
          ctx.channel,
          'gc [id1] [id2] ... [NumeGrup] [nr_grupuri]\ngcadd [id_gc] [id_user] | gcleave [id_gc] | gcrename [id_gc] [nume]',
        );
        return;
      }
      const lastArg = args[args.length - 1];
      const count = /^\d{1,3}$/.test(lastArg) ? Math.min(parseInt(lastArg), 25) : 1;
      const nameEndIdx = /^\d{1,3}$/.test(lastArg) ? args.length - 2 : args.length - 1;
      const idArgs = [],
        nameArgs = [];
      for (let i = 0; i <= nameEndIdx; i++) {
        if (/^\d{17,20}$/.test(args[i])) idArgs.push(args[i]);
        else nameArgs.push(args[i]);
      }
      if (!idArgs.length) {
        await safeSend(ctx.channel, 'no valid user IDs found\nFormat: gc [id1] [id2] ... [GroupName] [nr]');
        return;
      }
      const groupName = nameArgs.join(' ') || 'Group';
      const headers = {
        Authorization: token,
        'Content-Type': 'application/json',
      };
      await safeSend(
        ctx.channel,
        `creare ${count} grup${count > 1 ? 'uri' : ''} with ${idArgs.length} membri...`,
      );
      let created = 0,
        failed = 0;
      const makeGroup = async (i) => {
        const name = count > 1 ? `${groupName} ${i}` : groupName;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const createRes = await axios.post(
              'https://discord.com/api/v9/users/@me/channels',
              {
                recipients: idArgs,
              },
              {
                headers,
                timeout: 15000,
              },
            );
            const groupId = createRes.data.id;
            axios
              .patch(
                `https://discord.com/api/v9/channels/${groupId}`,
                {
                  name,
                },
                {
                  headers,
                  timeout: 15000,
                },
              )
              .catch((e) => console.error('[gc rename]', e.response?.data?.message || e.message));
            created++;
            return;
          } catch (e) {
            const st = e.response?.status;
            if (st === 429) {
              const wait = Math.ceil((e.response.data?.retry_after || 1) * 1000) + 250;
              await sleep(wait);
              continue;
            }
            failed++;
            console.error('[gc]', e.response?.data?.message || e.message);
            return;
          }
        }
        failed++;
      };
      const CONCURRENCY = Math.min(5, count);
      let next = 1;
      const workers = Array.from(
        {
          length: CONCURRENCY,
        },
        async () => {
          while (true) {
            const i = next++;
            if (i > count) return;
            await makeGroup(i);
          }
        },
      );
      await Promise.all(workers);
      await safeSend(ctx.channel, `${created}/${count} grupuri create${failed ? ` (${failed} esuate)` : ''}`);
      return;
    }
    if (cmd === 'game' || cmd === 'gameoff') {
      const gameName = args.join(' ').trim();
      if (cmd === 'gameoff' || /^(?:off|stop)$/i.test(gameName)) {
        clearTimedActivity();
        try {
          await botClient.user.setPresence({
            activities: [],
            status: desiredStatus,
          });
        } catch {}
        await safeSend(ctx.channel, 'game off');
        return;
      }
      if (!gameName) {
        await safeSend(ctx.channel, 'game [nume joc]  /  game off');
        return;
      }
      try {
        const game = await setGameActivity(gameName);
        await safeSend(
          ctx.channel,
          `Playing ${game?.name || gameName}${game?.imageUrl ? '' : " — couldn't find an official image; showing name only"}`,
        );
      } catch (err) {
        await safeSend(ctx.channel, "couldn't set the game: " + String(err.message || err).slice(0, 100));
      }
      return;
    }
    if (cmd === 'streamimage') {
      if (!args.length) {
        await safeSend(ctx.channel, `poza curenta: ${STREAM_IMAGE_URL || 'neselectata'}\nstreamimage [url]`);
        return;
      }
      STREAM_IMAGE_URL = args[0];
      await safeSend(ctx.channel, `poza stream setata`);
      return;
    }
    function parseActivityDuration(args) {
      if (args.length < 2) return null;
      const last = String(args[args.length - 1]);
      const mm = last.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$|^(\d+):(\d{1,2})$|^(\d+(?:\.\d+)?)$/i);
      if (!mm || !/\d/.test(last)) return null;
      let mins;
      if (mm[4] !== undefined && mm[5] !== undefined) mins = Number(mm[4]) + Number(mm[5]) / 60;
      else if (mm[6] !== undefined) mins = Number(mm[6]);
      else mins = Number(mm[1] || 0) * 60 + Number(mm[2] || 0) + Number(mm[3] || 0) / 60;
      if (!(mins > 0)) return null;
      args.pop();
      return mins;
    }
    if (cmd === 'stream' || cmd === 'watching' || cmd === 'playing' || cmd === 'listening') {
      if (!args.length) {
        await safeSend(ctx.channel, cmd + ' [titlu] [minute]');
        return;
      }
      const type =
        cmd === 'stream'
          ? 'STREAMING'
          : cmd === 'watching'
            ? 'WATCHING'
            : cmd === 'playing'
              ? 'PLAYING'
              : 'LISTENING';
      const minutes = parseActivityDuration(args) || 0;
      const name = args.join(' ').trim() || 'Music';
      try {
        await setTimedActivity(name, type, minutes);
        isStreaming = type === 'STREAMING';
        streamCurrentName = name;
        await safeSend(
          ctx.channel,
          cmd + ': ' + name + ' | ' + (minutes > 0 ? Math.round(minutes * 10) / 10 + ' min' : 'nelimitat'),
        );
      } catch (err) {
        await safeSend(ctx.channel, 'error: ' + String(err.message || err).slice(0, 100));
      }
      return;
    }
    if (cmd === 'stopstream' || cmd === 'stopwatching' || cmd === 'stopplaying' || cmd === 'stoplistening') {
      clearTimedActivity();
      isStreaming = false;
      streamCurrentName = '';
      if (streamRefreshInterval) {
        clearInterval(streamRefreshInterval);
        streamRefreshInterval = null;
      }
      try {
        await botClient.user.setPresence({
          activities: [],
          status: desiredStatus,
        });
      } catch {}
      await safeSend(ctx.channel, cmd.replace('stop', '') + ' off');
      return;
    }
    if (cmd === 'afk') {
      const first = (args[0] || '').toLowerCase();
      if (first === 'on' || first === 'off') {
        afkMode = first === 'on';
        afkReason = args.slice(1).join(' ') || afkReason;
      } else {
        afkMode = !afkMode;
        afkReason = args.join(' ') || '';
      }
      await safeSend(
        ctx.channel,
        `afk ${afkMode ? `on${afkReason ? ` (${afkReason})` : ''}` : 'dezactivat'} | fraze: ${afkPhrases.length || 'default'}`,
      );
      return;
    }
    if (cmd === 'afkmsg' || cmd === 'addafkmsg') {
      const body = args.join(' ').trim();
      if (!body) {
        await safeSend(
          ctx.channel,
          `afkmsg [phrase1 | phrase2 | phrase3 ...] — add as many phrases as you want (current: ${afkPhrases.length})`,
        );
        return;
      }
      const add = body
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean);
      for (const x of add) if (!afkPhrases.includes(x)) afkPhrases.push(x);
      saveAfkPhrases();
      await safeSend(ctx.channel, `afk: +${add.length} fraze (total ${afkPhrases.length})`);
      return;
    }
    if (cmd === 'listafkmsg') {
      if (!afkPhrases.length) {
        await safeSend(ctx.channel, 'no saved afk phrases (using default ones)');
        return;
      }
      await safeSend(
        ctx.channel,
        `**afk fraze (${afkPhrases.length}):**\n` +
          afkPhrases
            .map((l, i) => `${i + 1}. ${l}`)
            .join('\n')
            .slice(0, 1800),
      );
      return;
    }
    if (cmd === 'clearafkmsg') {
      afkPhrases = [];
      saveAfkPhrases();
      await safeSend(ctx.channel, 'fraze afk sterse');
      return;
    }
    if (cmd === 'afkcheck') {
      afkCheckMode = !afkCheckMode;
      if (!afkCheckMode && afkCheckInterval) {
        clearInterval(afkCheckInterval);
        afkCheckInterval = null;
      }
      if (!afkCheckMode) afkCheckWatch.clear();
      else {
        loadAfkCheckPhrases();
        afkCheckIndex = 0;
      }
      await safeSend(ctx.channel, `afkcheck ${afkCheckMode ? 'on' : 'dezactivat'}`);
      return;
    }
    if (cmd === 'autoreact') {
      if (args.length < 2) {
        await safeSend(ctx.channel, 'autoreact [userID/@user] [emoji]');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      const emoji = args[1];
      autoreactActive[user.id] = emoji;
      await safeSend(ctx.channel, `autoreact ${emoji} enabled for ${user.username} (peste tot)`);
      return;
    }
    if (cmd === 'stopautoreact') {
      if (!args.length) {
        await safeSend(ctx.channel, 'stopautoreact [userID/@user]');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (autoreactActive[user.id]) {
        delete autoreactActive[user.id];
        await safeSend(ctx.channel, `autoreact disabled for ${user.username}`);
      } else {
        await safeSend(ctx.channel, "autoreact wasn't active for this user");
      }
      return;
    }
    if (cmd === 'tagall') {
      if (!args.length) {
        await safeSend(ctx.channel, 'tagall [channelID] [text optional]');
        return;
      }
      const channelId = args[0];
      const text = args.slice(1).join(' ') || null;
      const targetChannel =
        botClient.channels.cache.get(channelId) ||
        (await botClient.channels.fetch(channelId).catch(() => null));
      if (!targetChannel) {
        await safeSend(ctx.channel, "invalid channel or I don't have access");
        return;
      }
      const guild = targetChannel.guild;
      if (!guild) {
        await safeSend(ctx.channel, "the channel isn't in a server");
        return;
      }
      if (tagAllRunning[guild.id]) {
        await safeSend(ctx.channel, 'tagall is already running');
        return;
      }
      tagAllRunning[guild.id] = true;
      await safeSend(ctx.channel, `tagall started in <#${channelId}>...`);
      try {
        const members = await guild.members.fetch();
        const list = members.filter((m) => !m.user.bot && m.id !== botClient.user.id);
        let count = 0;
        for (const [id] of list) {
          const msg = text ? `<@${id}> ${text}` : `<@${id}>`;
          try {
            await targetChannel.send(msg);
            count++;
          } catch {}
          await sleep(40);
        }
        await targetChannel.send(`tagall done (${count}/${list.size})`);
      } catch (e) {
        await safeSend(ctx.channel, `error: ${e.message}`);
      } finally {
        delete tagAllRunning[guild.id];
      }
      return;
    }
    if (cmd === 'addnotepadspam' || cmd === 'addnotepad') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, 'ataseaza un .txt');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, 'only .txt');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(SPAM_NOTES_FILE, r.data);
        spamPhrases = loadNotepad(SPAM_NOTES_FILE);
        await safeSend(ctx.channel, `spam notepad: ${spamPhrases.length} paragrafe`);
      } catch (err) {
        await safeSend(ctx.channel, err.message);
      }
      return;
    }
    if (cmd === 'addnotepadreply') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, 'ataseaza un .txt');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, 'only .txt');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(REPLY_NOTES_FILE, r.data);
        replyWords = loadNotepad(REPLY_NOTES_FILE);
        await safeSend(ctx.channel, `reply notepad: ${replyWords.length} linii`);
      } catch (err) {
        await safeSend(ctx.channel, err.message);
      }
      return;
    }
    if (cmd === 'addnotepadafk' || cmd === 'addnotepadafkcheck') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, 'ataseaza un .txt');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, 'only .txt');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(AFKCHECK_NOTES_FILE, r.data);
        loadAfkCheckPhrases();
        afkCheckIndex = 0;
        await safeSend(ctx.channel, `afkcheck notepad: ${afkCheckPhrases.length} fraze`);
      } catch (err) {
        await safeSend(ctx.channel, err.message);
      }
      return;
    }
    if (cmd === 'listnotepadafk') {
      const lines = loadLines(AFKCHECK_NOTES_FILE);
      if (!lines.length) {
        await safeSend(ctx.channel, 'afkcheck notepad empty (using default phrases)');
        return;
      }
      await safeSend(
        ctx.channel,
        `**afkcheck (${lines.length}):**\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
      );
      return;
    }
    if (cmd === 'clearnotepadafk') {
      fs.writeFileSync(AFKCHECK_NOTES_FILE, '');
      loadAfkCheckPhrases();
      afkCheckIndex = 0;
      await safeSend(ctx.channel, 'notepad afkcheck golit');
      return;
    }
    if (cmd === 'addnotepadbeef') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, 'ataseaza un .txt');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, 'only .txt');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(BEEF_NOTES_FILE, r.data);
        beefPhrases = loadNotepad(BEEF_NOTES_FILE);
        await safeSend(ctx.channel, `beef notepad: ${beefPhrases.length} linii`);
      } catch (err) {
        await safeSend(ctx.channel, err.message);
      }
      return;
    }
    if (cmd === 'addnotepadgroup') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, '❌ Attach a .txt file with names for groups (one per line)');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, '❌ Only .txt files are accepted');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(GROUP_NOTES_FILE, r.data);
        const lines = loadLines(GROUP_NOTES_FILE);
        await safeSend(ctx.channel, `✅ Group notepad loaded: ${lines.length} nume`);
      } catch (err) {
        await safeSend(ctx.channel, `❌ Error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'groupname') {
      if (!args.length) {
        await safeSend(
          ctx.channel,
          'groupname [channelID] – starts cycling names from the notepad (2.5s delay)',
        );
        return;
      }
      const gcId = args[0];
      const lines = loadLines(GROUP_NOTES_FILE);
      if (!lines.length) {
        await safeSend(
          ctx.channel,
          '❌ The notepad is empty – upload names with addnotepadgroup (attach a .txt)',
        );
        return;
      }
      if (groupNameState.interval) clearInterval(groupNameState.interval);
      groupNameState.channelId = gcId;
      groupNameState.index = 0;
      const headers = {
        Authorization: token,
        'Content-Type': 'application/json',
      };
      groupNameState.interval = setInterval(async () => {
        const freshLines = loadLines(GROUP_NOTES_FILE);
        if (!freshLines.length) return;
        if (groupNameState.index >= freshLines.length) groupNameState.index = 0;
        const newName = freshLines[groupNameState.index++];
        try {
          await axios.patch(
            `https://discord.com/api/v9/channels/${groupNameState.channelId}`,
            {
              name: newName,
            },
            {
              headers,
              timeout: 10000,
            },
          );
        } catch (err) {
          console.error('[groupname]', err.response?.data?.message || err.message);
        }
      }, 2500);
      await safeSend(ctx.channel, `🔄 Cycling started for <#${gcId}> (${lines.length} names, 2.5s/change)`);
      return;
    }
    if (cmd === 'stopgroupname') {
      if (!groupNameState.interval) {
        await safeSend(ctx.channel, '❌ Cycling is not running');
        return;
      }
      clearInterval(groupNameState.interval);
      groupNameState.interval = null;
      groupNameState.channelId = null;
      groupNameState.index = 0;
      await safeSend(ctx.channel, '🛑 Cycling stopped');
      return;
    }
    if (cmd === 'listnotepadgroup') {
      const lines = loadLines(GROUP_NOTES_FILE);
      if (!lines.length) {
        await safeSend(ctx.channel, '📭 The notepad is empty');
        return;
      }
      await safeSend(
        ctx.channel,
        `**Names in notepad (${lines.length}):**\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
      );
      return;
    }
    if (cmd === 'clearnotepadgroup') {
      fs.writeFileSync(GROUP_NOTES_FILE, '');
      await safeSend(ctx.channel, '🗑️ Notepad golit');
      return;
    }
    if (cmd === 'snipe') {
      const s = snipeCache[ctx.channel.id];
      if (!s) {
        await ctx.channel.send('**no deleted messages in cache**').catch(() => {});
        return;
      }
      const ora = new Date(s.timestamp).toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const mention = s.author?.id ? `<@${s.author.id}>` : '@unknown';
      let continut = s.content?.trim() || '';
      if (s.attachment) {
        const cleanUrl = String(s.attachment).split('?')[0];
        const ext = path.extname(cleanUrl).toLowerCase();
        const tip = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)
          ? 'Photo'
          : ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)
            ? 'Video'
            : 'Atasament fisier';
        continut = (continut ? continut + '\n' : '') + tip + ': ' + s.attachment;
      }
      if (!continut) continut = '(no text)';
      const msg = `**USER : ${mention}\nORA : ${ora}\nMSG: ${continut}**`;
      await ctx.channel.send(msg).catch(() => {});
      return;
    }
    if (cmd === 'snipeedit') {
      const s = editSnipeCache[ctx.channel.id];
      if (!s) {
        await ctx.channel.send('no edited messages in cache for this channel').catch(() => {});
        return;
      }
      const mention = s.author?.id ? `<@${s.author.id}>` : '@unknown';
      const ora = new Date(s.timestamp).toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const out = `**USER : ${mention}\nORA : ${ora}\nMSG: ${s.oldContent.slice(0, 300)} → ${s.newContent.slice(0, 300)}**`;
      await ctx.channel.send(out).catch(() => {});
      return;
    }
    if (cmd === 'clearsnipe') {
      const hadSnipe = !!snipeCache[ctx.channel.id];
      const hadEdit = !!editSnipeCache[ctx.channel.id];
      delete snipeCache[ctx.channel.id];
      delete editSnipeCache[ctx.channel.id];
      await ctx.channel
        .send(`snipe cache sters${hadSnipe || hadEdit ? '' : ' (was already empty)'}`)
        .catch(() => {});
      return;
    }
    if (cmd === 'reverse') {
      reverseMode = !reverseMode;
      await safeSend(ctx.channel, `reverse ${reverseMode ? 'on' : 'dezactivat'}`);
      return;
    }
    if (cmd === 'stopreverse') {
      reverseMode = false;
      await safeSend(ctx.channel, 'reverse disabled');
      return;
    }
    if (cmd === 'mention') {
      if (!args.length) {
        await safeSend(
          ctx.channel,
          `mention target curent: ${mentionTargetId ? `<@${mentionTargetId}>` : 'niciunul'}\nmention @user`,
        );
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user negasit');
        return;
      }
      mentionTargetId = user.id;
      await safeSend(ctx.channel, `mention enabled: ${user.username}`);
      return;
    }
    if (cmd === 'stopmention') {
      mentionTargetId = null;
      await safeSend(ctx.channel, 'mention disabled');
      return;
    }
    if (cmd === 'avatar') {
      try {
        const avatarId = await resolveUserId(ctx, args.join(' '));
        if (!avatarId) {
          await safeSend(ctx.channel, `couldn't find user "${args.join(' ')}"`);
          return;
        }
        const info = await fetchUserFull(avatarId);
        const suppliedHash = /^a?_?[0-9a-f]{16,}$/i.test(String(args[1] || '')) ? String(args[1]) : null;
        const hash = suppliedHash || info.avatar || info.guildAvatar;
        if (!hash) {
          await safeSend(ctx.channel, `${info.tag} doesn't have a custom profile picture`);
          return;
        }
        const anim = String(hash).startsWith('a_');
        const ext = anim ? 'gif' : 'png';
        const base =
          !suppliedHash && !info.avatar && info.guildAvatar && info.guildId
            ? `https://cdn.discordapp.com/guilds/${info.guildId}/users/${avatarId}/avatars/${hash}`
            : `https://cdn.discordapp.com/avatars/${avatarId}/${hash}`;
        const avatarUrl = `${base}.${ext}?size=4096`;
        const ok = await sendImageFile(ctx.channel, avatarUrl, `avatar.${ext}`);
        if (!ok) await sendImageFile(ctx.channel, `${base}.png?size=1024`, 'avatar.png');
      } catch (err) {
        console.error('[avatar]', err.message);
      }
      return;
    }
    if (cmd === 'banner') {
      try {
        const bannerUserId = await resolveUserId(ctx, args.join(' '));
        if (!bannerUserId) {
          await safeSend(ctx.channel, `couldn't find user "${args.join(' ')}"`);
          return;
        }
        const info = await fetchUserFull(bannerUserId);
        const suppliedHash = /^a?_?[0-9a-f]{16,}$/i.test(String(args[1] || '')) ? String(args[1]) : null;
        let apiHash = null,
          apiColor = null;
        try {
          const r = await axios.get('https://discord.com/api/v9/users/' + bannerUserId, {
            headers: {
              Authorization: token,
              'User-Agent': 'Mozilla/5.0',
            },
            validateStatus: () => true,
            timeout: 10000,
          });
          if (r.status === 200) {
            apiHash = r.data?.banner || null;
            apiColor = r.data?.banner_color || null;
          }
          if (!apiHash) {
            const p = await axios.get(
              'https://discord.com/api/v9/users/' + bannerUserId + '/profile?with_mutual_guilds=false',
              {
                headers: {
                  Authorization: token,
                  'User-Agent': 'Mozilla/5.0',
                },
                validateStatus: () => true,
                timeout: 10000,
              },
            );
            if (p.status === 200) apiHash = p.data?.user?.banner || p.data?.user_profile?.banner || null;
          }
        } catch (e) {
          console.error('[banner api]', e.message?.slice(0, 60));
        }
        const hash = suppliedHash || apiHash || info.banner;
        if (!hash && apiColor) {
          await safeSend(ctx.channel, info.tag + ' only has a banner color: ' + apiColor);
          return;
        }
        if (!hash) {
          await safeSend(ctx.channel, `${info.tag} has no banner`);
          return;
        }
        const ext = String(hash).startsWith('a_') ? 'gif' : 'png';
        const base = `https://cdn.discordapp.com/banners/${bannerUserId}/${hash}`;
        const ok = await sendImageFile(ctx.channel, `${base}.${ext}?size=4096`, `banner.${ext}`);
        if (!ok) await sendImageFile(ctx.channel, `${base}.png?size=1024`, 'banner.png');
      } catch (err) {
        console.error('[banner]', err.message);
      }
      return;
    }
    if (cmd === 'typingfake') {
      const targetChannelId = args[0] || ctx.channel.id;
      if (typingFakeIntervals.has(targetChannelId)) {
        await safeSend(ctx.channel, `fake typing already active on <#${targetChannelId}>`);
        return;
      }
      const targetCh =
        botClient.channels.cache.get(targetChannelId) ||
        (await botClient.channels.fetch(targetChannelId).catch(() => null));
      if (!targetCh) {
        await safeSend(ctx.channel, 'channel not found');
        return;
      }
      await targetCh.sendTyping().catch(() => {});
      const iv = setInterval(async () => {
        if (!typingFakeIntervals.has(targetChannelId)) {
          clearInterval(iv);
          return;
        }
        await targetCh.sendTyping().catch(() => {});
      }, 8000);
      typingFakeIntervals.set(targetChannelId, iv);
      await safeSend(ctx.channel, `fake typing activated in <#${targetChannelId}>`);
      return;
    }
    if (cmd === 'stoptypingfake') {
      if (!args.length) {
        await safeSend(ctx.channel, 'stoptypingfake [channelID] or stoptypingfake all');
        return;
      }
      if (args[0] === 'all') {
        let count = typingFakeIntervals.size;
        for (const [, iv] of typingFakeIntervals) clearInterval(iv);
        typingFakeIntervals.clear();
        loopStopAll();
        await safeSend(
          ctx.channel,
          count > 0 ? `fake typing stopped on all (${count} canale)` : 'no active fake typing',
        );
      } else {
        const targetChannelId = args[0];
        if (!typingFakeIntervals.has(targetChannelId)) {
          await safeSend(ctx.channel, "fake typing isn't active on that channel");
          return;
        }
        clearInterval(typingFakeIntervals.get(targetChannelId));
        typingFakeIntervals.delete(targetChannelId);
        await safeSend(ctx.channel, `fake typing stopped on <#${targetChannelId}>`);
      }
      return;
    }
    if (cmd === 'autobeefer') {
      if (args.length < 2) {
        await safeSend(ctx.channel, 'autobeefer [canalID] [targetID]');
        return;
      }
      const channelId = args[0];
      const targetId = args[1];
      const channel =
        botClient.channels.cache.get(channelId) ||
        (await botClient.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        await safeSend(ctx.channel, 'invalid channel');
        return;
      }
      const target = await parseUser(targetId);
      if (!target) {
        await safeSend(ctx.channel, 'target invalid');
        return;
      }
      if (beeferState.running) {
        await safeSend(ctx.channel, 'autobeefer already active');
        return;
      }
      if (!beefPhrases.length) {
        await safeSend(ctx.channel, 'notepad beef is empty, add with addnotepadbeef');
        return;
      }
      beeferState.running = true;
      beeferState.channelId = channelId;
      beeferState.startedAt = Date.now();
      beeferState.targetId = target.id;
      beeferState.index = 0;
      if (beeferState.interval) clearLive(beeferState.interval);
      beeferState.interval = liveLoop(
        () => beeferState.delay ?? 3,
        () => !beeferState.running,
        async () => {
          if (!beeferState.running) {
            clearLive(beeferState.interval);
            beeferState.interval = null;
            return;
          }
          if (beeferState.index >= beefPhrases.length) beeferState.index = 0;
          const phrase = beefPhrases[beeferState.index++];
          if (phrase?.trim()) {
            try {
              const ch = botClient.channels.cache.get(beeferState.channelId);
              if (ch) {
                await ch.sendTyping();
                await ch.send(`<@${beeferState.targetId}> ${phrase}`);
              }
            } catch {}
          }
        },
      );
      await safeSend(
        ctx.channel,
        `autobeefer started in <#${channelId}> for <@${target.id}> (delay: ${beeferState.delay ?? 3}s)`,
      );
      return;
    }
    if (cmd === 'stopautobeefer') {
      if (!beeferState.running) {
        await safeSend(ctx.channel, "autobeefer isn't running");
        return;
      }
      beeferState.running = false;
      if (beeferState.interval) {
        clearLive(beeferState.interval);
        beeferState.interval = null;
      }
      beeferState.channelId = null;
      beeferState.targetId = null;
      beeferState.index = 0;
      beeferState.startedAt = 0;
      await safeSend(ctx.channel, 'autobeefer stopped');
      return;
    }
    if (cmd === 'delayatbf') {
      const sec = parseDelaySec(args[0]);
      if (sec === null) {
        await safeSend(ctx.channel, `delayatbf [0-50] — delay curent: ${beeferState.delay ?? 3}s`);
        return;
      }
      beeferState.delay = sec;
      wakeDelays();
      await safeSend(ctx.channel, `delay autobeefer setat: ${sec}s`);
      return;
    }
    if (cmd === 'addtoken') {
      if (!args.length) {
        await safeSend(ctx.channel, 'addtoken <token> [index 2-20]');
        return;
      }
      const newToken = args[0].trim();
      if (newToken === TOKEN || activeBots.has(newToken)) {
        await safeSend(ctx.channel, 'this token is already active');
        return;
      }
      let wanted = null;
      if (args[1] !== undefined) {
        const n = parseInt(args[1], 10);
        if (!(n >= 2 && n <= 20)) {
          await safeSend(ctx.channel, 'index invalid (2-20). indexul 1 e contul principal hostat');
          return;
        }
        if (botIndexes.has(n)) {
          await safeSend(ctx.channel, 'indexul ' + n + ' is already in use');
          return;
        }
        wanted = n;
      }
      const useIndex = wanted || nextFreeIndex();
      if (!useIndex) {
        await safeSend(ctx.channel, 'toate indexurile (2-20) sunt ocupate');
        return;
      }
      const withCommands = wanted === null;
      try {
        createBot(newToken, {
          index: useIndex,
          commands: withCommands,
        });
        rememberToken(newToken, useIndex, withCommands);
        await safeSend(
          ctx.channel,
          withCommands
            ? 'account added to index ' + useIndex + ' with full access to commands'
            : 'account added to index ' +
                useIndex +
                ' — without access to commands. start it from here: <command> ' +
                useIndex +
                ' <argumente> (ex: reply ' +
                useIndex +
                ' <user_id>)',
        );
      } catch (err) {
        console.error('[addtoken]', err.message);
        await safeSend(ctx.channel, 'error on add: ' + String(err.message).slice(0, 80));
      }
      return;
    }
    if (cmd === 'removetoken') {
      if (!args.length) {
        await safeSend(ctx.channel, 'removetoken [token or last 6 characters]');
        return;
      }
      const query = args[0].trim();
      if (query === TOKEN || TOKEN.endsWith(query)) {
        await safeSend(ctx.channel, "you can't delete the main account");
        return;
      }
      let foundToken = null;
      for (const [tok] of activeBots) {
        if (tok === query || tok.endsWith(query)) {
          foundToken = tok;
          break;
        }
      }
      if (!foundToken) {
        await safeSend(ctx.channel, 'token was not found');
        return;
      }
      const bc = activeBots.get(foundToken);
      const tag = bc?.user?.tag || 'unknown';
      try {
        await bc?.destroy();
      } catch {}
      activeBots.delete(foundToken);
      let removedIndex = null;
      for (const [i, slot] of botIndexes)
        if (slot.token === foundToken) {
          removedIndex = i;
          botIndexes.delete(i);
        }
      forgetToken(foundToken);
      await safeSend(
        ctx.channel,
        `cont ${tag} deconectat` + (removedIndex ? ' (index ' + removedIndex + ' eliberat)' : ''),
      );
      return;
    }
    if (cmd === 'mock') {
      if (!args.length) {
        await safeSend(ctx.channel, 'mock [userID/@user]');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (mockTargets[user.id]) {
        await safeSend(ctx.channel, 'mock already active: ' + user.username);
        return;
      }
      mockTargets[user.id] = true;
      await safeSend(
        ctx.channel,
        'mock activated: ' + user.username + ' — everything they write will be aLtErNaTiNg CaPs',
      );
      return;
    }
    if (cmd === 'stopmock') {
      if (!args.length) {
        const keys = Object.keys(mockTargets);
        if (!keys.length) {
          await safeSend(ctx.channel, 'no active mocks');
          return;
        }
        for (const k of keys) {
          delete mockTargets[k];
          delete mockLastTime[k];
        }
        await safeSend(ctx.channel, 'mock stopped for everyone (' + keys.length + ')');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (!mockTargets[user.id]) {
        await safeSend(ctx.channel, "mock wasn't active for this user");
        return;
      }
      delete mockTargets[user.id];
      delete mockLastTime[user.id];
      await safeSend(ctx.channel, 'mock stopped: ' + user.username);
      return;
    }
    if (cmd === 'copymsg') {
      if (!args.length) {
        await safeSend(ctx.channel, 'copymsg [userID/@user]');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (copyTargets[user.id]) {
        await safeSend(ctx.channel, 'copymsg already active: ' + user.username);
        return;
      }
      copyTargets[user.id] = true;
      await safeSend(
        ctx.channel,
        'copymsg activated: ' + user.username + " — I'll repeat everything they write",
      );
      return;
    }
    if (cmd === 'stopcopy') {
      if (!args.length) {
        const keys = Object.keys(copyTargets);
        if (!keys.length) {
          await safeSend(ctx.channel, 'no active copymsgs');
          return;
        }
        for (const k of keys) {
          delete copyTargets[k];
          delete copyLastTime[k];
        }
        await safeSend(ctx.channel, 'copymsg stopped for everyone (' + keys.length + ')');
        return;
      }
      const user = await parseUser(args[0]);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      if (!copyTargets[user.id]) {
        await safeSend(ctx.channel, "copymsg wasn't active");
        return;
      }
      delete copyTargets[user.id];
      delete copyLastTime[user.id];
      await safeSend(ctx.channel, 'copymsg stopped: ' + user.username);
      return;
    }
    if (cmd === 'listtargets') {
      const lines = [];
      if (replyState.targets.length)
        lines.push(
          'REPLY (' +
            replyState.targets.length +
            '): ' +
            replyState.targets.map((id) => '<@' + id + '>').join(', '),
        );
      if (aiState.targets.length)
        lines.push(
          'AI REPLY (' +
            aiState.targets.length +
            '): ' +
            aiState.targets.map((id) => '<@' + id + '>').join(', '),
        );
      const crKeys2 = Object.keys(customReplyState);
      if (crKeys2.length)
        lines.push(
          'CUSTOMREPLY (' + crKeys2.length + '): ' + crKeys2.map((id) => '<@' + id + '>').join(', '),
        );
      const mkKeys = Object.keys(mockTargets);
      if (mkKeys.length)
        lines.push('MOCK (' + mkKeys.length + '): ' + mkKeys.map((id) => '<@' + id + '>').join(', '));
      const cpKeys = Object.keys(copyTargets);
      if (cpKeys.length)
        lines.push('COPYMSG (' + cpKeys.length + '): ' + cpKeys.map((id) => '<@' + id + '>').join(', '));
      const arKeys = Object.keys(autoreactActive);
      if (arKeys.length)
        lines.push(
          'AUTOREACT (' +
            arKeys.length +
            '): ' +
            arKeys.map((id) => '<@' + id + '> ' + autoreactActive[id]).join(', '),
        );
      if (spamState.running) lines.push('SPAM: activ (tip: ' + (spamState.type || '?') + ')');
      if (beeferState.running) lines.push('AUTOBEEFER: activ');
      if (repeatState.running) lines.push('REPEAT: activ');
      if (!lines.length) {
        await safeSend(ctx.channel, 'no active targets');
        return;
      }
      await ctx.channel.send('TARGETI ACTIVI:\n' + lines.join('\n')).catch(() => {});
      return;
    }
    if (cmd === 'clearall') {
      replyState.running = false;
      replyState.targets = [];
      replyState.lastReplyTime = {};
      replyState.replyDelays = {};
      aiState.running = false;
      aiState.targets = [];
      aiState.history = {};
      for (const k of Object.keys(customReplyState)) delete customReplyState[k];
      for (const k of Object.keys(mockTargets)) {
        delete mockTargets[k];
        delete mockLastTime[k];
      }
      for (const k of Object.keys(copyTargets)) {
        delete copyTargets[k];
        delete copyLastTime[k];
      }
      if (spamState.interval) {
        clearLive(spamState.interval);
        spamState.interval = null;
      }
      spamState.running = false;
      spamState.type = null;
      spamState.target = null;
      spamState.targets = [];
      spamState.channelId = null;
      if (repeatState.interval) {
        clearLive(repeatState.interval);
        repeatState.interval = null;
      }
      repeatState.running = false;
      if (beeferState.interval) {
        clearLive(beeferState.interval);
        beeferState.interval = null;
      }
      beeferState.running = false;
      beeferState.channelId = null;
      beeferState.targetId = null;
      beeferState.startedAt = 0;
      for (const k of Object.keys(autoreactActive)) delete autoreactActive[k];
      for (const [, iv] of typingFakeIntervals) clearInterval(iv);
      typingFakeIntervals.clear();
      afkMode = false;
      afkReason = '';
      afkCheckMode = false;
      if (afkCheckInterval) {
        clearInterval(afkCheckInterval);
        afkCheckInterval = null;
      }
      afkCheckWatch.clear();
      reverseMode = false;
      mentionTargetId = null;
      await safeSend(
        ctx.channel,
        'CLEARALL — everything stopped: reply, ai, customreply, mock, copy, spam, repeat, beefer, autoreact, typingfake, afk, reverse, mention',
      );
      return;
    }
    if (cmd === 'ping') {
      const t = Date.now();
      const m = await ctx.channel.send('-# ping...');
      await m.edit(`-# ping: ${Date.now() - t}ms | ws: ${Math.round(botClient.ws.ping)}ms`).catch(() => {});
      return;
    }
    if (cmd === 'say') {
      if (!args.length) {
        await safeSend(ctx.channel, 'say [channel_id] <message>');
        return;
      }
      let target = ctx.channel;
      let words = [...args];
      if (/^\d{15,25}$/.test(words[0])) {
        const ch =
          botClient.channels.cache.get(words[0]) ||
          (await botClient.channels.fetch(words[0]).catch(() => null));
        if (ch) {
          target = ch;
          words.shift();
        }
      }
      if (!words.length) {
        await safeSend(ctx.channel, 'say [channel_id] <message>');
        return;
      }
      try {
        await target.send(words.join(' '));
      } catch (e) {
        await safeSend(ctx.channel, "couldn't send");
      }
      return;
    }
    if (cmd === 'clear') {
      const count = Math.min(parseInt(args[0]) || 10, 100);
      let target = ctx.channel;
      if (args[1] && /^\d{15,25}$/.test(args[1])) {
        target =
          botClient.channels.cache.get(args[1]) ||
          (await botClient.channels.fetch(args[1]).catch(() => null)) ||
          ctx.channel;
      }
      let deleted = 0;
      try {
        const msgs = await target.messages.fetch({
          limit: 100,
        });
        for (const m of msgs.values()) {
          if (deleted >= count) break;
          if (m.author.id !== botClient.user.id) continue;
          try {
            await m.delete();
            deleted++;
            await sleep(700);
          } catch {}
        }
      } catch {}
      await safeSend(ctx.channel, `sterse: ${deleted}`);
      return;
    }
    if (cmd === 'info') {
      const uid = await resolveUserId(ctx, args.join(' '));
      if (!uid) {
        await safeSend(ctx.channel, 'user negasit');
        return;
      }
      let user = botClient.users.cache.get(uid) || (await botClient.users.fetch(uid).catch(() => null));
      let raw = null;
      try {
        const r = await axios.get(
          'https://discord.com/api/v9/users/' + uid + '/profile?with_mutual_guilds=false',
          {
            headers: {
              Authorization: token,
              'User-Agent': 'Mozilla/5.0',
            },
            validateStatus: () => true,
            timeout: 10000,
          },
        );
        if (r.status === 200) raw = r.data;
      } catch {}
      const u = raw?.user || {};
      const username = u.username || user?.username || uid;
      const globalName = u.global_name || user?.globalName || null;
      const created = new Date(Number(BigInt(uid) >> 22n) + 1420070400000);
      let presence = null;
      for (const g of botClient.guilds.cache.values()) {
        const m = g.members.cache.get(uid) || g.presences?.cache?.get?.(uid);
        const p = m?.presence || (m?.status ? m : null);
        if (p?.status) {
          presence = p;
          break;
        }
      }
      const cs = presence?.clientStatus || {};
      const devices = [];
      if (cs.desktop) devices.push('pc / laptop (desktop)');
      if (cs.mobile) devices.push('telefon');
      if (cs.web) devices.push('browser');
      if (presence?.activities?.some((a) => a.type === 'STREAMING' || a.type === 4)) {
      }
      const acts = (presence?.activities || [])
        .filter((a) => a.type !== 'CUSTOM' && a.type !== 4)
        .map((a) => a.name);
      const custom = (presence?.activities || []).find((a) => a.type === 'CUSTOM' || a.type === 4);
      const badges = [];
      const flags = Number(u.public_flags || user?.flags?.bitfield || 0);
      const FLAGMAP = {
        1: 'staff',
        2: 'partner',
        4: 'hypesquad events',
        8: 'bug hunter',
        64: 'bravery',
        128: 'brilliance',
        256: 'balance',
        512: 'early supporter',
        16384: 'bug hunter 2',
        65536: 'verified bot dev',
        131072: 'early verified dev',
        4194304: 'active developer',
      };
      for (const k of Object.keys(FLAGMAP)) if (flags & Number(k)) badges.push(FLAGMAP[k]);
      const nitro = raw?.premium_type
        ? raw.premium_type === 2
          ? 'nitro'
          : raw.premium_type === 3
            ? 'nitro basic'
            : 'nitro classic'
        : 'no nitro';
      const lines = [
        username + (globalName ? ' (' + globalName + ')' : ''),
        'id: ' + uid,
        'creat: ' + created.toISOString().slice(0, 10),
        'status: ' + (presence?.status || 'offline/necunoscut'),
        'device: ' + (devices.length ? devices.join(', ') : 'necunoscut'),
        'activitate: ' + (acts.length ? acts.join(', ') : '-'),
        'status custom: ' + (custom?.state || '-'),
        'bot: ' + (u.bot ? 'da' : 'nu'),
        nitro,
        'badges: ' + (badges.length ? badges.join(', ') : '-'),
        'avatar: ' + (u.avatar ? 'da' : 'nu') + ' | banner: ' + (u.banner ? 'da' : 'nu'),
        'bio: ' + ((raw?.user_profile?.bio || '').slice(0, 150) || '-'),
      ];
      await safeSend(ctx.channel, lines.join('\n'));
      return;
    }
    if (cmd === 'serverav' || cmd === 'serverbanner') {
      const gid = args[0] || ctx.guild?.id;
      if (!gid) {
        await safeSend(ctx.channel, 'specifica server_id');
        return;
      }
      const g = botClient.guilds.cache.get(gid) || (await botClient.guilds.fetch(gid).catch(() => null));
      if (!g) {
        await safeSend(ctx.channel, 'server negasit');
        return;
      }
      const url =
        cmd === 'serverav'
          ? g.iconURL({
              dynamic: true,
              size: 1024,
            })
          : g.bannerURL
            ? g.bannerURL({
                size: 1024,
              })
            : null;
      if (!url) {
        await safeSend(ctx.channel, "doesn't have");
        return;
      }
      await ctx.channel.send(url);
      return;
    }
    if (cmd === 'uptime') {
      await ctx.channel.send(`**UPTIME:${uptime()}**`);
      return;
    }
  }
  async function handleEqual(message, cmd, args) {
    const ctx = message;
    function fmtReply(content) {
      if (typeof content !== 'string' || !content.trim()) return content;
      content = stripCmdPrefix(content);
      if (content.startsWith('-# ')) return content;
      return '-# ' + content.split('\n').join('\n-# ');
    }
    async function safeSend(channel, content, opts) {
      if (!channel) return;
      try {
        KNULL_COUNTERS.sent++;
        let msg;
        if (opts)
          msg = await channel.send({
            content: fmtReply(content),
            ...opts,
          });
        else if (!content || (typeof content === 'string' && !content.trim())) return;
        else msg = await channel.send(fmtReply(content));
        return msg;
      } catch {}
    }
    if (cmd === 'troll') {
      const pool = [
        '😀',
        '😂',
        '🤣',
        '😎',
        '🤡',
        '👻',
        '💀',
        '👽',
        '🤖',
        '😈',
        '🔥',
        '⚡',
        '✨',
        '💥',
        '🎉',
        '🎲',
        '🎯',
        '🚀',
        '🛸',
        '🐸',
        '🐵',
        '🦄',
        '🐲',
        '🍕',
        '🍉',
        '🍓',
        '🍿',
        '⚽',
        '🎮',
        '🎸',
        '🏆',
        '💎',
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🖤',
        '🤍',
        '👍',
        '👀',
        '🫡',
        '🤯',
        '🥶',
        '🥳',
        '😴',
        '🙃',
        '🤪',
      ];
      const out = Array.from(
        {
          length: 40,
        },
        () => pool[Math.floor(Math.random() * pool.length)],
      ).join(' ');
      await ctx.channel.send(out);
      return;
    }
    if (cmd === 'gay') {
      const raw = args[0];
      if (!raw) {
        await safeSend(ctx.channel, 'gay [id/@user]');
        return;
      }
      const user = await parseUser(raw);
      if (!user) {
        await safeSend(ctx.channel, 'user invalid');
        return;
      }
      let hash = 0;
      for (const ch of user.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      await safeSend(ctx.channel, `${user.username}: ${(hash % 100) + 1}%`);
      return;
    }
    const DOLLAR_ALIASES = new Set([
      'pic',
      'tts',
      'avatar',
      'banner',
      'mock',
      'stopmock',
      'copymsg',
      'stopcopy',
      'autoreact',
      'stopautoreact',
      'afk',
      'afkcheck',
      'uptime',
      'snipe',
      'snipeedit',
      'clearsnipe',
      'listtargets',
      'clearall',
      'listening',
      'playing',
      'watching',
      'stopwatching',
    ]);
    if (DOLLAR_ALIASES.has(cmd)) {
      await handleDollar(message, cmd, args);
      return;
    }
    if (cmd === 'addnotepadgroup') {
      if (!ctx.attachments.size) {
        await safeSend(ctx.channel, '❌ Attach a .txt file with the names for the groups');
        return;
      }
      const att = ctx.attachments.first();
      if (!att.name.endsWith('.txt')) {
        await safeSend(ctx.channel, '❌ Only .txt');
        return;
      }
      try {
        const r = await axios.get(att.url, {
          responseType: 'text',
        });
        fs.writeFileSync(GROUP_NOTES_FILE, r.data);
        const lines = loadLines(GROUP_NOTES_FILE);
        await safeSend(ctx.channel, `✅ Group notepad loaded: ${lines.length} nume`);
      } catch (err) {
        await safeSend(ctx.channel, `❌ Error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'groupname') {
      if (!args.length) {
        await safeSend(ctx.channel, 'groupname [IDcanal]');
        return;
      }
      const gcId = args[0];
      const lines = loadLines(GROUP_NOTES_FILE);
      if (!lines.length) {
        await safeSend(ctx.channel, '❌ Notepad gol');
        return;
      }
      if (groupNameState.interval) clearInterval(groupNameState.interval);
      groupNameState.channelId = gcId;
      groupNameState.index = 0;
      const headers = {
        Authorization: token,
        'Content-Type': 'application/json',
      };
      groupNameState.interval = setInterval(async () => {
        const freshLines = loadLines(GROUP_NOTES_FILE);
        if (!freshLines.length) return;
        if (groupNameState.index >= freshLines.length) groupNameState.index = 0;
        const newName = freshLines[groupNameState.index++];
        try {
          await axios.patch(
            `https://discord.com/api/v9/channels/${groupNameState.channelId}`,
            {
              name: newName,
            },
            {
              headers,
              timeout: 10000,
            },
          );
        } catch (err) {
          console.error('[groupname]', err.response?.data?.message || err.message);
        }
      }, 2500);
      await safeSend(ctx.channel, `🔄 Looping started (2.5s) for <#${gcId}> (${lines.length} nume)`);
      return;
    }
    if (cmd === 'stopgroupname') {
      if (!groupNameState.interval) {
        await safeSend(ctx.channel, '❌ Cycling is not running');
        return;
      }
      clearInterval(groupNameState.interval);
      groupNameState.interval = null;
      groupNameState.channelId = null;
      groupNameState.index = 0;
      await safeSend(ctx.channel, '🛑 Cycling stopped');
      return;
    }
    if (cmd === 'listnotepadgroup') {
      const lines = loadLines(GROUP_NOTES_FILE);
      if (!lines.length) {
        await safeSend(ctx.channel, '📭 Notepad gol');
        return;
      }
      await safeSend(
        ctx.channel,
        `**Nume (${lines.length}):**\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
      );
      return;
    }
    if (cmd === 'clearnotepadgroup') {
      fs.writeFileSync(GROUP_NOTES_FILE, '');
      await safeSend(ctx.channel, '🗑️ Golit');
      return;
    }
    if (cmd === 'ghostping') {
      if (args.length < 2) {
        await safeSend(ctx.channel, 'ghostping [channelID] [userID/@user]');
        return;
      }
      const channelId = args[0];
      const userArg = args[1];
      const match = userArg.match(/<@!?(\d+)>/);
      const mention = match ? `<@${match[1]}>` : /^\d{17,20}$/.test(userArg) ? `<@${userArg}>` : userArg;
      try {
        const ch =
          botClient.channels.cache.get(channelId) ||
          (await botClient.channels.fetch(channelId).catch(() => null));
        if (!ch) {
          await safeSend(ctx.channel, `canalul ${channelId} negasit`);
          return;
        }
        const m = await ch.send(mention);
        await sleep(100);
        await m.delete().catch(() => {});
      } catch (err) {
        await safeSend(ctx.channel, `ghostping error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'weather') {
      if (!args.length) {
        await safeSend(ctx.channel, 'weather [oras]');
        return;
      }
      const query = args.join(' ').trim();
      try {
        const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
          params: {
            name: query,
            count: 10,
            language: 'ro',
            format: 'json',
          },
          timeout: 10000,
        });
        const results = geo.data?.results || [];
        if (!results.length) {
          await safeSend(ctx.channel, `locatia "${query}" doesn't exist`);
          return;
        }
        const norm = (s) =>
          String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const exact = results.find((r) => norm(r.name) === norm(query)) || results[0];
        const w = await axios.get('https://api.open-meteo.com/v1/forecast', {
          params: {
            latitude: exact.latitude,
            longitude: exact.longitude,
            current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
            timezone: 'auto',
          },
          timeout: 10000,
        });
        const c = w.data?.current;
        if (!c) {
          await safeSend(ctx.channel, "couldn't get the weather");
          return;
        }
        const CODES = {
          0: 'senin',
          1: 'aproape senin',
          2: 'partial noros',
          3: 'innorat',
          45: 'ceata',
          48: 'freezing fog',
          51: 'burnita slaba',
          53: 'burnita',
          55: 'burnita puternica',
          61: 'ploaie slaba',
          63: 'ploaie',
          65: 'ploaie puternica',
          66: 'ploaie inghetata',
          67: 'ploaie inghetata puternica',
          71: 'ninsoare slaba',
          73: 'ninsoare',
          75: 'ninsoare puternica',
          77: 'grindina mica',
          80: 'averse slabe',
          81: 'averse',
          82: 'averse puternice',
          85: 'averse de zapada',
          86: 'averse puternice de zapada',
          95: 'furtuna',
          96: 'hailstorm',
          99: 'strong storm with hail',
        };
        const desc = CODES[c.weather_code] || 'necunoscut';
        const place = [exact.name, exact.admin1, exact.country].filter(Boolean).join(', ');
        await safeSend(
          ctx.channel,
          `${place} — ${desc}\n` +
            `${Math.round(c.temperature_2m)}°C (simte ca ${Math.round(c.apparent_temperature)}°C) | Umiditate: ${c.relative_humidity_2m}% | Vant: ${Math.round(c.wind_speed_10m)} km/h`,
        );
      } catch (err) {
        await safeSend(ctx.channel, `weather error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'drag') {
      const userId = args[0];
      const mainVoice = args[1];
      const targetVoice = args[2];
      const delay = parseInt(args[3]) || 1000;
      if (!userId || !mainVoice || !targetVoice) {
        await safeSend(ctx.channel, 'Usage: drag userID mainVoiceID targetVoiceID [delay_ms]');
        return;
      }
      if (activeDrags[userId]) {
        await safeSend(ctx.channel, 'User is already in drag.');
        return;
      }
      let member;
      try {
        member = await ctx.guild.members.fetch(userId);
      } catch {
        await safeSend(ctx.channel, 'User invalid.');
        return;
      }
      activeDrags[userId] = true;
      await safeSend(ctx.channel, `🔁 Drag enabled for <@${userId}>`);
      (async function dragLoop() {
        while (activeDrags[userId]) {
          if (!member.voice.channel) {
            await sleep(delay);
            continue;
          }
          try {
            await member.voice.setChannel(targetVoice);
          } catch {}
          await sleep(delay);
          if (!activeDrags[userId]) break;
          try {
            await member.voice.setChannel(mainVoice);
          } catch {}
          await sleep(delay);
        }
      })();
      return;
    }
    if (cmd === 'offdrag') {
      const userId = args[0];
      if (!userId || !activeDrags[userId]) {
        await safeSend(ctx.channel, 'User is not in drag.');
        return;
      }
      delete activeDrags[userId];
      await safeSend(ctx.channel, `🛑 drag stopped for <@${userId}>`);
      return;
    }
    if (cmd === 'status') {
      const valid = ['online', 'idle', 'dnd', 'invisible', 'vr', 'pc'];
      let s = args[0]?.toLowerCase();
      if (s === 'invisibile') s = 'invisible';
      if (!s || !valid.includes(s)) {
        await safeSend(ctx.channel, `status [${valid.join('/')}]`);
        return;
      }
      if (s === 'vr') {
        const keep = ['online', 'idle', 'dnd', 'invisible'].includes(args[1]?.toLowerCase())
          ? args[1].toLowerCase()
          : 'online';
        await applyStatus(keep);
        const ok = startVrMode(keep);
        await safeSend(ctx.channel, ok ? 'status VR activ' : "can't start VR: missing ws package (npm i ws)");
        return;
      }
      if (s === 'novr' || s === 'stopvr') {
        stopVrMode();
        await safeSend(ctx.channel, 'VR stopped');
        return;
      }
      if (s === 'pc') {
        const keep = ['online', 'idle', 'dnd', 'invisible'].includes(args[1]?.toLowerCase())
          ? args[1].toLowerCase()
          : desiredStatus;
        await applyStatus(keep);
        if (vrActive) vrSetStatus(keep);
        const ok = startPcMode(keep);
        await safeSend(ctx.channel, ok ? 'status PC activ' : "can't start PC: missing ws package (npm i ws)");
        return;
      }
      if (s === 'nopc' || s === 'stoppc') {
        stopPcMode();
        await safeSend(ctx.channel, 'PC stopped');
        return;
      }
      await applyStatus(s);
      if (vrActive) vrSetStatus(s);
      if (pcActive) pcSetStatus(s);
      await safeSend(ctx.channel, `status setat: ${s}`);
      return;
    }
    if (cmd === 'quest' || cmd === 'queston' || cmd === 'quests') {
      const started = startQuests(ctx.channel);
      await safeSend(
        ctx.channel,
        started
          ? 'auto quest started - doing all quests (orbs, launch quest, video) until stopquest'
          : 'auto quest is already running',
      );
      return;
    }
    if (cmd === 'stopquest' || cmd === 'questoff') {
      await safeSend(ctx.channel, stopQuests() ? 'auto quest stopped' : "auto quest wasn't running");
      return;
    }
    if (cmd === 'questlist' || cmd === 'questdebug') {
      const quests = await fetchQuests(true);
      if (!quests.length) {
        const b = await questBuildNumber();
        await safeSend(
          ctx.channel,
          [
            '-# quest list: no active quests on the account',
            '-# build: ' + b,
            ...questState.log.slice(0, 5).map((l) => '-# ' + l),
          ]
            .join('\n')
            .slice(0, 1900),
        );
        return;
      }
      const lines = quests.slice(0, 12).map((q) => {
        const t = questTasks(q);
        const st = q.user_status || {};
        const kind = Object.keys(t)[0];
        const task = kind ? t[kind] : null;
        const target = task ? task.target || task.threshold || task.duration || 0 : 0;
        const cur = Math.floor(st.progress?.[kind]?.value || 0);
        const stare = st.claimed_at
          ? 'premiu luat'
          : st.completed_at
            ? 'terminat'
            : st.enrolled_at
              ? 'in lucru'
              : 'neinceput';
        return (
          '-# ' +
          questName(q) +
          ' | ' +
          (kind || 'no task') +
          (target ? ' ' + cur + '/' + target + 's' : '') +
          ' | ' +
          stare +
          (questExpired(q) ? ' | expirat' : '') +
          (questOnCooldown(q.id) ? ' | pauza' : '')
        );
      });
      await safeSend(ctx.channel, lines.join('\n').slice(0, 1900));
      return;
    }
    if (cmd === 'nsniper' || cmd === 'nitrosniper' || cmd === 'sniper' || cmd === 'giftsniper') {
      giftSniper.on = true;
      await safeSend(ctx.channel, '-# nitro sniper enabled (nitro + decorations + any gift link)');
      return;
    }
    if (cmd === 'stopsniper' || cmd === 'stopnsniper' || cmd === 'stopnitrosniper' || cmd === 'sniperoff') {
      giftSniper.on = false;
      await safeSend(ctx.channel, '-# nitro sniper disabled');
      return;
    }
    if (cmd === 'sniperstatus' || cmd === 'nitrostatus') {
      const lines = [
        '-# nitro sniper: ' + (giftSniper.on ? 'pornit' : 'oprit'),
        '-# luate: ' + giftSniper.claimed + ' | ratate: ' + giftSniper.missed,
        ...giftSniper.log.slice(0, 10).map((l) => '-# ' + l),
      ];
      await safeSend(ctx.channel, lines.join('\n').slice(0, 1900));
      return;
    }
    if (cmd === 'queststatus') {
      const lines = [
        '-# quest auto: ' + (questState.running ? 'pornit' : 'oprit'),
        '-# terminate: ' + questState.done.size + ' | orbs: ' + questState.orbs,
        '-# ultima verificare: ' +
          (questState.lastRun
            ? 'now ' + Math.floor((Date.now() - questState.lastRun) / 1000) + 's'
            : 'not yet'),
        ...questState.log.slice(0, 12).map((l) => '-# ' + l),
      ];
      await safeSend(ctx.channel, lines.join('\n').slice(0, 1900));
      return;
    }
    if (cmd === 'channelreact') {
      if (args.length < 2) {
        await safeSend(ctx.channel, 'channelreact [channelID] [emoji]');
        return;
      }
      const chId = args[0].replace(/\D/g, '');
      const emoji = args.slice(1).join(' ').trim();
      if (!chId) {
        await safeSend(ctx.channel, 'channelID invalid');
        return;
      }
      const ch =
        botClient.channels.cache.get(chId) || (await botClient.channels.fetch(chId).catch(() => null));
      if (!ch) {
        await safeSend(ctx.channel, `canalul ${chId} negasit`);
        return;
      }
      channelReact[chId] = emoji;
      await safeSend(ctx.channel, `channelreact active on <#${chId}> with ${emoji}`);
      return;
    }
    if (cmd === 'stopchannelreact') {
      const chId = (args[0] || ctx.channel.id).replace(/\D/g, '');
      if (!channelReact[chId]) {
        await safeSend(ctx.channel, "channelreact isn't running on this channel");
        return;
      }
      delete channelReact[chId];
      await safeSend(ctx.channel, `channelreact stopped on <#${chId}>`);
      return;
    }
    if (cmd === 'serverinfo') {
      if (!args.length) {
        await safeSend(ctx.channel, 'serverinfo [serverID]');
        return;
      }
      const gid = String(args[0]).replace(/[^0-9]/g, '');
      if (!/^\d{15,25}$/.test(gid)) {
        await safeSend(ctx.channel, 'id de server invalid');
        return;
      }
      try {
        let guild = botClient.guilds.cache.get(gid);
        if (!guild) {
          try {
            guild = await botClient.guilds.fetch(gid);
          } catch {}
        }
        if (guild && typeof guild.fetch === 'function' && !guild.channels) {
          try {
            guild = await guild.fetch();
          } catch {}
        }
        if (guild && guild.name) {
          const owner = await guild.fetchOwner().catch(() => null);
          const created = guild.createdAt
            ? guild.createdAt.toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : '?';
          await safeSend(
            ctx.channel,
            '**' +
              guild.name +
              '**\n' +
              'ID: ' +
              guild.id +
              '\n' +
              'Proprietar: ' +
              (owner?.user?.tag || guild.ownerId || '?') +
              '\n' +
              'Creat: ' +
              created +
              '\n' +
              'Membri: ' +
              (guild.memberCount ?? guild.approximateMemberCount ?? '?') +
              '\n' +
              'Canale: ' +
              (guild.channels?.cache?.size ?? '?') +
              '\n' +
              'Roluri: ' +
              (guild.roles?.cache?.size ?? '?') +
              '\n' +
              'Boosturi: ' +
              (guild.premiumSubscriptionCount || 0) +
              ' (level ' +
              (guild.premiumTier ?? 0) +
              ')',
          );
          return;
        }
        const headers = {
          Authorization: token,
          'Content-Type': 'application/json',
        };
        let r = await axios.get('https://discord.com/api/v9/guilds/' + gid + '?with_counts=true', {
          headers,
          validateStatus: () => true,
        });
        if (r.status === 200 && r.data?.name) {
          const g = r.data;
          const created = new Date(Number((BigInt(gid) >> 22n) + 1420070400000n)).toLocaleDateString(
            'ro-RO',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            },
          );
          await safeSend(
            ctx.channel,
            '**' +
              g.name +
              '**\n' +
              'ID: ' +
              gid +
              '\n' +
              'Proprietar: ' +
              (g.owner_id || '?') +
              '\n' +
              'Creat: ' +
              created +
              '\n' +
              'Membri: ' +
              (g.approximate_member_count ?? '?') +
              '\n' +
              'Online: ' +
              (g.approximate_presence_count ?? '?') +
              '\n' +
              'Boosturi: ' +
              (g.premium_subscription_count || 0) +
              ' (level ' +
              (g.premium_tier ?? 0) +
              ')',
          );
          return;
        }
        let p = await axios.get('https://discord.com/api/v9/guilds/' + gid + '/preview', {
          headers,
          validateStatus: () => true,
        });
        if (p.status === 200 && p.data?.name) {
          const g = p.data;
          await safeSend(
            ctx.channel,
            '**' +
              g.name +
              '**\n' +
              'ID: ' +
              gid +
              '\n' +
              'Membri: ' +
              (g.approximate_member_count ?? '?') +
              '\n' +
              'Online: ' +
              (g.approximate_presence_count ?? '?') +
              '\n' +
              'Descriere: ' +
              (g.description || '-'),
          );
          return;
        }
        await safeSend(
          ctx.channel,
          "couldn't get info (status " + r.status + ") — account not in server or server isn't public",
        );
      } catch (err) {
        await safeSend(ctx.channel, 'error: ' + String(err.message).slice(0, 120));
      }
      return;
    }
    if (cmd === '0') {
      if (!args.length || !/^\d+$/.test(args[0])) {
        await safeSend(ctx.channel, '0 [1-10000] — ex: 0 10');
        return;
      }
      const limit = Math.max(1, Math.min(parseInt(args[0]), 10000));
      let deleted = 0;
      let before;
      try {
        while (deleted < limit) {
          const opts = {
            limit: 100,
          };
          if (before) opts.before = before;
          const fetched = await ctx.channel.messages.fetch(opts);
          if (!fetched.size) break;
          before = fetched.last().id;
          const mine = [...fetched.values()].filter((m) => m.author.id === botClient.user.id);
          for (const m of mine) {
            if (deleted >= limit) break;
            try {
              await m.delete();
              deleted++;
            } catch {}
            await sleep(600);
          }
        }
      } catch (err) {
        await safeSend(ctx.channel, `purge error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'voice' || cmd === 'vm' || cmd === 'vocal') {
      const os = require('os');
      const tok = botClient.token;
      const H = {
        Authorization: tok,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9163 Chrome/124.0.6367.243 Electron/30.2.0 Safari/537.36',
      };
      const a = [...args];
      let targetId = null;
      if (a[0] && /^\d{15,21}$/.test(a[0].replace(/[<#@!>]/g, '')))
        targetId = a.shift().replace(/[<#@!>]/g, '');
      const att = message.attachments?.first?.() || null;
      let refAtt = null;
      if (!att && message.reference?.messageId) {
        try {
          const r = await message.channel.messages.fetch(message.reference.messageId);
          refAtt = r.attachments?.first?.() || null;
        } catch {}
      }
      const base = path.join(os.tmpdir(), `vm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const src = base + '.src',
        ogg = base + '.ogg';
      const clean = () => {
        for (const f of [src, ogg]) {
          try {
            fs.unlinkSync(f);
          } catch {}
        }
      };
      try {
        let input = null;
        const pick = att || refAtt;
        if (pick) {
          const r = await axios.get(pick.url, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          fs.writeFileSync(src, Buffer.from(r.data));
          input = src;
        } else if (a[0] && /^https?:\/\//i.test(a[0])) {
          const r = await axios.get(a[0], {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024,
          });
          fs.writeFileSync(src, Buffer.from(r.data));
          input = src;
        } else if (a[0]) {
          input = findAudioFile(a.join(' '));
          if (!input) {
            await safeSend(ctx.channel, `can't find "${a.join(' ')}"`);
            return;
          }
        } else {
          await safeSend(ctx.channel, 'voice [channel/user id] <file.mp3 | url | attach file>');
          return;
        }
        if (pick) {
          try {
            await message.delete();
          } catch {}
        }
        let channelId = message.channel.id;
        if (targetId) {
          let ch = null;
          try {
            ch = botClient.channels.cache.get(targetId) || (await botClient.channels.fetch(targetId));
          } catch {}
          if (!ch) {
            try {
              const u = await botClient.users.fetch(targetId);
              ch = await u.createDM();
            } catch {}
          }
          if (!ch) {
            await safeSend(ctx.channel, `can't find channel/user ${targetId}`);
            clean();
            return;
          }
          channelId = ch.id;
        }
        await new Promise((res, rej) => {
          const ff = spawn(ffmpegPath, [
            '-y',
            '-i',
            input,
            '-vn',
            '-map_metadata',
            '-1',
            '-c:a',
            'libopus',
            '-b:a',
            '64k',
            '-ar',
            '48000',
            '-ac',
            '1',
            '-application',
            'voip',
            ogg,
          ]);
          ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg a esuat (fisier audio invalid?)'))));
          ff.on('error', rej);
        });
        const pcm = await new Promise((res, rej) => {
          const chunks = [];
          const ff = spawn(ffmpegPath, ['-i', ogg, '-f', 's16le', '-ac', '1', '-ar', '8000', '-']);
          ff.stdout.on('data', (d) => chunks.push(d));
          ff.on('close', () => res(Buffer.concat(chunks)));
          ff.on('error', rej);
        });
        const samples = Math.floor(pcm.length / 2);
        const duration = Math.max(0.1, samples / 8000);
        const points = Math.max(1, Math.min(256, Math.floor(duration * 10)));
        const per = Math.max(1, Math.floor(samples / points));
        const wf = Buffer.alloc(points);
        let maxPeak = 1;
        const peaks = [];
        for (let i = 0; i < points; i++) {
          let pk = 0;
          for (let j = i * per; j < Math.min(samples, (i + 1) * per); j++) {
            const v = Math.abs(pcm.readInt16LE(j * 2));
            if (v > pk) pk = v;
          }
          peaks.push(pk);
          if (pk > maxPeak) maxPeak = pk;
        }
        for (let i = 0; i < points; i++) wf[i] = Math.round((peaks[i] / maxPeak) * 255);
        const data = fs.readFileSync(ogg);
        const up = await axios.post(
          `https://discord.com/api/v9/channels/${channelId}/attachments`,
          {
            files: [
              {
                filename: 'voice-message.ogg',
                file_size: data.length,
                id: '0',
                is_clip: false,
              },
            ],
          },
          {
            headers: {
              ...H,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        );
        const slot = up.data.attachments[0];
        await axios.put(slot.upload_url, data, {
          headers: {
            'Content-Type': 'audio/ogg',
          },
          maxBodyLength: Infinity,
          timeout: 60000,
        });
        await axios.post(
          `https://discord.com/api/v9/channels/${channelId}/messages`,
          {
            content: '',
            channel_id: channelId,
            type: 0,
            flags: 8192,
            attachments: [
              {
                id: '0',
                channel_id: channelId,
                filename: 'voice-message.ogg',
                uploaded_filename: slot.upload_filename,
                duration_secs: Number(duration.toFixed(2)),
                waveform: wf.toString('base64'),
              },
            ],
          },
          {
            headers: {
              ...H,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        );
      } catch (e) {
        const m = e.response?.data?.message || e.message;
        await safeSend(ctx.channel, `voice error: ${m}`);
      }
      clean();
      return;
    }
    if (cmd === 'mp3') {
      if (!args.length) {
        await safeSend(ctx.channel, 'mp3 [url]');
        return;
      }
      const url = args[0];
      const os = require('os');
      const base = path.join(os.tmpdir(), `finessemp3_${Date.now()}`);
      const outTemplate = base + '.%(ext)s';
      const finalMp3 = base + '.mp3';
      const statusMsg = await safeSend(ctx.channel, `descarc: ${url.slice(0, 60)}...`);
      const runYtdlp = (bin) =>
        new Promise((resolve) => {
          const proc = spawn(
            bin,
            [
              '-x',
              '--audio-format',
              'mp3',
              '--audio-quality',
              '0',
              '--no-playlist',
              '--max-filesize',
              '24m',
              '--no-warnings',
              '--ffmpeg-location',
              ffmpegPath,
              '-o',
              outTemplate,
              url,
            ],
            {
              timeout: 180000,
            },
          );
          let stderr = '';
          proc.stderr?.on('data', (d) => {
            stderr += d.toString();
          });
          proc.on('close', (code) =>
            resolve(
              code === 0
                ? {
                    ok: true,
                  }
                : {
                    ok: false,
                    err: stderr.slice(-250),
                  },
            ),
          );
          proc.on('error', (e) =>
            resolve({
              ok: false,
              err: e.message,
            }),
          );
        });
      const runDirect = () =>
        new Promise(async (resolve) => {
          try {
            const resp = await axios.get(url, {
              responseType: 'arraybuffer',
              timeout: 120000,
              maxContentLength: 60 * 1024 * 1024,
              headers: {
                'User-Agent': 'Mozilla/5.0',
              },
            });
            const ctype = String(resp.headers?.['content-type'] || '');
            const buf = Buffer.from(resp.data);
            if (
              /text\/html/i.test(ctype) ||
              buf.slice(0, 15).toString('utf8').toLowerCase().includes('<doctype')
            ) {
              resolve({
                ok: false,
                err: 'link is not a direct media file (yt-dlp missing or unsupported site)',
              });
              return;
            }
            const raw = base + '.raw';
            fs.writeFileSync(raw, buf);
            const ff = spawn(ffmpegPath, [
              '-y',
              '-i',
              raw,
              '-vn',
              '-map',
              'a:0?',
              '-c:a',
              'libmp3lame',
              '-b:a',
              '128k',
              finalMp3,
            ]);
            let err = '';
            ff.stderr.on('data', (d) => {
              err += d.toString();
            });
            ff.on('close', (code) => {
              try {
                fs.unlinkSync(raw);
              } catch {}
              const okFile = fs.existsSync(finalMp3) && fs.statSync(finalMp3).size > 1024;
              if (code === 0 && okFile) {
                resolve({
                  ok: true,
                });
                return;
              }
              try {
                if (fs.existsSync(finalMp3)) fs.unlinkSync(finalMp3);
              } catch {}
              if (/does not contain any stream|Output file #0 does not contain/i.test(err)) {
                resolve({
                  ok: false,
                  err: 'downloaded file contains no audio (only video/image)',
                });
              } else {
                resolve({
                  ok: false,
                  err: err.slice(-250),
                });
              }
            });
            ff.on('error', (e) =>
              resolve({
                ok: false,
                err: e.message,
              }),
            );
          } catch (e) {
            resolve({
              ok: false,
              err: e.message,
            });
          }
        });
      const runPyYtdlp = () =>
        new Promise((resolve) => {
          const proc = spawn('python3', [
            '-m',
            'yt_dlp',
            '-x',
            '--audio-format',
            'mp3',
            '--audio-quality',
            '0',
            '--no-playlist',
            '--max-filesize',
            '24m',
            '--no-warnings',
            '--ffmpeg-location',
            ffmpegPath,
            '-o',
            outTemplate,
            url,
          ]);
          let stderr = '';
          proc.stderr?.on('data', (d) => {
            stderr += d.toString();
          });
          proc.on('close', (code) =>
            resolve(
              code === 0
                ? {
                    ok: true,
                  }
                : {
                    ok: false,
                    err: stderr.slice(-250),
                  },
            ),
          );
          proc.on('error', (e) =>
            resolve({
              ok: false,
              err: e.message,
            }),
          );
        });
      let res = await runYtdlp('yt-dlp');
      if (!res.ok) res = await runYtdlp('yt-dlp.exe');
      if (!res.ok) res = await runPyYtdlp();
      if (!res.ok) res = await runDirect();
      if (!res.ok) {
        await statusMsg?.edit(`-# download error: ${String(res.err).slice(0, 150)}`).catch(() => {});
        return;
      }
      let found = fs.existsSync(finalMp3) ? finalMp3 : null;
      if (!found) {
        const dir = os.tmpdir();
        const bname = path.basename(base);
        const match = fs.readdirSync(dir).find((f) => f.startsWith(bname) && AUDIO_RE.test(f));
        found = match ? path.join(dir, match) : null;
      }
      if (!found || !fs.existsSync(found)) {
        await statusMsg?.edit('-# the file could not be generated').catch(() => {});
        return;
      }
      const sizeMb = fs.statSync(found).size / 1024 / 1024;
      if (sizeMb > 24) {
        try {
          fs.unlinkSync(found);
        } catch {}
        await statusMsg?.edit(`-# fisier prea mare (${sizeMb.toFixed(1)}MB > 24MB)`).catch(() => {});
        return;
      }
      try {
        const oggPath = base + '.ogg';
        await new Promise((resolve) => {
          const ff = spawn(ffmpegPath, [
            '-y',
            '-i',
            found,
            '-vn',
            '-c:a',
            'libopus',
            '-b:a',
            '96k',
            '-ar',
            '48000',
            '-ac',
            '1',
            '-af',
            'volume=1.6',
            oggPath,
          ]);
          ff.on('close', () => resolve());
          ff.on('error', () => resolve());
        });
        const sendPath = fs.existsSync(oggPath) && fs.statSync(oggPath).size > 0 ? oggPath : found;
        const sendName = sendPath.endsWith('.ogg') ? 'voice-message.ogg' : 'audio.mp3';
        await ctx.channel.send({
          files: [new MessageAttachment(sendPath, sendName)],
        });
        await statusMsg?.edit('-# vocal trimis').catch(() => {});
        try {
          fs.unlinkSync(oggPath);
        } catch {}
      } catch (e) {
        await statusMsg?.edit(`-# sending error: ${e.message}`).catch(() => {});
      }
      try {
        fs.unlinkSync(found);
      } catch {}
      return;
    }
  }
  async function handleExclamation(message, cmd, args) {
    const ctx = message;
    async function safeSend(content) {
      try {
        const text =
          typeof content === 'string' && content.trim() && !content.startsWith('-# ')
            ? '-# ' + content.split('\n').join('\n-# ')
            : content;
        const msg = await ctx.channel.send(text);
      } catch {}
    }
    const GUILD_ONLY = [];
    if (!ctx.guild && GUILD_ONLY.includes(cmd)) {
      await safeSend('this command only works in servers');
      return;
    }
    if (cmd === 'join') {
      await ctx.channel.send(VOICE_TAGLINE).catch(() => {});
      const channelId = args[0] || null;
      const filenameArg = args[1] || null;
      let channel;
      if (!channelId) {
        if (!ctx.member?.voice?.channel)
          return safeSend("you're not in voice. specify: join [voiceID] [file]");
        channel = ctx.member.voice.channel;
      } else {
        try {
          channel = botClient.channels.cache.get(channelId) || (await botClient.channels.fetch(channelId));
          if (!channel) return safeSend(`channel not found: ${channelId}`);
          if (!['GUILD_VOICE', 'GUILD_STAGE_VOICE'].includes(channel.type))
            return safeSend(`${channelId} is not a voice channel`);
        } catch (err) {
          return safeSend(`error: ${err.message}`);
        }
      }
      let audioPath = null;
      if (filenameArg) {
        audioPath = findAudioFile(filenameArg);
        if (!audioPath) return safeSend(`fisierul "${filenameArg}" doesn't exist, use !files`);
      } else {
        const files = listAudioFiles();
        if (files.length) audioPath = files[0];
        else return safeSend('no audio files in hosting (archive/ or root)');
      }
      const vs = getVoiceState(channel && channel.guild ? channel.guild.id : ctx.guild?.id);
      if (vs.connection?.state?.status === VoiceConnectionStatus.Ready)
        return safeSend('already in voice, use leave first');
      try {
        if (vs.connection) {
          vs.loop = false;
          try {
            vs.player?.stop(true);
          } catch {}
          try {
            vs.connection.destroy();
          } catch {}
          vs.connection = null;
          await sleep(500);
        }
        const connection = joinVoiceChannel({
          group: VOICE_GROUP,
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: ctx.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false,
        });
        const player = createAudioPlayer();
        vs.connection = connection;
        vs.player = player;
        vs.currentFile = audioPath;
        vs.loop = true;
        if (!vs.volume) vs.volume = 150;
        connection.on('error', (err) => console.error('[VOICE]', err.message));
        player.on('error', (err) => {
          console.error('[PLAYER]', err.message);
          if (vs.loop && vs.currentFile && vs.connection?.state?.status === VoiceConnectionStatus.Ready) {
            setTimeout(() => {
              try {
                player.play(buildAudioResource(vs.currentFile, vs.volume));
              } catch {}
            }, 1000);
          }
        });
        connection.once(VoiceConnectionStatus.Ready, () => {
          try {
            connection.rejoin({
              channelId: connection.joinConfig.channelId,
              selfDeaf: true,
              selfMute: false,
            });
          } catch {}
          connection.subscribe(player);
          playLoop(vs);
          try {
            ctx.channel.send('-# Go hard with Finesse');
          } catch {}
        });
      } catch (err) {
        await safeSend(`error: ${err.message}`);
      }
      return;
    }
    if (cmd === 'partaj' || cmd === 'partaon' || cmd === 'camera' || cmd === 'cam') {
      const shareMode = cmd === 'camera' || cmd === 'cam' ? 'camera' : 'go-live';
      const imgUrl = args.find((a) => /^https?:\/\//i.test(a)) || null;
      let chanId = args.find((a) => /^\d{15,25}$/.test(a)) || null;
      let guildId = ctx.guild?.id || null;
      if (!chanId) {
        chanId = ctx.member?.voice?.channel?.id || (guildId ? getVoiceState(guildId).connection?.joinConfig?.channelId : null);
      }
      if (!chanId) return safeSend('join a voice channel or use: partaj <channel_id> [image/video URL]');
      try {
        const ch = await botClient.channels.fetch(chanId).catch(() => null);
        if (!ch) return safeSend('cannot find voice channel (wrong ID or no access)');
        if (ch.type !== 2 && ch.type !== 'GUILD_VOICE' && !ch.isVoiceBased?.()) return safeSend('that ID is not a voice channel');
        guildId = ch.guild?.id || guildId;
      } catch {}
      if (!guildId) return safeSend('cannot determine the server for that voice channel');
      const res = await startScreenShare(guildId, chanId, imgUrl, shareMode);
      return safeSend(res.msg);
    }
    if (cmd === 'partaoff' || cmd === 'cameraoff' || cmd === 'camoff') {
      const guildId = ctx.guild?.id || [...screenShares.keys()][0];
      if (!guildId) return safeSend('nothing is being shared');
      const res = await stopScreenShare(guildId);
      return safeSend(res.msg);
    }
    if (cmd === 'def' || cmd === 'undef' || cmd === 'mute' || cmd === 'unmute') {
      let vs =
        ctx.guild && voiceStates[ctx.guild.id] && voiceStates[ctx.guild.id].connection
          ? voiceStates[ctx.guild.id]
          : Object.values(voiceStates).find((v) => v && v.connection);
      if (!vs || !vs.connection) return safeSend("i'm not in voice");
      if (cmd === 'def') vs.selfDeaf = true;
      if (cmd === 'undef') vs.selfDeaf = false;
      if (cmd === 'mute') vs.selfMute = true;
      if (cmd === 'unmute') vs.selfMute = false;
      try {
        vs.connection.rejoin({
          channelId: vs.connection.joinConfig.channelId,
          selfDeaf: !!vs.selfDeaf,
          selfMute: !!vs.selfMute,
        });
      } catch (e) {
        return safeSend('error: ' + e.message);
      }
      return safeSend(
        'voice: ' + (vs.selfDeaf ? 'deafen' : 'auzi') + ' | ' + (vs.selfMute ? 'mute' : 'unmute'),
      );
    }
    if (cmd === 'stop') {
      const vs = activeVs(ctx);
      if (!vs.connection || vs.connection.state.status !== VoiceConnectionStatus.Ready)
        return safeSend("i'm not in voice");
      vs.loop = false;
      if (vs.player?.state?.status !== AudioPlayerStatus.Idle) vs.player.stop();
      vs.currentFile = null;
      await safeSend('oprit');
      return;
    }
    if (cmd === 'leave') {
      const vs = activeVs(ctx);
      if (!vs.connection) return safeSend("i'm not in voice");
      vs.loop = false;
      if (vs.player) {
        vs.player.stop();
        vs.player = null;
      }
      try {
        vs.connection.destroy();
      } catch {}
      vs.connection = null;
      vs.currentFile = null;
      await safeSend('left voice');
      return;
    }
    if (cmd === 'files' || cmd === 'arhiva') {
      let files = [];
      try {
        files = listAudioFiles(true);
      } catch (e) {
        await ctx.channel.send('-# scanning error: ' + e.message).catch(() => {});
        return;
      }
      if (!files.length) {
        await ctx.channel.send(
          "-# couldn't find any audio files in hosting\n-# searched in: " +
            [ARHIVA_DIR, CRFILES_DIR, __dirname, process.cwd(), '/home/container', '/app'].join(' , '),
        );
        return;
      }
      const lines = files.map((f) => path.basename(f));
      const chunks = [];
      let buf = '-# fisiere';
      for (const l of lines) {
        const add = '\n-# ' + l;
        if (buf.length + add.length > 1900) {
          chunks.push(buf);
          buf = '-# ' + l;
        } else buf += add;
      }
      chunks.push(buf);
      for (const c of chunks) {
        try {
          await ctx.channel.send(c);
        } catch (e) {
          console.error('[arhiva send]', e.message);
        }
      }
      return;
    }
    if (cmd === 'volume') {
      await ctx.channel.send(VOICE_TAGLINE).catch(() => {});
      if (!args.length || !/^\d+$/.test(args[0])) return safeSend('volume [1-500]');
      const vol = parseInt(args[0]);
      if (vol < 1 || vol > 500) return safeSend('volume [1-500]');
      const vs = activeVs(ctx);
      vs.volume = vol;
      if (vs.player && vs.currentFile && vs.connection?.state?.status === VoiceConnectionStatus.Ready) {
        if (vs.player.state.status !== AudioPlayerStatus.Idle) vs.player.stop();
      }
      await safeSend(`volum setat: ${vol}%`);
      return;
    }
    if (cmd === 'status') {
      let vs;
      if (ctx.guild) vs = getVoiceState(ctx.guild.id);
      else
        vs =
          Object.values(voiceStates).find(
            (v) => v?.connection?.state?.status === VoiceConnectionStatus.Ready,
          ) || {};
      if (!vs.connection || vs.connection.state.status !== VoiceConnectionStatus.Ready)
        return safeSend("i'm not in voice");
      const ch = vs.connection.joinConfig?.channelId ? `<#${vs.connection.joinConfig.channelId}>` : '?';
      await safeSend(
        `channel: ${ch} | reda: ${vs.currentFile ? path.basename(vs.currentFile) : 'nimic'} | volum: ${vs.volume}% | loop: ${vs.loop ? 'on' : 'off'}`,
      );
      return;
    }
    await safeSend(`command !${cmd} doesn't exist. try !help`);
  }
  (async function tryLogin(attempts = 0) {
    try {
      await botClient.login(token);
    } catch (err) {
      console.error(`[LOGIN] Esec (attempt ${attempts + 1}): ${err.message}`);
      if (
        err.code === 'TOKEN_INVALID' ||
        /invalid token|improper token|TOKEN_INVALID/i.test(err.message || '')
      ) {
        console.error('[LOGIN] Invalid token — not retrying');
        activeBots.delete(token);
        return;
      }
      if (attempts < 5) {
        const delay = Math.min(30000, 5000 * Math.pow(2, attempts));
        console.log(`[LOGIN] Retry in ${delay / 1000}s...`);
        setTimeout(() => tryLogin(attempts + 1), delay);
      } else {
        console.error('[LOGIN] Prea multe esecuri — renunt');
        activeBots.delete(token);
      }
    }
  })();
  return botClient;
}
createBot(TOKEN, {
  index: 1,
  commands: true,
});
savedTokens
  .filter((e) => e && e.token && e.token !== TOKEN && e.index >= 2 && e.index <= 20)
  .sort((a, b) => a.index - b.index)
  .forEach((e, i) =>
    setTimeout(
      () => {
        try {
          createBot(e.token, {
            index: e.index,
            commands: !!e.commands,
          });
        } catch (err) {
          console.error('[index ' + e.index + ']', err.message);
        }
      },
      3000 * (i + 1),
    ),
  );
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>14 Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f0f13;color:#e2e8f0;font-family:'Segoe UI',sans-serif;min-height:100vh;padding:20px}
h1{font-size:1.4rem;font-weight:700;color:#a78bfa;margin-bottom:18px;letter-spacing:.5px}
.card{background:#1a1a24;border:1px solid #2d2d40;border-radius:12px;padding:18px;margin-bottom:16px}
.card h2{font-size:.85rem;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;margin-bottom:12px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
label{font-size:.8rem;color:#94a3b8;min-width:80px}
input,select{background:#0f0f18;border:1px solid #2d2d40;border-radius:6px;color:#e2e8f0;padding:6px 10px;font-size:.85rem;outline:none;flex:1;min-width:120px}
input:focus,select:focus{border-color:#7c3aed}
button{background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:.83rem;font-weight:600;transition:background .15s}
button:hover{background:#6d28d9}
button.red{background:#dc2626}button.red:hover{background:#b91c1c}
button.gray{background:#374151}button.gray:hover{background:#4b5563}
.dot{width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px;vertical-align:middle}
.dot.off{background:#ef4444}
#vs{font-size:.82rem;color:#94a3b8;margin-top:6px;min-height:18px}
#vs span{color:#e2e8f0;font-weight:600}
#log{background:#0a0a10;border:1px solid #1e1e2e;border-radius:8px;padding:12px;height:160px;overflow-y:auto;font-size:.78rem;font-family:monospace}
#log p{margin:2px 0;line-height:1.5}
#log p.ok{color:#4ade80}
#log p.err{color:#f87171}
#log p.info{color:#94a3b8}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{background:#1e1e2e;border:1px solid #2d2d40;border-radius:20px;padding:3px 12px;font-size:.75rem;cursor:pointer;transition:background .1s}
.chip:hover{background:#2d2d40}
.vol-row{display:flex;align-items:center;gap:8px}
input[type=range]{flex:1;accent-color:#7c3aed}
#vv{min-width:34px;text-align:right;font-size:.83rem;color:#a78bfa}
@media(max-width:500px){.row{flex-direction:column;align-items:stretch}}
</style>
</head>
<body>
<h1>14 Dashboard</h1>
<div class="card">
<h2>Status</h2>
<div class="row" style="align-items:center">
<span><span class="dot" id="sd"></span><b id="btag">...</b></span>
<select id="gSel" onchange="onGuildChange()" style="flex:1;max-width:280px"></select>
</div>
<div id="vs">Loading...</div>
</div>
<div class="card">
<h2>Voice</h2>
<div class="row">
<label>Channel ID</label>
<input id="chId" placeholder="Voice channel ID" />
</div>
<div class="row">
<label>File</label>
<select id="fJoin"><option value="">-- choose file --</option></select>
</div>
<div class="row">
<button onclick="doApi('join')">Join + Play</button>
<button onclick="doApi('stop')" class="gray">Stop</button>
<button onclick="doApi('leave')" class="red">Leave</button>
</div>
</div>
<div class="card">
<h2>Playback</h2>
<div class="row">
<label>File</label>
<select id="fPlay"><option value="">-- choose file --</option></select>
</div>
<div class="row">
<button onclick="doApi('play')">Play</button>
</div>
<div class="vol-row" style="margin-top:10px">
<label style="min-width:60px">Volume</label>
<input type="range" min="1" max="100" value="100" id="vol" oninput="document.getElementById('vv').textContent=this.value+'%'">
<span id="vv">100%</span>
<button onclick="doApi('volume')" class="gray" style="padding:5px 12px">Set</button>
</div>
<div class="chips" id="chips"></div>
</div>
<div class="card">
<h2>Log</h2>
<div id="log"></div>
</div>
<script>
let guilds=[], lastFiles=[];
function gId(){return document.getElementById('gSel').value;}
function log(msg,type='info'){const el=document.getElementById('log');const p=document.createElement('p');p.className=type;p.textContent=new Date().toLocaleTimeString('en-US')+' '+msg;el.appendChild(p);el.scrollTop=el.scrollHeight;}
function onGuildChange(){refreshStatus();}
async function doApi(action){
const g=gId();if(!g){log('Choose a server!','err');return;}
const body={guildId:g};
if(action==='join'){body.channelId=document.getElementById('chId').value.trim();body.file=document.getElementById('fJoin').value;if(!body.channelId){log('Enter the voice channel ID!','err');return;}}
if(action==='play'){body.file=document.getElementById('fPlay').value;if(!body.file){log('Choose a file!','err');return;}}
if(action==='volume')body.vol=document.getElementById('vol').value;
try{const r=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();log(d.msg||(d.ok?'OK':'Error'),d.ok?'ok':'err');}
catch(e){log('Error: '+e.message,'err');}
}
function selectFile(f){document.getElementById('fPlay').value=f;log('Selected: '+f,'info');}
async function refreshStatus(){
try{
const r=await fetch('/api/status');const d=await r.json();
document.getElementById('sd').className='dot';
document.getElementById('btag').textContent=d.bot?.tag||'online';
if(d.guilds?.length!==guilds.length){guilds=d.guilds||[];const s=document.getElementById('gSel');s.innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+g.name+' ('+g.id+')</option>').join('');}
const g=gId();
if(g&&d.voiceStatuses?.[g]){const vs=d.voiceStatuses[g];document.getElementById('vs').innerHTML=vs.connected?'Connected &nbsp;|&nbsp; Playing: <span>'+(vs.file||'nothing')+'</span> &nbsp;|&nbsp; Volume: <span>'+vs.volume+'%</span> &nbsp;|&nbsp; Loop: <span>'+(vs.loop?'ON':'OFF')+'</span>':'Status: <span>Disconnected</span>';document.getElementById('vol').value=vs.volume||100;document.getElementById('vv').textContent=(vs.volume||100)+'%';}
}catch{document.getElementById('sd').className='dot off';document.getElementById('btag').textContent='offline';}
}
async function refreshFiles(){
try{
const r=await fetch('/api/files');const d=await r.json();const files=d.files||[];
if(JSON.stringify(files)===JSON.stringify(lastFiles))return;lastFiles=files;
const opts='<option value="">-- choose file --</option>'+files.map(f=>'<option>'+f+'</option>').join('');
document.getElementById('fJoin').innerHTML=opts;document.getElementById('fPlay').innerHTML=opts;
const chips=document.getElementById('chips');
chips.innerHTML=files.length?files.map(f=>'<div class="chip" onclick="selectFile(\\''+f+'\\')">'+f+'</div>').join(''):'<span style="color:#374151;font-size:12px">No files in archive/</span>';
}catch{}
}
refreshFiles();refreshStatus();
setInterval(refreshStatus,3000);setInterval(refreshFiles,10000);
</script>
</body>
</html>`;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || process.env.PORT || '3000', 10);
const dashServer = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (u.pathname === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(DASHBOARD_HTML);
    return;
  }
  const ctrl = botControls.get(TOKEN);
  if (u.pathname === '/ytm/update') {
    if (u.searchParams.get('key') !== getYtmKey()) {
      res.writeHead(403);
      res.end('bad key');
      return;
    }
    let d = {};
    if (req.method === 'POST')
      d = await new Promise((r) => {
        let b = '';
        req.on('data', (c) => {
          b += c;
          if (b.length > 20000) req.destroy();
        });
        req.on('end', () => {
          try {
            r(JSON.parse(b));
          } catch {
            r({});
          }
        });
      });
    for (const c of botControls.values()) {
      try {
        await c.ytmUpdate?.(d);
      } catch {}
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end('{"ok":true}');
    return;
  }
  if (u.pathname === '/ytm/script.user.js') {
    if (u.searchParams.get('key') !== getYtmKey()) {
      res.writeHead(403);
      res.end('bad key');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
    });
    res.end(ytmUserscript());
    return;
  }
  if (u.pathname === '/spotify/callback') {
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    const expiry = state ? spotifyOauthStates.get(state) : 0;
    if (!code || !state || !expiry || expiry < Date.now()) {
      res.writeHead(400, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('Invalid or expired login. Run spotifyconnect again.');
      return;
    }
    spotifyOauthStates.delete(state);
    try {
      await exchangeSpotifyCode(code);
      ctrl?.startSpotifySync?.();
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('Spotify conectat. Poti inchide pagina.');
    } catch (e) {
      console.error('[spotify callback]', e.response?.data || e.message);
      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end("Spotify couldn't connect. Check the app settings.");
    }
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  let body = {};
  if (req.method === 'POST') {
    body = await new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => (d += c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch {
          resolve({});
        }
      });
    });
  }
  if (u.pathname === '/api/status') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          bot: null,
          guilds: [],
          voiceStatuses: {},
        }),
      );
      return;
    }
    const guilds = ctrl.getGuilds();
    const voiceStatuses = {};
    for (const g of guilds) voiceStatuses[g.id] = ctrl.getVoiceStatus(g.id);
    res.end(
      JSON.stringify({
        bot: ctrl.getBotUser(),
        guilds,
        voiceStatuses,
      }),
    );
    return;
  }
  if (u.pathname === '/api/files') {
    res.end(
      JSON.stringify({
        files: ctrl?.getFiles() || [],
      }),
    );
    return;
  }
  if (u.pathname === '/api/join') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          ok: false,
          msg: 'Bot offline',
        }),
      );
      return;
    }
    const r = await ctrl.join(body.channelId, body.guildId, body.file || null);
    res.end(JSON.stringify(r));
    return;
  }
  if (u.pathname === '/api/play') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          ok: false,
          msg: 'Bot offline',
        }),
      );
      return;
    }
    const r = await ctrl.play(body.guildId, body.file);
    res.end(JSON.stringify(r));
    return;
  }
  if (u.pathname === '/api/stop') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          ok: false,
          msg: 'Bot offline',
        }),
      );
      return;
    }
    const r = ctrl.stop(body.guildId);
    res.end(JSON.stringify(r));
    return;
  }
  if (u.pathname === '/api/leave') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          ok: false,
          msg: 'Bot offline',
        }),
      );
      return;
    }
    const r = ctrl.leave(body.guildId);
    res.end(JSON.stringify(r));
    return;
  }
  if (u.pathname === '/api/volume') {
    if (!ctrl) {
      res.end(
        JSON.stringify({
          ok: false,
          msg: 'Bot offline',
        }),
      );
      return;
    }
    const r = ctrl.volume(body.guildId, body.vol);
    res.end(JSON.stringify(r));
    return;
  }
  res.writeHead(404);
  res.end(
    JSON.stringify({
      error: 'not found',
    }),
  );
});
dashServer.on('error', (err) => console.error('[Dashboard]', err.message));
dashServer.listen(DASHBOARD_PORT, '0.0.0.0', () => {
  console.log(`dashboard started on port ${DASHBOARD_PORT}`);
});
let consoleChannelId = process.env.CONSOLE_CHANNEL_ID || null;
function makeConsoleChannel(idx) {
  const tag = '[index ' + idx + '] ';
  const fakeMsg = {
    id: 'console',
    content: '',
    edit: async (t) => {
      consoleOut(tag, t);
      return fakeMsg;
    },
    delete: async () => {},
    react: async () => {},
  };
  return {
    id: 'console-' + idx,
    type: 'DM',
    guild: null,
    isText: () => true,
    send: async (t) => {
      consoleOut(tag, t);
      return fakeMsg;
    },
    sendTyping: async () => {},
    messages: {
      fetch: async () => new Map(),
      cache: new Map(),
    },
  };
}
function consoleOut(tag, t) {
  let txt = '';
  if (typeof t === 'string') txt = t;
  else if (t && typeof t === 'object') {
    txt = t.content || '';
    for (const e of t.embeds || []) {
      const d = e?.data || e || {};
      txt +=
        (txt ? '\n' : '') +
        [d.title, d.description, ...(d.fields || []).map((f) => f.name + ': ' + f.value)]
          .filter(Boolean)
          .join('\n');
    }
    if (t.files?.length) txt += (txt ? '\n' : '') + '(fisier atasat: ' + t.files.length + ')';
  }
  console.log(tag + String(txt || 'ok').replace(/\*\*/g, ''));
}
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});
rl.on('line', async (line) => {
  let parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return;
  let first = parts[0].toLowerCase();
  if ('$=!'.includes(first[0])) {
    first = first.slice(1);
    parts[0] = parts[0].slice(1);
  }
  if (first === 'help' && parts.length === 1) {
    console.log('Other commands: conturi = accounts list; canal <ID|off> = command channel; help = help.');
    return;
  }
  if (first === 'conturi' || first === 'indexuri') {
    const list = [...botIndexes.values()].sort((a, b) => a.index - b.index);
    if (!list.length) {
      console.log('no account connected');
      return;
    }
    list.forEach((b) => console.log('index ' + b.index + ': ' + (b.client?.user?.tag || b.tag)));
    return;
  }
  if (first === 'canal' || first === 'channel') {
    const raw = (parts[1] || '').toLowerCase();
    const v = raw === 'off' ? '' : (parts[1] || '').replace(/\D/g, '');
    consoleChannelId = v || null;
    console.log(
      consoleChannelId ? 'Command channel: ' + consoleChannelId : 'Commands will stay in the terminal.',
    );
    return;
  }
  console.log('Unknown or unavailable command in the restored CLI. Type help.');
});
