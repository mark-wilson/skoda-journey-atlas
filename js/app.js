// Map, editor, journey rendering and export.
document.querySelector('aside').insertBefore(document.getElementById('panel'),document.getElementById('trips'));
const map=L.map('map',{zoomControl:false}).setView([52.02,-1.05],9);L.control.zoom({position:'bottomright'}).addTo(map);
try{L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty',attribution:'&copy; OpenStreetMap contributors &copy; OpenFreeMap'}).addTo(map)}catch(e){$('mapWarning').textContent='Map service unavailable: '+e.message;$('mapWarning').hidden=false}
const lines=L.layerGroup().addTo(map),markers=L.layerGroup().addTo(map),handles=L.layerGroup().addTo(map);
const active=()=>journeys.find(t=>t.id===selected);
function migrate(t){t.waypoints??=[];t.stops??=[];if(!Array.isArray(t.itinerary)){let arr=[...t.waypoints.map(p=>({pos:p,type:'via'})),...t.stops.map(p=>({pos:p,type:'stop'}))];t.itinerary=[];for(let item of arr){let anchors=[t.start,...t.itinerary.map(x=>x.pos),t.end].filter(Boolean);let at=anchors.length-1,best=Infinity;if(anchors.length>1){let v=map.latLngToLayerPoint(item.pos);for(let i=0;i<anchors.length-1;i++){let a=map.latLngToLayerPoint(anchors[i]),b=map.latLngToLayerPoint(anchors[i+1]);let dx=b.x-a.x,dy=b.y-a.y,k=Math.max(0,Math.min(1,((v.x-a.x)*dx+(v.y-a.y)*dy)/(dx*dx+dy*dy||1)));let d=(v.x-a.x-k*dx)**2+(v.y-a.y-k*dy)**2;if(d<best){best=d;at=i}}}t.itinerary.splice(at,0,item)}}t.itinerary=t.itinerary.filter(x=>x&&coord(Array.isArray(x.pos)?x.pos.join(','):x.pos)).map(x=>({pos:x.pos,type:['via','stop','charge'].includes(x.type)?x.type:'via'}));syncLegacy(t)}
function estimateMiles(t){if(Number.isFinite(t.routeMiles))return t.routeMiles;if(!t.geometry?.length)return null;let d=0;for(let i=1;i<t.geometry.length;i++)d+=L.latLng(t.geometry[i-1]).distanceTo(L.latLng(t.geometry[i]));return d/1609.344}
function analysisHTML(t){let v=estimateMiles(t),recorded=Number(miles(t.raw['Distance in mi']));return `<h3>Route analysis</h3><div class="analysis-grid"><div><small>MyŠkoda recorded</small><strong>${esc(t.raw['Distance in mi'])} mi</strong></div><div><small>Estimated road distance</small><strong>${v===null?'Not calculated':v.toFixed(1)+' mi'}</strong></div></div>${v===null?'<div class="analysis-note">Add route points and calculate a road route to see an estimate.</div>':`<div class="analysis-note">Difference: ${v>=recorded?'+':''}${(v-recorded).toFixed(1)} mi from the recorded distance. Estimated from road routing, not a GPS track.</div>`}`}
function updateAnalysis(){let t=active();if(!t)return;let el=$('editorAnalysis');if(el)el.innerHTML=analysisHTML(t);let details=$('selectedDetails');if(details&&!details.hidden)details.querySelector('.analysis-content').innerHTML=analysisHTML(t)}
function syncLegacy(t){t.waypoints=t.itinerary.filter(x=>x.type==='via'||x.type==='turn').map(x=>x.pos);t.stops=t.itinerary.filter(x=>x.type!=='via').map(x=>x.pos)}
function ordered(t){return [t.start,...t.itinerary.map(x=>x.pos),t.end].filter(Boolean)}
function insertPoint(t,pos,type){if(!applyCoordinateField('start')||!applyCoordinateField('end'))return;let anchors=ordered(t),idx=t.itinerary.length,best=Infinity;if(anchors.length>1){let v=map.latLngToLayerPoint(pos);for(let i=0;i<anchors.length-1;i++){let a=map.latLngToLayerPoint(anchors[i]),b=map.latLngToLayerPoint(anchors[i+1]);let dx=b.x-a.x,dy=b.y-a.y,k=Math.max(0,Math.min(1,((v.x-a.x)*dx+(v.y-a.y)*dy)/(dx*dx+dy*dy||1)));let d=(v.x-a.x-k*dx)**2+(v.y-a.y-k*dy)**2;if(d<best){best=d;idx=i}}}t.itinerary.splice(idx,0,{pos,type});changedRoute(t)}
function changedRoute(t){
 routingToken++; // Cancel in-flight results from an earlier draft.
 syncLegacy(t);t.geometry=null;t.routeMiles=null;
 syncEditor(t);render();updateAnalysis();scheduleRoute(t)
}
function applyCoordinateField(which){
 if(!editSnapshot)return false;
 const t=active(),el=$(which),value=el.value.trim(),parsed=coord(value);
 if(value&&!parsed){el.setCustomValidity('Enter latitude, longitude');$('message').textContent='Invalid '+which+' coordinates. Enter latitude, longitude.';return false}
 el.setCustomValidity('');
 const next=parsed||null;
 if(JSON.stringify(t[which])!==JSON.stringify(next)){t[which]=next;changedRoute(t)}
 return true
}
for(const which of ['start','end']){
 $(which).addEventListener('change',()=>applyCoordinateField(which));
 $(which).addEventListener('blur',()=>{if(editSnapshot)applyCoordinateField(which)});
}
function popup(t){let r=t.raw;return `<b>${esc(t.name)}</b><br>${esc(shownStart(t))}<br>${esc(r['Distance in mi'])} mi · ${esc(r['Driving time in minutes'])} min · ${esc(r['Electricity consumption in kWh'])} kWh<br><small>${t.geometry?'Estimated route (not GPS track)':'Straight-line reference'}</small>`}
function point(p,fill,r=7){return L.circleMarker(p,{radius:r,color:'#0b3b26',weight:2,fillColor:fill,fillOpacity:1})}
function mapEditingClick(e){
 if(!editSnapshot||!$('panel').classList.contains('open'))return false;
 const t=active();if(!t)return true;
 const p=[e.latlng.lat,e.latlng.lng];
 if(mode==='start'||mode==='end'){t[mode]=p;changedRoute(t)}
 else insertPoint(t,p,mode==='stop'?'stop':'via');
 return true;
}
function render(){lines.clearLayers();markers.clearLayers();handles.clearLayers();let q=$('filter').value.toLowerCase(),visible=journeys.filter(t=>(listFilter!=='review'||t.status==='review')&&(t.name+' '+shownStart(t)+' '+shownEnd(t)+' '+JSON.stringify(t.raw)).toLowerCase().includes(q)).sort(newestFirst);$('selectedDetails').hidden=!selected||$('panel').classList.contains('open');if(selected&&!$('panel').classList.contains('open')){$('selectedDetails').innerHTML='<div class="analysis-content">'+analysisHTML(active())+'</div>'}$('trips').innerHTML=visible.map(t=>`<div class="trip ${selected===t.id?'active':''}" data-id="${esc(t.id)}"><div class="top"><span class="name">${esc(t.name)}</span><span class="trip-meta"><span class="pill ${t.status==='review'?'warn':''}">${t.status==='review'?'Review':'Checked'}</span>${journeyIssues(t).length?'<span class="pill incomplete" title="MyŠkoda source data is incomplete">Incomplete data</span>':''}<button class="trip-edit" type="button" data-edit="${esc(t.id)}" aria-label="Edit journey">Edit</button></span></div><div class="sub">${esc(shownStart(t))} · ${esc(t.raw['Distance in mi'])} mi · ${esc(t.raw['Electricity consumption in kWh'])} kWh</div></div>`).join('');
$('tripCount').textContent=journeys.length;$('distance').textContent=journeys.reduce((s,t)=>s+miles(t.raw['Distance in mi']),0);const reviewCount=journeys.filter(t=>t.status==='review').length;$('needs').textContent=reviewCount;$('reviewTile').querySelector('small').textContent=reviewCount===1?'Needs review':reviewCount===0?'Needs review':'Need review';$('allTile').classList.toggle('active',listFilter==='all');$('reviewTile').classList.toggle('active',listFilter==='review');
for(let t of [...visible.filter(x=>x.id!==selected),...visible.filter(x=>x.id===selected)]){let chosen=t.id===selected,pts=ordered(t),geom=t.geometry?.length?t.geometry:pts;if(geom.length>1){let l=L.polyline(geom,{color:t.geometry?(chosen?'#78fa8b':'#147d51'):'#d3912a',weight:chosen?6:3,opacity:chosen?1:.65,dashArray:t.geometry?null:'8 8'}).addTo(lines);l.bindTooltip(popup(t),{sticky:true});l.on('click',e=>{L.DomEvent.stopPropagation(e);if(mapEditingClick(e))return;if(selected!==t.id)choose(t.id)})}
for(let [label,p] of [['Recorded / edited start',t.start],['Recorded / edited finish',t.end]])if(p){let m=point(p,'#16452d',7).addTo(markers).bindTooltip(label+' — '+t.name);m.on('click',e=>{L.DomEvent.stopPropagation(e);if(mapEditingClick(e))return;if(selected!==t.id)choose(t.id)})}
t.itinerary.forEach((item,i)=>{if(item.type==='via'||item.type==='turn')return;
let charge=item.type==='charge',editing=chosen&&$('panel').classList.contains('open');
let icon=L.divIcon({className:'',html:'<div class="location-marker'+(charge?' charging':'')+'">'+(charge?'⚡':'')+'</div>',iconSize:[16,16],iconAnchor:[8,8]});
let m=L.marker(item.pos,{draggable:editing,icon}).addTo(editing?handles:markers);
if(editing)m.on('dragend',()=>{item.pos=[m.getLatLng().lat,m.getLatLng().lng];changedRoute(t)});
m.bindTooltip((charge?'Charging stop':'Intermediate stop')+' — '+t.name);
m.on('click',e=>{L.DomEvent.stopPropagation(e);if(mapEditingClick(e))return;if(!chosen)choose(t.id)})});
if(chosen&&$('panel').classList.contains('open'))t.itinerary.forEach((item,i)=>{if(item.type!=='via'&&item.type!=='turn')return;let h=L.marker(item.pos,{draggable:true,icon:L.divIcon({className:'',html:'<div style="width:12px;height:12px;border:2px solid #123c2b;border-radius:50%;background:#fff;box-shadow:0 1px 5px #0008"></div>',iconSize:[12,12],iconAnchor:[6,6]})}).addTo(handles).bindTooltip(item.type==='turn'?'Turnaround point — drag to adjust':'Drag to adjust route');h.on('dragend',()=>{item.pos=[h.getLatLng().lat,h.getLatLng().lng];changedRoute(t)})})}
document.querySelectorAll('.trip').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-edit]'))return;choose(el.dataset.id)});document.querySelectorAll('.trip-edit').forEach(el=>el.onclick=e=>{e.stopPropagation();editJourney(el.dataset.edit)})}
function syncEditor(t){$('start').value=fmt(t.start);$('end').value=fmt(t.end);$('itinerary').innerHTML=t.itinerary.map((x,i)=>`<div class="itrow"><div><strong>${i+1}. ${x.type==='via'?'Route point':x.type==='turn'?'↩ Turnaround':x.type==='charge'?'⚡ Charging stop':'Intermediate stop'}</strong><small>${fmt(x.pos)}</small></div><select data-i="${i}" aria-label="Point type"><option value="via" ${x.type==='via'?'selected':''}>Route</option><option value="turn" ${x.type==='turn'?'selected':''}>Turnaround</option><option value="stop" ${x.type==='stop'?'selected':''}>Stop</option><option value="charge" ${x.type==='charge'?'selected':''}>Charging</option></select><div><button data-up="${i}" title="Move earlier" ${i===0?'disabled':''}>↑</button><button data-down="${i}" title="Move later" ${i===t.itinerary.length-1?'disabled':''}>↓</button></div><button data-del="${i}" title="Delete point">✕</button></div>`).join('')||'<div class="hint">No points yet — click the map to add one.</div>';$('itinerary').querySelectorAll('select').forEach(el=>el.onchange=()=>{t.itinerary[+el.dataset.i].type=el.value;changedRoute(t)});$('itinerary').querySelectorAll('[data-up]').forEach(el=>el.onclick=()=>movePoint(t,+el.dataset.up,-1));$('itinerary').querySelectorAll('[data-down]').forEach(el=>el.onclick=()=>movePoint(t,+el.dataset.down,1));$('itinerary').querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{t.itinerary.splice(+el.dataset.del,1);changedRoute(t)})}
function movePoint(t,i,delta){let j=i+delta;if(j<0||j>=t.itinerary.length)return;[t.itinerary[i],t.itinerary[j]]=[t.itinerary[j],t.itinerary[i]];changedRoute(t)}
function choose(id){
  discardDraft();routingToken++;selected=id;let t=active();if(!t)return;
  $('panel').classList.remove('open');render();
  let p=ordered(t);if(p.length)map.fitBounds(L.latLngBounds(p).pad(.25),{maxZoom:13});
}
function editJourney(id){
  discardDraft();if(selected!==id)selected=id;
  let t=active();if(!t)return;
  editSnapshot={id:t.id,data:structuredClone(t)};
  $('panel').classList.add('open');$('name').value=t.name;syncEditor(t);
  $('startTime').value=t.correctedStartTime||timeInput(t.raw['Start of trip']);$('endTime').value=t.correctedEndTime||timeInput(t.raw['End of trip']);
  $('notes').value=t.notes||'';$('status').value=t.status;$('message').textContent='';
  $('original').innerHTML=`<b>Original MyŠkoda record (read-only)</b><br>${esc(t.raw['Start of trip'])} → ${esc(t.raw['End of trip'])}<br>${esc(t.raw['Start address']||'Unknown')} → ${esc(t.raw['End address']||'Unknown')}<br>${esc(t.raw['Distance in mi'])} mi · ${esc(t.raw['Driving time in minutes'])} min · ${esc(t.raw['Electricity consumption in kWh'])} kWh`;
  updateAnalysis();setMode('via');render();document.querySelector('aside').scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>map.invalidateSize(),60);
}
function save(){let t=active();if(!t)return null;try{if(!applyCoordinateField('start')||!applyCoordinateField('end'))throw Error('Correct invalid coordinates before saving');let a=coord($('start').value),b=coord($('end').value);if(($('start').value.trim()&&!a)||($('end').value.trim()&&!b))throw Error('Invalid start or finish coordinates');let st=$('startTime').value,en=$('endTime').value;
if(!validTime(st)||!validTime(en))throw Error('Enter valid start and finish times');
if(new Date(en).getTime()<new Date(st).getTime())throw Error('Finish time cannot precede start time');
t.correctedStartTime=st===timeInput(t.raw['Start of trip'])?null:st;
t.correctedEndTime=en===timeInput(t.raw['End of trip'])?null:en;
let changed=JSON.stringify([t.start,t.end])!==JSON.stringify([a,b]);Object.assign(t,{name:$('name').value.trim(),start:a,end:b,notes:$('notes').value,status:$('status').value});if(changed){t.geometry=null;t.routeMiles=null}routingToken++;clearTimeout(routingTimer);editSnapshot=null;persist();editSnapshot={id:t.id,data:structuredClone(t)};render();updateAnalysis();$('message').textContent='Corrections saved in this browser. Use Create data backup to download a JSON backup.';if(changed)scheduleRoute(t);return t}catch(e){$('message').textContent=e.message;return null}}
function discardDraft(){clearTimeout(routingTimer);routingToken++;if(editSnapshot){let i=journeys.findIndex(t=>t.id===editSnapshot.id);if(i>=0)journeys[i]=editSnapshot.data;editSnapshot=null}}
function setMode(m){mode=m;for(let [k,id] of Object.entries({via:'modeVia',stop:'modeStop',start:'modeStart',end:'modeEnd'}))$(id).classList.toggle('primary',k===m);$('clickHint').textContent=({via:'Click a road or an existing route segment to add a shaping point. Drag white handles to adjust.',stop:'Click to add an intermediate stop (bright green).',start:'Click to correct the journey start.',end:'Click to correct the journey finish.'})[m]}
for(let [k,id] of Object.entries({via:'modeVia',stop:'modeStop',start:'modeStart',end:'modeEnd'}))$(id).onclick=()=>setMode(k);
map.on('click',e=>{mapEditingClick(e)});
async function route(t){if(!t||selected!==t.id)return;if(editSnapshot&&(!applyCoordinateField('start')||!applyCoordinateField('end')))return;let pts=ordered(t);if(pts.length<2||!t.start||!t.end){$('message').textContent='Enter both start and finish coordinates to calculate a road route.';return}if(pts.length===2&&L.latLng(pts[0]).distanceTo(L.latLng(pts[1]))<30){$('message').textContent='Circular journey: add a shaping point or stop.';return}let token=++routingToken;$('message').textContent='Calculating road-following route…';try{let path=pts.map(p=>p[1]+','+p[0]).join(';');let response=await fetch('https://router.project-osrm.org/route/v1/driving/'+path+'?overview=full&geometries=geojson&steps=false&continue_straight=false');if(!response.ok)throw Error('Routing service returned HTTP '+response.status);let json=await response.json();if(!json.routes?.length)throw Error('No drivable route found');if(token!==routingToken)return;t.geometry=json.routes[0].geometry.coordinates.map(p=>[p[1],p[0]]);t.routeMiles=json.routes[0].distance/1609.344;if(!editSnapshot)persist();render();updateAnalysis();$('message').textContent='Route calculated. Distance comparison is shown in Route analysis.'}catch(e){if(token!==routingToken)return;render();updateAnalysis();$('message').textContent='Routing unavailable: '+e.message+'. Draft points are preserved; amber lines indicate a straight-line reference.'}}
function scheduleRoute(t){clearTimeout(routingTimer);routingTimer=setTimeout(()=>route(t),450)}
$('routeBtn').onclick=()=>{let t=active();if(t)route(t)};$('saveBtn').onclick=save;
$('undoPoint').onclick=()=>{let t=active();if(t&&t.itinerary.length){t.itinerary.pop();changedRoute(t)}};
$('clearPoints').onclick=async()=>{let t=active();if(t&&await atlasDialog('Remove all intermediate and shaping points from this editing draft?',{title:'Clear route points',confirm:true,action:'Clear points',danger:true})&&editSnapshot&&active()?.id===t.id){t.itinerary=[];changedRoute(t)}};
$('closeBtn').onclick=()=>{discardDraft();$('panel').classList.remove('open');render();setTimeout(()=>map.invalidateSize(),60)};
$('resetBtn').onclick=async()=>{const id=selected;let i=journeys.findIndex(t=>t.id===id);if(i>=0&&await atlasDialog('Remove saved corrections for this journey and restore its original MyŠkoda values? This cannot be undone unless you have a JSON backup made using Create data backup.',{title:'Reset journey corrections',confirm:true,action:'Reset corrections',danger:true})&&selected===id&&editSnapshot){journeys[i]=makeTrip(journeys[i].raw);editSnapshot=null;persist();editJourney(id)}};
$('fitBtn').onclick=()=>{let pts=journeys.flatMap(t=>ordered(t)).filter(Boolean);if(pts.length)map.fitBounds(L.latLngBounds(pts).pad(.12))};
$('allTile').onclick=()=>{listFilter='all';render()};$('reviewTile').onclick=()=>{listFilter='review';render()};for(let id of ['allTile','reviewTile'])$(id).onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$(id).click()}};
$('clearBtn').onclick=()=>{discardDraft();selected=null;$('panel').classList.remove('open');render();setTimeout(()=>map.invalidateSize(),60);$('fitBtn').click()};$('filter').oninput=render;
function download(name,data,type){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
// Destructive data management is intentionally separate from map selection and route editing.
$('clearDataBtn').onclick=async()=>{
 if(editSnapshot){await atlasDialog('Save or close the editor before clearing local data.',{title:'Unsaved journey edits'});return}
 const count=journeys.length;
 const ok=await atlasDialog(`Permanently delete ${count} locally stored ${count===1?'journey':'journeys'}, including all corrections, routes, notes and import history? This cannot be undone unless you have a JSON backup made using Create data backup. The original MyŠkoda CSV files will not be deleted.`,{title:'Clear all local data',confirm:true,action:'Delete local data',danger:true});
 if(!ok||editSnapshot)return;
 try{
  localStorage.removeItem(KEY);
  localStorage.removeItem(HISTORY_KEY);
 }catch(err){await atlasDialog('Unable to clear browser storage: '+err.message,{title:'Storage error'});return}
 clearTimeout(routingTimer);routingToken++;
 journeys=[];importHistory=[];pendingImport=null;pendingRestore=null;
 selected=null;listFilter='all';
 $('panel').classList.remove('open');
 $('importOverlay').hidden=true;$('restoreOverlay').hidden=true;
 $('csvFile').value='';$('jsonFile').value='';$('filter').value='';
 $('importReport').hidden=true;$('importReport').textContent='';
 render();setTimeout(()=>map.invalidateSize(),60);
 await atlasDialog('Local journey data and import history have been cleared. You can now import a MyŠkoda CSV.',{title:'Local data cleared'});
};
$('exportBtn').onclick=()=>{if(editSnapshot){atlasDialog('Save or close the editor before backing up your data.',{title:'Unsaved journey edits'});return}download('skoda-journey-atlas.json',JSON.stringify({format:'skoda-journey-atlas',version:3,exportedAt:new Date().toISOString(),journeys,importHistory},null,2),'application/json')};
// Import identity is separate from user corrections. Never silently overwrite an existing journey.
const normalized=v=>String(v??'').trim().toLowerCase();
const numeric=v=>{let x=Number(v);return Number.isFinite(x)?x:null};
const sourceKeys=['Start of trip','End of trip','End odometer in mi'];
const validRow=r=>normalized(r['Start of trip'])&&normalized(r['End of trip']);
const incompleteReasons=r=>{
 let reasons=[];
 if(!coord(r['Start coordinates']))reasons.push('Missing start coordinates');
 if(!coord(r['End coordinates']))reasons.push('Missing finish coordinates');
 if(miles(r['Distance in mi'])===0 && (numeric(r['Driving time in minutes'])>0 || numeric(r['Electricity consumption in kWh'])>0))reasons.push('Zero distance despite driving activity');
 return reasons;
};
