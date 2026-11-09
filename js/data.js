// Data structures, CSV parsing, persistence and shared helpers.
const initialRows=[];
const KEY='skoda-journey-atlas-v1', $=id=>document.getElementById(id);
let atlasDialogResolve=null,atlasDialogPreviousFocus=null;
function closeAtlasDialog(accepted){
 $('atlasDialogOverlay').hidden=true;
 const done=atlasDialogResolve;atlasDialogResolve=null;
 if(atlasDialogPreviousFocus?.isConnected)atlasDialogPreviousFocus.focus();
 atlasDialogPreviousFocus=null;
 if(done)done(accepted);
}
function atlasDialog(message,{title='Notice',confirm=false,action='OK',danger=false}={}){
 if(atlasDialogResolve)return Promise.resolve(false);
 atlasDialogPreviousFocus=document.activeElement;
 $('atlasDialogTitle').textContent=title;
 $('atlasDialogText').textContent=message;
 $('atlasDialogCancel').hidden=!confirm;
 $('atlasDialogAccept').textContent=action;
 $('atlasDialogAccept').classList.toggle('danger',danger);
 $('atlasDialogOverlay').hidden=false;
 (confirm?$('atlasDialogCancel'):$('atlasDialogAccept')).focus();
 return new Promise(resolve=>{atlasDialogResolve=resolve});
}
$('atlasDialogCancel').onclick=()=>closeAtlasDialog(false);
$('atlasDialogAccept').onclick=()=>closeAtlasDialog(true);
$('atlasDialogOverlay').addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();closeAtlasDialog(false)}
 if(e.key==='Tab'){
  const buttons=[$('atlasDialogCancel'),$('atlasDialogAccept')].filter(b=>!b.hidden);
  const i=buttons.indexOf(document.activeElement);
  if(e.shiftKey&&i===0){e.preventDefault();buttons[buttons.length-1].focus()}
  else if(!e.shiftKey&&i===buttons.length-1){e.preventDefault();buttons[0].focus()}
 }
});

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=s=>{if(!s)return null;let p=String(s).split(',').map(Number);return p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180?p:null};
const fmt=p=>p?p.map(n=>Number(n).toFixed(6)).join(','):'';
const miles=n=>Number.isFinite(+n)?+n:0;
const idOf=r=>[r['Start of trip'],r['End of trip'],r['End odometer in mi']].join('|');
const short=s=>(s||'Unknown location').split(',')[0];
const timeInput=s=>{let m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`:''};
const timeDisplay=s=>{let m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`:s};
const shownStart=t=>t.correctedStartTime?timeDisplay(t.correctedStartTime):t.raw['Start of trip'];
const shownEnd=t=>t.correctedEndTime?timeDisplay(t.correctedEndTime):t.raw['End of trip'];
// Sort by effective start time, using the user's correction where present.
function journeySortTime(t){
 const value=t.correctedStartTime||t.raw?.['Start of trip']||'';
 const iso=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
 if(iso)return `${iso[1]}${iso[2]}${iso[3]}${iso[4]}${iso[5]}`;
 const local=String(value).match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
 if(local)return `${local[3]}${local[2]}${local[1]}${local[4]}${local[5]}`;
 return '';
}
const newestFirst=(a,b)=>journeySortTime(b).localeCompare(journeySortTime(a))||String(a.id).localeCompare(String(b.id));
const journeyIssues=t=>incompleteReasons(t.raw);

const validTime=s=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))return false;let d=new Date(s);return !Number.isNaN(d.getTime())&&d.getFullYear()===+s.slice(0,4)&&d.getMonth()+1===+s.slice(5,7)&&d.getDate()===+s.slice(8,10)};

function makeTrip(r){let a=coord(r['Start coordinates']),b=coord(r['End coordinates']),d=miles(r['Distance in mi']);return {id:idOf(r),raw:r,name:short(r['Start address'])+' → '+short(r['End address']),start:a,end:b,waypoints:[],stops:[],itinerary:[],notes:'',correctedStartTime:null,correctedEndTime:null,roads:'',status:(!a||!b||d===0||(a&&b&&L.latLng(a).distanceTo(L.latLng(b))<100&&d>1))?'review':'checked',geometry:null,routeMiles:null}}
let importHistory=[];const HISTORY_KEY='skoda-atlas-import-history-v017';try{importHistory=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{importHistory=[]}
let journeys=[],selected=null,listFilter='all',mode='via',routingToken=0,routingTimer=null,editSnapshot=null;
function persist(){if(editSnapshot)return;try{localStorage.setItem(KEY,JSON.stringify(journeys))}catch(e){console.warn('Could not save',e)}}
function load(){try{let old=JSON.parse(localStorage.getItem(KEY));journeys=Array.isArray(old)&&old.length?old:initialRows.map(makeTrip)}catch{journeys=initialRows.map(makeTrip)}journeys.forEach(migrate)}
function parseCSV(text){let rows=[],row=[],cell='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(x=>x!==''))rows.push(row);let head=rows.shift()||[];head[0]=(head[0]||'').replace(/^\uFEFF/,'');return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])))}
