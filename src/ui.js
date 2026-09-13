import { state, els, uid, transcriptFromFilename, inferFamily, TARGET_RATE, DEFAULT_TAIL_MS, safeBatchSlug, escapeHtml, toast } from './core.js';
import { processItemAudio, rebuildAll } from './audio.js';
import { assignGeneratedIds, matchItem, autoMatchAll, applyCatalog, loadRemoteCatalog } from './catalog.js';
import { validate, buildZip, saveProject } from './export.js';

export async function importFiles(fileList) {
  const files=[...fileList].filter((file)=>/\.(mp3|wav)$/i.test(file.name)); if(!files.length)return;
  for(const file of files){
    const item={id:uid(),file,name:file.name,transcript:transcriptFromFilename(file.name),family:'saint_denis.pre_fight',speaker:'THE VAMPIRE',audioId:'',sequenceId:'',lineId:'',textId:'',order:1,tailMs:DEFAULT_TAIL_MS,selected:false,status:'queued',matchType:'custom',matchScore:0,sourceLineIndex:null,sourceCatalog:null,decoded:null,samples:null,wavBlob:null,durationMs:0,sourceDurationMs:0,peakDb:null,warning:''};
    assignGeneratedIds(item);state.items.push(item);render();
    try{item.status='processing';renderFileList();await processItemAudio(item);matchItem(item);}catch(error){item.status='error';item.warning=error.message||'Audio decode failed.';}
    render();
  }
  if(!state.selectedId&&state.items[0])selectItem(state.items[0].id);
}

export function selectedItem(){return state.items.find((item)=>item.id===state.selectedId)||null;}
export function selectItem(id){state.selectedId=id;renderFileList();renderEditor();}
export function render(){renderFileList();renderEditor();renderSummary();}

export function renderFileList(){
  els.fileCount.textContent=state.items.length;
  if(!state.items.length){els.fileList.innerHTML='';els.fileList.appendChild(els.emptyState);els.emptyState.classList.remove('hidden');return;}
  els.emptyState.classList.add('hidden');els.fileList.innerHTML='';
  state.items.forEach((item)=>{const row=document.createElement('div');row.className=`file-row ${state.selectedId===item.id?'active':''}`;const check=document.createElement('input');check.type='checkbox';check.checked=item.selected;check.addEventListener('click',(e)=>{e.stopPropagation();item.selected=check.checked;});const copy=document.createElement('div');copy.className='file-copy';const title=document.createElement('strong');title.textContent=item.name;const sub=document.createElement('span');sub.textContent=item.transcript||'No transcript';copy.append(title,sub);const status=document.createElement('span');status.className=`row-status ${item.matchType==='catalog'?'matched':item.status==='processing'?'processing':'custom'}`;status.textContent=item.status==='processing'?'PROCESSING':item.status==='error'?'ERROR':item.matchType==='catalog'?'MATCHED':item.matchType==='partial'?'PARTIAL':'CUSTOM';row.append(check,copy,status);row.addEventListener('click',()=>selectItem(item.id));els.fileList.appendChild(row);});
}

export function renderEditor(){
  const item=selectedItem();els.noSelection.classList.toggle('hidden',!!item);els.editorContent.classList.toggle('hidden',!item);
  if(!item){els.matchState.textContent='Waiting for audio';els.matchState.className='state-chip muted';return;}
  els.selectedFileName.textContent=item.name;els.selectedAudioMeta.textContent=item.durationMs?`${(item.durationMs/1000).toFixed(2)} s · ${TARGET_RATE/1000} kHz · mono · PCM16${item.peakDb!=null?` · peak ${item.peakDb.toFixed(1)} dBFS`:''}`:item.status;
  els.transcriptField.value=item.transcript;els.familyField.value=item.family;els.speakerField.value=item.speaker;els.audioIdField.value=item.audioId;els.sequenceIdField.value=item.sequenceId;els.lineIdField.value=item.lineId;els.textIdField.value=item.textId;els.orderField.value=item.order;els.tailField.value=item.tailMs;
  els.matchState.textContent=item.matchType==='catalog'?`Matched ${Math.round(item.matchScore*100)}%`:item.matchType==='partial'?'Partial match':'Custom line';els.matchState.className=`state-chip ${item.matchType==='catalog'?'good':''}`;drawWaveform(item.processedSamples||item.samples);
}

function drawWaveform(samples){const canvas=els.waveform,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#101310';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#272d27';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();if(!samples?.length)return;ctx.strokeStyle='#b6905b';ctx.beginPath();const step=Math.max(1,Math.floor(samples.length/w));for(let x=0;x<w;x++){let min=1,max=-1,start=x*step,end=Math.min(samples.length,start+step);for(let i=start;i<end;i++){const s=samples[i];if(s<min)min=s;if(s>max)max=s;}ctx.moveTo(x,(1-max)*h/2);ctx.lineTo(x,(1-min)*h/2);}ctx.stroke();}

export function renderSummary(){
  const warnings=validate(),matched=state.items.filter((i)=>i.matchType==='catalog').length;els.summaryFiles.textContent=state.items.length;els.summaryMatched.textContent=matched;els.summaryCustom.textContent=state.items.length-matched;els.summaryWarnings.textContent=warnings.length;els.buildZipBtn.disabled=!state.items.length||state.items.some((i)=>!i.wavBlob||i.status==='error');els.saveProjectBtn.disabled=!state.items.length;
  if(!state.items.length){els.validationBox.innerHTML='<div class="validation-title"><span>✓</span><strong>Waiting for a batch</strong></div><p>Import audio and VoiceRDR2 will check IDs, dialogue grouping, durations, and export paths.</p>';return;}
  if(warnings.length){els.validationBox.innerHTML=`<div class="validation-title"><span>!</span><strong>${warnings.length} warning${warnings.length===1?'':'s'}</strong></div><p>${escapeHtml(warnings.slice(0,3).join(' · '))}${warnings.length>3?'…':''}</p>`;els.buildState.textContent='Review';els.buildState.className='state-chip';}
  else{els.validationBox.innerHTML='<div class="validation-title"><span>✓</span><strong>Batch validates cleanly</strong></div><p>IDs, WAV payloads, grouping, and output paths are ready to build.</p>';els.buildState.textContent='Ready';els.buildState.className='state-chip good';}
}

function groupSelected(){const selected=state.items.filter((i)=>i.selected);if(selected.length<2){toast('Select at least two takes to group them as one conversation.',true);return;}const family=selected[0].family||'saint_denis.pre_fight',seq=`${family}.${safeBatchSlug()}.conversation_${String(++state.buildNumber).padStart(2,'0')}`;selected.sort((a,b)=>state.items.indexOf(a)-state.items.indexOf(b)).forEach((item,index)=>{item.sequenceId=seq;item.order=index+1;if(item.matchType==='catalog')item.matchType='partial';});render();toast(`Grouped ${selected.length} lines into one authored conversation.`);}
function preview(){const item=selectedItem();if(!item?.wavBlob)return;if(els.audioPlayer.src)URL.revokeObjectURL(els.audioPlayer.src);els.audioPlayer.src=URL.createObjectURL(item.wavBlob);els.audioPlayer.play();}
function regenerateCurrent(){const item=selectedItem();if(!item)return;item.matchType='custom';item.sourceLineIndex=null;item.sourceCatalog=null;assignGeneratedIds(item);render();}
function importProject(file){const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result);els.batchNameField.value=p.batchName||els.batchNameField.value;els.namespaceField.value=p.namespace||els.namespaceField.value;toast('Project metadata loaded. Re-import its audio files to rebuild WAV payloads.');}catch{toast('Invalid project JSON.',true);}};reader.readAsText(file);}

export function attachEvents(){
  els.chooseFilesBtn.addEventListener('click',(e)=>{e.preventDefault();els.audioInput.click();});els.audioInput.addEventListener('change',()=>importFiles(els.audioInput.files));
  ['dragenter','dragover'].forEach((name)=>els.dropzone.addEventListener(name,(e)=>{e.preventDefault();els.dropzone.classList.add('dragover');}));['dragleave','drop'].forEach((name)=>els.dropzone.addEventListener(name,(e)=>{e.preventDefault();els.dropzone.classList.remove('dragover');}));els.dropzone.addEventListener('drop',(e)=>importFiles(e.dataTransfer.files));
  els.selectAllBtn.addEventListener('click',()=>{const all=state.items.every(i=>i.selected);state.items.forEach(i=>i.selected=!all);renderFileList();});els.clearQueueBtn.addEventListener('click',()=>{state.items=[];state.selectedId=null;render();});els.autoMatchBtn.addEventListener('click',()=>{autoMatchAll();render();});
  els.loadCatalogBtn.addEventListener('click',async()=>{const ok=await loadRemoteCatalog();if(ok){autoMatchAll();render();}else els.catalogInput.click();});els.catalogInput.addEventListener('change',async()=>{const file=els.catalogInput.files[0];if(!file)return;applyCatalog(await file.text());autoMatchAll();render();});
  els.importProjectBtn.addEventListener('click',()=>els.projectInput.click());els.projectInput.addEventListener('change',()=>{const file=els.projectInput.files[0];if(file)importProject(file);});els.previewBtn.addEventListener('click',preview);els.regenerateIdsBtn.addEventListener('click',regenerateCurrent);els.groupSelectedBtn.addEventListener('click',groupSelected);
  const fields=[[els.transcriptField,'transcript'],[els.speakerField,'speaker'],[els.audioIdField,'audioId'],[els.sequenceIdField,'sequenceId'],[els.lineIdField,'lineId'],[els.textIdField,'textId'],[els.orderField,'order'],[els.tailField,'tailMs']];fields.forEach(([el,key])=>el.addEventListener('input',()=>{const item=selectedItem();if(!item)return;item[key]=(key==='order'||key==='tailMs')?Number(el.value):el.value;if(key==='transcript'&&item.matchType!=='catalog')item.family=inferFamily(item.transcript);renderFileList();renderSummary();}));els.familyField.addEventListener('change',()=>{const item=selectedItem();if(!item)return;item.family=els.familyField.value;if(item.matchType!=='catalog')assignGeneratedIds(item);renderEditor();renderSummary();});
  els.trimToggle.addEventListener('change',()=>{rebuildAll(state.items);render();});els.normalizeToggle.addEventListener('change',()=>{rebuildAll(state.items);render();});els.batchNameField.addEventListener('input',()=>{state.items.filter(i=>i.matchType!=='catalog').forEach(assignGeneratedIds);render();});els.namespaceField.addEventListener('input',()=>{state.items.filter(i=>i.matchType!=='catalog').forEach(assignGeneratedIds);render();});els.buildZipBtn.addEventListener('click',buildZip);els.saveProjectBtn.addEventListener('click',saveProject);
}
