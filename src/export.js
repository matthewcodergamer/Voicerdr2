import { state, els, safeBatchSlug, TARGET_RATE, TARGET_CHANNELS, TARGET_BITS, toast } from './core.js';

export function validate() {
  const warnings=[], audioIds=new Set(), lineIds=new Set();
  state.items.forEach((item)=>{
    if(item.status==='error') warnings.push(`${item.name}: decode failed.`);
    if(!item.transcript.trim()) warnings.push(`${item.name}: missing transcript.`);
    if(!/^[a-z0-9._-]+$/i.test(item.audioId)) warnings.push(`${item.name}: unsafe audio ID.`);
    if(audioIds.has(item.audioId)) warnings.push(`Duplicate audio ID: ${item.audioId}`); audioIds.add(item.audioId);
    if(lineIds.has(item.lineId)&&item.matchType!=='catalog') warnings.push(`Duplicate line ID: ${item.lineId}`); lineIds.add(item.lineId);
    if(!item.wavBlob) warnings.push(`${item.name}: WAV not built yet.`);
  });
  return warnings;
}

export function buildManifest() {
  const unique=new Map(); state.items.forEach((item)=>unique.set(item.audioId,`asset=${item.audioId}|audio/${item.audioId}.wav`));
  return ['# VoiceRDR2 generated Nightwalker audio manifest','# schema 1','schema=1','',...unique.values(),''].join('\n');
}

export function buildSupplement() {
  const custom=state.items.filter((i)=>i.matchType!=='catalog'); if(!custom.length)return null;
  const ordered=[...custom].sort((a,b)=>a.sequenceId.localeCompare(b.sequenceId)||a.order-b.order);
  const lines=['# VoiceRDR2 generated supplemental dialogue','# Complete exchanges stay together.','schema=1',''];
  ordered.forEach((i)=>lines.push(`line=${i.sequenceId}|${i.lineId}|${i.speaker}|${i.textId}|${i.audioId}|${i.durationMs+i.tailMs}|${i.transcript.replace(/\|/g,'—')}`));
  lines.push(''); return lines.join('\n');
}

export function patchedCatalog() {
  if(!state.catalogRaw||!els.patchTimingToggle.checked)return null;
  const lines=state.catalogRaw.split(/\r?\n/); let changed=false;
  state.items.filter((i)=>i.matchType==='catalog'&&i.sourceCatalog==='catalog'&&i.sourceLineIndex!=null).forEach((item)=>{
    const idx=item.sourceLineIndex, raw=lines[idx]; if(!raw?.startsWith('line='))return;
    const parts=raw.slice(5).split('|'); if(parts.length<7)return;
    const needed=Math.max(Number(parts[5])||0,item.durationMs+item.tailMs);
    if(needed!==Number(parts[5])){parts[5]=String(needed);lines[idx]=`line=${parts.join('|')}`;changed=true;}
  });
  return changed?lines.join('\n'):null;
}

export function buildInventory() {
  return JSON.stringify({schema:1,tool:'VoiceRDR2',createdAt:new Date().toISOString(),batch:els.batchNameField.value,format:{sample_rate_hz:TARGET_RATE,channels:TARGET_CHANNELS,bits_per_sample:TARGET_BITS},assets:state.items.map((i)=>({source:i.name,audio_id:i.audioId,sequence_id:i.sequenceId,line_id:i.lineId,text:i.transcript,duration_ms:i.durationMs,tail_ms:i.tailMs,matched:i.matchType==='catalog'}))},null,2);
}

const utf8=(text)=>new TextEncoder().encode(text);
function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++){crc^=bytes[i];for(let j=0;j<8;j++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return(crc^0xffffffff)>>>0;}
function dosDateTime(date=new Date()){const year=Math.max(1980,date.getFullYear());return{time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),day:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};}
function concat(chunks){const total=chunks.reduce((n,c)=>n+c.length,0),out=new Uint8Array(total);let p=0;chunks.forEach(c=>{out.set(c,p);p+=c.length;});return out;}
const u16=(n)=>new Uint8Array([n&255,(n>>>8)&255]); const u32=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);

export function createZip(entries) {
  const local=[],central=[];let offset=0;const dt=dosDateTime();
  for(const entry of entries){const name=utf8(entry.name),data=entry.data instanceof Uint8Array?entry.data:new Uint8Array(entry.data),crc=crc32(data);const header=concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.day),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name]);local.push(header,data);central.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.day),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=header.length+data.length;}
  const centralData=concat(central),localData=concat(local),end=concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralData.length),u32(localData.length),u16(0)]);
  return new Blob([localData,centralData,end],{type:'application/zip'});
}

export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

export async function buildZip() {
  if(state.items.some((i)=>!i.wavBlob)){toast('Some files have not finished converting.',true);return;}
  els.buildZipBtn.disabled=true;els.buildZipBtn.textContent='Building…';
  try{
    const entries=[];for(const item of state.items)entries.push({name:`audio/${item.audioId}.wav`,data:new Uint8Array(await item.wavBlob.arrayBuffer())});
    entries.push({name:'Nightwalker.audio',data:utf8(buildManifest())});
    const supplement=buildSupplement();if(supplement)entries.push({name:'Nightwalker.voice.dialogue',data:utf8(supplement)});
    const patch=patchedCatalog();if(patch)entries.push({name:'Nightwalker.dialogue',data:utf8(patch)});
    entries.push({name:`${safeBatchSlug()}-inventory.json`,data:utf8(buildInventory())});
    entries.push({name:'INSTALL.txt',data:utf8('Copy the exported manifest/catalog files and audio folder beside Nightwalker.asi. Keep OptionalAudio=true under [Narrative].\n')});
    downloadBlob(createZip(entries),`${safeBatchSlug()}.zip`);toast(`Built ${entries.length} export entries.`);
  }catch(error){toast(`Build failed: ${error.message}`,true);}finally{els.buildZipBtn.disabled=false;els.buildZipBtn.textContent='Build Nightwalker ZIP';}
}

export function saveProject() {
  const payload={schema:1,batchName:els.batchNameField.value,namespace:els.namespaceField.value,items:state.items.map(({file,decoded,samples,processedSamples,wavBlob,...rest})=>rest)};
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`${safeBatchSlug()}.project.json`);
}
