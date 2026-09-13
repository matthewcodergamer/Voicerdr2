import { TARGET_RATE, PEAK_TARGET_DB, els } from './core.js';

export async function processItemAudio(item) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('This browser does not expose Web Audio decoding.');
  const context = new AudioCtx();
  const buffer = await item.file.arrayBuffer();
  let decoded;
  try { decoded = await context.decodeAudioData(buffer.slice(0)); }
  finally { await context.close().catch(() => {}); }
  item.decoded = decoded;
  item.sourceDurationMs = Math.round(decoded.duration * 1000);
  item.samples = resampleMono(decoded, TARGET_RATE);
  rebuildWav(item);
  item.status = 'ready';
}

export function resampleMono(buffer, targetRate) {
  const sourceRate = buffer.sampleRate, channels = buffer.numberOfChannels, sourceLength = buffer.length;
  const outputLength = Math.max(1, Math.round(sourceLength * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const channelData = Array.from({length: channels}, (_, i) => buffer.getChannelData(i));
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < outputLength; i++) {
    const pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(i0 + 1, sourceLength - 1), frac = pos - i0;
    let sample = 0;
    for (let c = 0; c < channels; c++) sample += channelData[c][i0] + (channelData[c][i1] - channelData[c][i0]) * frac;
    output[i] = sample / channels;
  }
  return output;
}

export function trimSilence(samples, thresholdDb = -48, leadMs = 65, tailMs = 160) {
  const threshold = Math.pow(10, thresholdDb / 20);
  let start = 0, end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  if (start >= end) return samples;
  start = Math.max(0, start - Math.round(TARGET_RATE * leadMs / 1000));
  end = Math.min(samples.length - 1, end + Math.round(TARGET_RATE * tailMs / 1000));
  return samples.slice(start, end + 1);
}

export function normalizePeak(samples, targetDb = PEAK_TARGET_DB) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 1e-8) return {samples, peakDb: -Infinity};
  const target = Math.pow(10, targetDb / 20), gain = Math.min(target / peak, Math.pow(10, 12 / 20));
  const out = new Float32Array(samples.length); let postPeak = 0;
  for (let i = 0; i < samples.length; i++) { out[i] = Math.max(-1, Math.min(1, samples[i] * gain)); postPeak = Math.max(postPeak, Math.abs(out[i])); }
  return {samples: out, peakDb: 20 * Math.log10(postPeak || 1e-8)};
}

export function rebuildWav(item) {
  if (!item.samples) return;
  let samples = item.samples;
  if (els.trimToggle.checked) samples = trimSilence(samples);
  let peakDb = null;
  if (els.normalizeToggle.checked) { const normalized = normalizePeak(samples); samples = normalized.samples; peakDb = normalized.peakDb; }
  item.processedSamples = samples;
  item.durationMs = Math.round(samples.length / TARGET_RATE * 1000);
  item.peakDb = peakDb;
  item.wavBlob = encodeWav(samples, TARGET_RATE);
  if (item.matchType === 'catalog' && item.catalogDurationMs && item.durationMs + item.tailMs > item.catalogDurationMs) item.warning = 'WAV is longer than the authored line; patched timing will be exported.';
}

export function rebuildAll(items) { items.forEach(rebuildWav); }

export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i])); view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], {type:'audio/wav'});
}
