export const TARGET_RATE = 44100;
export const TARGET_CHANNELS = 1;
export const TARGET_BITS = 16;
export const PEAK_TARGET_DB = -1.5;
export const DEFAULT_TAIL_MS = 300;
export const NIGHTWALKER_CATALOG_URL = 'https://raw.githubusercontent.com/matthewcodergamer/Rdr2vampire/main/content/Nightwalker.dialogue';
export const NIGHTWALKER_SUPPLEMENT_URL = 'https://raw.githubusercontent.com/matthewcodergamer/Rdr2vampire/main/Nightwalker.voice.dialogue';

export const state = {
  items: [],
  selectedId: null,
  catalog: [],
  catalogRaw: '',
  supplement: [],
  projectVersion: 1,
  buildNumber: 0,
};

export const $ = (id) => document.getElementById(id);

export const els = {
  audioInput: $('audioInput'), chooseFilesBtn: $('chooseFilesBtn'), dropzone: $('dropzone'),
  fileList: $('fileList'), emptyState: $('emptyState'), fileCount: $('fileCount'),
  selectAllBtn: $('selectAllBtn'), autoMatchBtn: $('autoMatchBtn'), clearQueueBtn: $('clearQueueBtn'),
  loadCatalogBtn: $('loadCatalogBtn'), catalogInput: $('catalogInput'), importProjectBtn: $('importProjectBtn'), projectInput: $('projectInput'),
  noSelection: $('noSelection'), editorContent: $('editorContent'), matchState: $('matchState'),
  selectedFileName: $('selectedFileName'), selectedAudioMeta: $('selectedAudioMeta'), previewBtn: $('previewBtn'), waveform: $('waveform'),
  transcriptField: $('transcriptField'), familyField: $('familyField'), speakerField: $('speakerField'), audioIdField: $('audioIdField'),
  sequenceIdField: $('sequenceIdField'), lineIdField: $('lineIdField'), textIdField: $('textIdField'), orderField: $('orderField'), tailField: $('tailField'),
  regenerateIdsBtn: $('regenerateIdsBtn'), groupSelectedBtn: $('groupSelectedBtn'),
  batchNameField: $('batchNameField'), namespaceField: $('namespaceField'), trimToggle: $('trimToggle'), normalizeToggle: $('normalizeToggle'), patchTimingToggle: $('patchTimingToggle'),
  summaryFiles: $('summaryFiles'), summaryMatched: $('summaryMatched'), summaryCustom: $('summaryCustom'), summaryWarnings: $('summaryWarnings'), validationBox: $('validationBox'),
  buildZipBtn: $('buildZipBtn'), saveProjectBtn: $('saveProjectBtn'), buildState: $('buildState'), audioPlayer: $('audioPlayer'), toastRegion: $('toastRegion'),
};

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function slug(value, fallback = 'line') {
  const out = String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.');
  return out || fallback;
}

export function safeBatchSlug() {
  return slug(els.batchNameField.value || 'voice-batch', 'voice.batch').replace(/\./g, '_');
}

export function transcriptFromFilename(name) {
  let value = name.replace(/\.(mp3|wav)$/i, '');
  value = value.replace(/^Vam-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-/i, '');
  value = value.replace(/\s*\(\d+\)\s*$/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

export function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenScore(a, b) {
  const aa = normalizeText(a), bb = normalizeText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.length >= 12 && (bb.startsWith(aa) || aa.startsWith(bb))) return .94;
  if (aa.length >= 12 && bb.includes(aa)) return .9;
  const A = new Set(aa.split(' ')), B = new Set(bb.split(' '));
  let hit = 0; A.forEach((v) => { if (B.has(v)) hit += 1; });
  return hit / Math.max(A.size, B.size, 1);
}

export function inferFamily(text) {
  const t = normalizeText(text);
  const rules = [
    [/rare wisdom|turn around|heartbeat somewhere|go wisdom/, 'saint_denis.choice.leave'],
    [/aim|weapon|lower it|rehearse my death|hesitation|next words with greater care/, 'saint_denis.react.aim_hold'],
    [/blade|steel at arm|old distance/, 'saint_denis.react.melee_draw'],
    [/lasso|rope|bind/, 'saint_denis.react.lasso_draw'],
    [/throw it|danger at a distance|leave your hand/, 'saint_denis.react.thrown_draw'],
    [/knuckles|your hands|no steel|bones/, 'saint_denis.react.unarmed_start'],
    [/question|ask|names|truth|eternity|church|souls pressed|look around/, 'saint_denis.choice.question'],
  ];
  for (const [rx, family] of rules) if (rx.test(t)) return family;
  return 'saint_denis.pre_fight';
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

export function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = `toast ${error ? 'error' : ''}`;
  el.textContent = message;
  els.toastRegion.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
