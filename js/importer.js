// Import reconciliation, backup restore and application bootstrap.
function matchScore(a,b){
 let score=0,why=[];
 for(const [k,weight] of [['Start of trip',4],['End of trip',4],['End odometer in mi',3]]){
   if(normalized(a[k])&&normalized(a[k])===normalized(b[k])){score+=weight;why.push(k)}
 }
 // A same-day journey with a matching finish coordinate can be a revision, but is never automatically accepted.
 const day=s=>String(s||'').slice(0,10);
 const pa=coord(a['End coordinates']),pb=coord(b['End coordinates']);
 if(day(a['Start of trip'])===day(b['Start of trip'])&&pa&&pb&&L.latLng(pa).distanceTo(L.latLng(pb))<120){score+=2;why.push('finish location')}
 return {score,why};
}
const rawDifferences=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>normalized(a[k])!==normalized(b[k])).map(k=>({field:k,old:a[k]??'',next:b[k]??''}));
let pendingImport=null;
const overlay=$('importOverlay');
function closeImport(){overlay.hidden=true;pendingImport=null;$('csvFile').value=''}
$('importCancel').onclick=closeImport;
function renderImportPreview(){
 const p=pendingImport;if(!p)return;
 $('importFileInfo').textContent=p.filename+' · No changes will be made until you approve them.';
 const counts={new:0,duplicate:0,revision:0,invalid:0,incomplete:0};
 p.entries.forEach(x=>{counts[x.kind]++;if(x.issues.length)counts.incomplete++});
 $('importSummary').innerHTML=`<span>${p.entries.length} ${p.entries.length===1?'row':'rows'}</span><span>${counts.new} new</span><span>${counts.duplicate} ${counts.duplicate===1?'duplicate':'duplicates'}</span><span>${counts.revision} possible ${counts.revision===1?'revision':'revisions'}</span><span>${counts.incomplete} incomplete</span><span>${counts.invalid} invalid</span>`;
 const root=$('importEntries');root.innerHTML='';
 p.entries.forEach((x,i)=>{
   const box=document.createElement('details');box.className='import-entry';box.open=x.kind==='revision'||x.kind==='invalid'||x.issues.length>0;
   const title=document.createElement('summary');title.textContent=`${i+1}. ${x.row['Start of trip']||'Unknown time'} · ${x.kind==='revision'?'Possible updated journey':x.kind==='duplicate'?'Duplicate':x.kind==='invalid'?'Invalid row':'New journey'}`;box.append(title);
   const note=document.createElement('p');note.textContent=(x.issues.length?'Data quality: '+x.issues.join('; ')+'. ':'')+(x.kind==='revision'?'Possible match: '+(x.target?.name||'existing journey')+'. Review fields before updating.':'');box.append(note);
   if(x.kind==='revision'){
     const table=document.createElement('table');table.innerHTML='<thead><tr><th>Field</th><th>Existing MyŠkoda</th><th>New export</th></tr></thead>';
     const body=document.createElement('tbody');
     for(const diff of x.differences){const tr=document.createElement('tr');for(const val of [diff.field,diff.old||'(blank)',diff.next||'(blank)']){let td=document.createElement('td');td.textContent=val;tr.append(td)}body.append(tr)}
     if(!x.differences.length){let tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='No source-field differences';tr.append(td);body.append(tr)}
     table.append(body);box.append(table);
   }
   const choice=document.createElement('select');choice.setAttribute('aria-label','Import action for row '+(i+1));
   const options=x.kind==='revision'?[['skip','Keep existing'],['update','Update original telemetry, preserve corrections'],['add','Import as separate journey']]:x.kind==='new'?[['add','Add new journey'],['skip','Skip']]:[['skip','Skip']];
   for(const [value,label] of options){const opt=document.createElement('option');opt.value=value;opt.textContent=label;choice.append(opt)}
   choice.value=x.kind==='new'?'add':'skip';choice.onchange=()=>x.action=choice.value;x.action=choice.value;
   const actionLabel=document.createElement('label');actionLabel.className='import-action-label';actionLabel.textContent='Import action';box.append(actionLabel);
   if(options.length===1){const fixed=document.createElement('div');fixed.className='import-fixed-action';fixed.textContent='Skip — exact duplicate or invalid row; no changes available';box.append(fixed)}
   else{actionLabel.htmlFor='importChoice'+i;choice.id='importChoice'+i;box.append(choice)}
   root.append(box);
 });
 $('importWarnings').innerHTML=counts.revision?'<div class="import-warning">Potential revisions are never applied automatically. Updating replaces only MyŠkoda source fields; manually corrected routes, times, stops and review status remain. Check any changes to journey start/finish coordinates.</div>':'';
 overlay.hidden=false;$('importCancel').focus();
}
$('csvFile').onchange=async e=>{
 const input=e.target;
 if(editSnapshot){atlasDialog('Save or close the editor before importing.',{title:'Unsaved journey edits'});input.value='';return}
 const f=input.files[0];if(!f)return;
 try{
  const rows=parseCSV(await f.text());
  if(!rows.length||!sourceKeys.every(k=>k in rows[0]))throw Error('Not a recognised MyŠkoda CSV: required columns are missing.');
  const entries=[],seen=new Set();
  for(const row of rows){
   const id=idOf(row),issues=incompleteReasons(row);
   let kind='new',target=null,differences=[];
   if(!validRow(row))kind='invalid';
   else if(seen.has(id))kind='duplicate';
   else{
    const exact=journeys.find(t=>t.id===id);
    if(exact){
      differences=rawDifferences(exact.raw,row);
      if(!differences.length)kind='duplicate';
      else{kind='revision';target=exact}
    }else{
      const ranked=journeys.map(t=>({t,...matchScore(row,t.raw)})).sort((a,b)=>b.score-a.score);
      if(ranked[0]?.score>=6 && (!ranked[1]||ranked[0].score>ranked[1].score)){
       kind='revision';target=ranked[0].t;differences=rawDifferences(target.raw,row);
      }
    }
   }
   seen.add(id);entries.push({row,kind,target,differences,issues,action:kind==='new'?'add':'skip'});
  }
  pendingImport={filename:f.name,entries};renderImportPreview();
 }catch(err){atlasDialog('CSV import failed: '+err.message,{title:'Import error'});input.value=''}
};
$('importApply').onclick=()=>{
 const p=pendingImport;if(!p)return;
 let added=0,updated=0,skipped=0;
 const staged=structuredClone(journeys);
 try{
  for(const x of p.entries){
   if(x.action==='skip'){skipped++;continue}
   if(x.action==='add'){
    let t=makeTrip(x.row);
    if(staged.some(j=>j.id===t.id))throw Error('Duplicate journey identifier. Skip or update instead.');
    t.internalId=crypto.randomUUID?.()||('journey-'+Date.now()+'-'+added);
    staged.push(t);added++;continue;
   }
   if(x.action==='update'){
    const t=staged.find(j=>j.id===x.target.id);
    if(!t)throw Error('Matching journey no longer exists');
    const newId=idOf(x.row);
    if(staged.some(j=>j!==t&&j.id===newId))throw Error('Updated identifier collides with another journey');
    t.sourceHistory??=[];
    t.sourceHistory.push({importedAt:new Date().toISOString(),raw:structuredClone(t.raw)});
    const oldStart=coord(t.raw['Start coordinates']),oldEnd=coord(t.raw['End coordinates']);
    const newStart=coord(x.row['Start coordinates']),newEnd=coord(x.row['End coordinates']);
    // Only refresh uncorrected coordinates. Never overwrite user changes.
    if(JSON.stringify(t.start)===JSON.stringify(oldStart)&&newStart)t.start=newStart;
    if(JSON.stringify(t.end)===JSON.stringify(oldEnd)&&newEnd)t.end=newEnd;
    if(!t.correctedStartTime&&!t.correctedEndTime&&t.name===(short(t.raw['Start address'])+' → '+short(t.raw['End address'])))t.name=short(x.row['Start address'])+' → '+short(x.row['End address']);
    t.raw=x.row;t.id=newId;if(selected===x.target.id)selected=newId;
    // Geometry is retained as a user reconstruction; review if endpoint moved.
    updated++;continue;
   }
  }
  journeys=staged;const now=new Date().toISOString();
  importHistory.unshift({at:now,file:p.filename,rows:p.entries.length,added,updated,skipped});
  importHistory=importHistory.slice(0,100);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(importHistory));
  persist();if(selected&&!journeys.some(t=>t.id===selected))selected=null;render();
  const report=$('importReport');report.hidden=false;
  showImportReport({added,updated,skipped,file:p.filename});
  closeImport();
 }catch(err){atlasDialog('Import not applied: '+err.message,{title:'Import error'})}
};
let pendingRestore=null;
function closeRestore(){ $('restoreOverlay').hidden=true;pendingRestore=null;$('jsonFile').value=''; }
$('restoreCancel').onclick=closeRestore;
$('restoreConfirm').onclick=()=>{
 const data=pendingRestore;if(!data)return;
 try{
  // Validate and migrate a copy before changing the current atlas.
  const restored=structuredClone(data.journeys);
  restored.forEach(t=>{if(!t||typeof t!=='object'||!t.raw||typeof t.raw!=='object'||typeof t.id!=='string')throw Error('Backup contains an invalid journey');migrate(t)});
  discardDraft();
  journeys=restored;
  importHistory=Array.isArray(data.importHistory)?structuredClone(data.importHistory):[];
  localStorage.setItem(HISTORY_KEY,JSON.stringify(importHistory));
  persist();selected=null;$('panel').classList.remove('open');
  render();$('importReport').hidden=true;if(importHistory.length)showImportReport(importHistory[0]);
  setTimeout(()=>map.invalidateSize(),60);$('fitBtn').click();
  closeRestore();
 }catch(err){atlasDialog('Restore failed: '+err.message,{title:'Restore error'})}
};
$('jsonFile').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  if(editSnapshot)throw Error('Save or close the editor before restoring a backup.');
  const data=JSON.parse(await f.text());
  if(data.format!=='skoda-journey-atlas'||!Array.isArray(data.journeys))throw Error('Invalid atlas export');
  if(!data.journeys.every(t=>t&&typeof t==='object'&&t.raw&&typeof t.raw==='object'&&typeof t.id==='string'))throw Error('Backup contains an invalid journey');
  pendingRestore=data;
  $('restoreFilename').textContent=f.name;
  $('restoreCurrentCount').textContent=journeys.length;
  $('restoreBackupCount').textContent=data.journeys.length;
  $('restoreOverlay').hidden=false;
  $('restoreCancel').focus();
 }catch(err){atlasDialog('Restore failed: '+err.message,{title:'Restore error'});e.target.value=''}
};
function showImportReport(h){
 const el=$('importReport');el.hidden=false;el.replaceChildren();
 const summary=document.createElement('div');summary.textContent=`Last import: ${h.added} added · ${h.updated} updated · ${h.skipped} skipped.`;
 const file=document.createElement('span');file.className='import-file-name';file.textContent=h.file||'';file.title=h.file||'';
 el.append(summary,file);
}
load();render();if(importHistory.length)showImportReport(importHistory[0]);$('fitBtn').click();
