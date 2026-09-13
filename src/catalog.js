import { state, els, tokenScore, normalizeText, inferFamily, slug, safeBatchSlug, NIGHTWALKER_CATALOG_URL, NIGHTWALKER_SUPPLEMENT_URL, toast } from './core.js';

export function parseDialogue(text, source = 'catalog') {
  const lines = [];
  String(text || '').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.startsWith('line=')) return;
    const parts = raw.slice(5).split('|');
    if (parts.length < 7) return;
    lines.push({sequenceId:parts[0],lineId:parts[1],speaker:parts[2],textId:parts[3],audioId:parts[4],durationMs:Number(parts[5])||0,text:parts.slice(6).join('|'),sourceLineIndex:index,source});
  });
  return lines;
}

export function applyCatalog(baseText, supplementText = '') {
  state.catalogRaw = baseText;
  state.catalog = parseDialogue(baseText, 'catalog');
  state.supplement = parseDialogue(supplementText, 'supplement');
}

export async function loadRemoteCatalog() {
  els.loadCatalogBtn.disabled = true; els.loadCatalogBtn.textContent = 'Loading…';
  try {
    const [baseResp, supplementResp] = await Promise.all([fetch(NIGHTWALKER_CATALOG_URL,{cache:'no-store'}),fetch(NIGHTWALKER_SUPPLEMENT_URL,{cache:'no-store'})]);
    if (!baseResp.ok) throw new Error(`Base catalog HTTP ${baseResp.status}`);
    applyCatalog(await baseResp.text(), supplementResp.ok ? await supplementResp.text() : '');
    toast(`Loaded ${state.catalog.length + state.supplement.length} Nightwalker lines.`);
    return true;
  } catch (error) {
    toast(`Could not load GitHub catalog: ${error.message}. You can import it manually.`, true);
    return false;
  } finally {
    els.loadCatalogBtn.disabled = false; els.loadCatalogBtn.textContent = 'Load Nightwalker catalog';
  }
}

export function familyFromSequence(sequenceId) {
  const families = [...els.familyField.options].map((o) => o.value).sort((a,b) => b.length - a.length);
  return families.find((family) => sequenceId === family || sequenceId.startsWith(family + '.')) || 'saint_denis.pre_fight';
}

export function bestMatch(text) {
  let best = null, bestScore = 0;
  for (const line of [...state.catalog, ...state.supplement]) {
    const score = tokenScore(text, line.text);
    if (score > bestScore) { best = line; bestScore = score; }
  }
  return bestScore >= .74 ? {line:best,score:bestScore} : null;
}

export function generateAudioId(item) {
  const ns = slug(els.namespaceField.value || 'nw.audio.sd', 'nw.audio.sd');
  const context = item.family.replace(/^saint_denis\./, '').replace(/_/g, '.');
  const words = slug(item.transcript || item.name, 'line').split('.').slice(0,5).join('.');
  const index = String(state.items.indexOf(item)+1).padStart(2,'0');
  return `${ns}.${context}.${safeBatchSlug()}.${words}.${index}`.replace(/\.{2,}/g,'.');
}

export function assignGeneratedIds(item) {
  item.family = item.family || inferFamily(item.transcript);
  item.audioId = generateAudioId(item);
  const index = String(Math.max(1,state.items.indexOf(item)+1)).padStart(2,'0');
  item.sequenceId = `${item.family}.${safeBatchSlug()}.${index}`;
  item.lineId = `vr2_${safeBatchSlug()}_${index}`;
  item.textId = `nw.${item.family.replace(/^saint_denis\./,'sd.').replace(/_/g,'.')}.${safeBatchSlug()}.${index}`;
}

export function matchItem(item) {
  const match = bestMatch(item.transcript);
  if (!match) { item.matchType='custom'; item.family=inferFamily(item.transcript); assignGeneratedIds(item); return; }
  const line=match.line, a=normalizeText(item.transcript), b=normalizeText(line.text);
  const partial = a !== b && (b.includes(a) || a.includes(b));
  if (partial && match.score < .97) {
    item.matchType='partial'; item.family=familyFromSequence(line.sequenceId); assignGeneratedIds(item);
    item.warning='Partial script match. Exported as a new supplemental line so it cannot collide with the base catalog.';
    return;
  }
  item.matchType='catalog'; item.matchScore=match.score; item.transcript=line.text; item.family=familyFromSequence(line.sequenceId);
  item.speaker=line.speaker||'THE VAMPIRE'; item.audioId=line.audioId||generateAudioId(item); item.sequenceId=line.sequenceId; item.lineId=line.lineId; item.textId=line.textId;
  item.catalogDurationMs=line.durationMs; item.sourceLineIndex=line.sourceLineIndex; item.sourceCatalog=line.source;
  item.warning=item.durationMs+item.tailMs>line.durationMs?'WAV is longer than the authored line; patched timing will be exported.':'';
}

export function autoMatchAll() { state.items.forEach(matchItem); }
