(() => { if (window.__CMV_V2_ACTIVE__) return; window.__CMV_V2_ACTIVE__ = true;
const PANEL_ID="cmv-panel-v2"; const TOGGLE_ID="cmv-toggle-v2"; const LB_ID="cmv-lightbox-v2"; const LB_CONTENT="cmv-lightbox-main-v2";
let GLOBAL_TOKEN=null; let MEDIA_ITEMS=[];
const state={index:0,zoom:1,rotation:0,fit:"contain",theme:"dark",panX:0,panY:0};

function ensureStyles(){ if(document.getElementById("cmv-v2-styles"))return;
const css=`#${PANEL_ID}{border:1px solid #ccc;border-radius:6px;background:#fafafa;padding:10px;margin-bottom:10px;font-size:13px;}
#${TOGGLE_ID}{margin-bottom:8px;padding:6px 12px;background:#0078d4;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;}
.cmv-group{border:1px solid #ddd;border-radius:5px;margin-bottom:8px;}
.cmv-group-header{padding:6px 10px;cursor:pointer;background:#eee;font-weight:600;display:flex;justify-content:space-between;align-items:center;}
.cmv-group-body{display:none;padding:6px 10px;background:white;}
.cmv-item{padding:5px 0;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:6px;}
.cmv-label{flex:1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#${LB_ID}{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);display:none;z-index:999999;align-items:center;justify-content:center;}
#${LB_CONTENT}{width:80vw;height:80vh;background:#111;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;}
.cmv-lb-main{flex:1;background:#000;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;}
.cmv-lb-main img,.cmv-lb-main video{max-width:100%!important;max-height:100%!important;object-fit:contain!important;transform-origin:center center!important;}
.cmv-lb-main iframe{width:100%!important;height:100%!important;border:none!important;object-fit:contain!important;}
.cmv-nav-arrow{position:absolute;top:50%;transform:translateY(-50%);padding:10px 14px;font-size:28px;background:rgba(0,0,0,0.4);color:white;cursor:pointer;border-radius:20px;}
.cmv-nav-left{left:10px;} .cmv-nav-right{right:10px;}
.cmv-thumb{width:70px;height:60px;background:#333;display:flex;align-items:center;justify-content:center;border-radius:4px;border:2px solid transparent;cursor:pointer;}
.cmv-thumb img{width:100%;height:100%;object-fit:contain;}
#cmv-progress-v2{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);color:white;display:none;align-items:center;justify-content:center;font-size:18px;z-index:1000000;}`;
let st=document.createElement("style"); st.id="cmv-v2-styles"; st.textContent=css; document.head.appendChild(st); }

function ensureToken(){ if(GLOBAL_TOKEN) return GLOBAL_TOKEN;
let pe=performance.getEntries(); for(let x of pe){ let m=x.name.match(/[?&]Token=([^&]+)/i); if(m){GLOBAL_TOKEN=m[1]; return GLOBAL_TOKEN;}}
if(window.angular){ let nodes=document.querySelectorAll("[ng-controller],[ng-repeat]"); for(let n of nodes){try{let s=angular.element(n).scope(); if(s?.Token){GLOBAL_TOKEN=s.Token;return s.Token;} if(s?.$parent?.Token){GLOBAL_TOKEN=s.$parent.Token;return s.$parent.Token;}}catch{}}}
return null;}

function extractRawMedia(){ try{ let pane=document.querySelector(".mobile-media-content-area"); if(!pane)return[];
let row=pane.querySelector("[ng-repeat='mediadetails in media']"); if(!row)return[];
return angular.element(row).scope()?.media||[];}catch{return[];}}

function buildDownloadUrl(f,k,t){ let ef=encodeURIComponent(f), ek=encodeURIComponent(k), et=encodeURIComponent(t);
return `${location.origin}/Media/DownloadMediaStream/${ef}?Token=${et}&FileName=${ef}&MediaKey=${ek}`;}

function buildViewerUrl(f,k,t){ let path=`${k},${f},WorkOrderRecords`; return `${location.origin}/mediaviewer?fileName=${encodeURIComponent(path)}&Token=${encodeURIComponent(t)}`;}

function classifyMedia(raw){ let t=ensureToken(); if(!t) return{items:[],groups:null};
let g={Images:[],Videos:[],Documents:[],Other:[]}; let items=[];
let img=["jpg","jpeg","png","gif","bmp","tif","tiff"], vid=["mp4","mov","webm","avi","wmv","mpeg","mpg"], doc=["pdf","doc","docx","xls","xlsx","csv","ppt","pptx","rtf","txt"];
for(let m of raw){ let f=m.FileName, ext=f.split(".").pop().toLowerCase(), key=m.Key;
let kind="other"; if(img.includes(ext))kind="image"; else if(vid.includes(ext))kind="video"; else if(doc.includes(ext))kind="doc";
let item={desc:m.Description||f,fileName:f,ext:ext,kind:kind,
downloadUrl:buildDownloadUrl(f,key,t),
viewerUrl:kind==="doc"?buildViewerUrl(f,key,t):buildDownloadUrl(f,key,t),
flatIndex:items.length};
items.push(item);
if(kind==="image")g.Images.push(item); else if(kind==="video")g.Videos.push(item); else if(kind==="doc")g.Documents.push(item); else g.Other.push(item);
}
return{items:items,groups:g};}

function groupHTML(n,a){return `<div class="cmv-group"><div class="cmv-group-header">${n} (${a.length}) <span>▼</span></div><div class="cmv-group-body"><button class="cmv-sel-all">Select All</button><button class="cmv-sel-none">None</button>${a.map(i=>`<div class="cmv-item"><input type="checkbox" class="cmv-select" data-idx="${i.flatIndex}"><span class="cmv-label" data-idx="${i.flatIndex}">${i.desc}</span><button data-idx="${i.flatIndex}">Preview</button></div>`).join("")}</div></div>`;}

function buildPanel(){ ensureStyles(); let raw=extractRawMedia();
let panel=document.getElementById(PANEL_ID)||document.createElement("div"); panel.id=PANEL_ID;
if(!raw.length){panel.innerHTML=`<div class="cmv-title">Media Viewer (Custom)</div><i>No media found.</i>`; return panel;}
let c=classifyMedia(raw); MEDIA_ITEMS=c.items;
panel.innerHTML=`<div class="cmv-title">Media Viewer (Custom)</div>${groupHTML("Images",c.groups.Images)}${groupHTML("Videos",c.groups.Videos)}${groupHTML("Documents",c.groups.Documents)}${groupHTML("Other",c.groups.Other)}`;
panel.querySelectorAll(".cmv-group-header").forEach(h=>h.addEventListener("click",()=>{let b=h.nextElementSibling;b.style.display=b.style.display==="block"?"none":"block";}));
panel.querySelectorAll(".cmv-sel-all").forEach(btn=>btn.addEventListener("click",ev=>{ev.stopPropagation();btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb=>cb.checked=true);})); 
panel.querySelectorAll(".cmv-sel-none").forEach(btn=>btn.addEventListener("click",ev=>{ev.stopPropagation();btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb=>cb.checked=false);})); 
panel.querySelectorAll(".cmv-label,.cmv-item button").forEach(el=>el.addEventListener("click",ev=>{let i=Number(el.dataset.idx); if(!isNaN(i))openLightbox(i);})); 
return panel; }

function injectToggle(){ let pane=document.querySelector(".mobile-media-content-area"); if(!pane)return;
let btn=document.getElementById(TOGGLE_ID); if(!btn){btn=document.createElement("button");btn.id=TOGGLE_ID;btn.textContent="Switch to Custom Viewer";pane.parentNode.insertBefore(btn,pane);}
btn.onclick=()=>{ let panel=document.getElementById(PANEL_ID);
if(panel && panel.style.display!=="none"){ panel.style.display="none"; pane.style.display=""; btn.textContent="Switch to Custom Viewer"; return;}
let newPanel=buildPanel(); newPanel.style.display=""; pane.style.display="none"; btn.textContent="Switch to Native Viewer";
if(!document.getElementById(PANEL_ID)) pane.parentNode.insertBefore(newPanel,pane);}; }

new MutationObserver(()=>injectToggle()).observe(document.body,{childList:true,subtree:true}); injectToggle();

function ensureLightbox(){ if(document.getElementById(LB_ID))return;
let lb=document.createElement("div"); lb.id=LB_ID;
lb.innerHTML=`<div id="${LB_CONTENT}"><div class="cmv-lb-header"><span class="cmv-name"></span><div><button data-act="prev">◀</button><button data-act="next">▶</button><button data-act="zoom-in">+</button><button data-act="zoom-out">-</button><button data-act="zoom-reset">100%</button><button data-act="rotate-left">⟲</button><button data-act="rotate-right">⟳</button><button data-act="fit-width">Fit W</button><button data-act="fit-height">Fit H</button><button data-act="fit-original">1:1</button><button data-act="theme">☯</button><button data-act="download">⬇</button><button data-act="download-all">⇩ All</button><button data-act="download-selected">⇩ Selected</button><button data-act="close">✕</button></div></div><div class="cmv-lb-main"><div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div><div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div></div><div class="cmv-lb-thumbs"></div></div>`;
document.body.appendChild(lb);
lb.addEventListener("click",ev=>{let a=ev.target.dataset.act;if(a){ev.stopPropagation();handleAction(a);}});
lb.addEventListener("click",ev=>{if(ev.target.id===LB_ID)closeLightbox();});

let main=lb.querySelector(".cmv-lb-main"); let pan=false,sx=0,sy=0,bx=0,by=0;
main.addEventListener("mousedown",ev=>{ if(ev.button!==1)return; let it=currentItem(); if(!["image","video"].includes(it.kind))return;
ev.preventDefault(); pan=true; sx=ev.clientX; sy=ev.clientY; bx=state.panX; by=state.panY;});
document.addEventListener("mousemove",ev=>{ if(!pan)return; state.panX=bx+(ev.clientX-sx); state.panY=by+(ev.clientY-sy); renderTransform();});
document.addEventListener("mouseup",()=>pan=false);
}

function currentItem(){ return MEDIA_ITEMS[state.index]; }

function openLightbox(i){ ensureLightbox(); state.index=i; state.zoom=1; state.rotation=0; state.panX=0; state.panY=0;
document.getElementById(LB_ID).style.display="flex"; renderLightbox(); }

function closeLightbox(){ document.getElementById(LB_ID).style.display="none"; }

function handleAction(a){ switch(a){case"close":closeLightbox();break;case"prev":prevItem();break;case"next":nextItem();break;case"zoom-in":zoomIn();break;case"zoom-out":zoomOut();break;case"zoom-reset":zoomReset();break;case"rotate-left":rotate(-90);break;case"rotate-right":rotate(90);break;case"fit-width":state.fit="cover";renderTransform();break;case"fit-height":state.fit="contain";renderTransform();break;case"fit-original":state.fit="none";renderTransform();break;case"theme":toggleTheme();break;case"download":downloadCurrent();break;case"download-all":downloadAll();break;case"download-selected":downloadSelected();break;} }

function nextItem(){ state.index=(state.index+1)%MEDIA_ITEMS.length; state.zoom=1;state.rotation=0;state.panX=0;state.panY=0; renderLightbox(true);}
function prevItem(){ state.index=(state.index-1+MEDIA_ITEMS.length)%MEDIA_ITEMS.length; state.zoom=1;state.rotation=0;state.panX=0;state.panY=0; renderLightbox(true);}
function zoomIn(){ state.zoom*=1.2; renderTransform();} function zoomOut(){ state.zoom/=1.2; renderTransform();}
function zoomReset(){ state.zoom=1; state.panX=0; state.panY=0; renderTransform(); }
function rotate(d){ state.rotation=(state.rotation+d)%360; renderTransform(); }
function toggleTheme(){ state.theme=state.theme==="dark"?"light":"dark"; document.getElementById(LB_CONTENT).classList.toggle("cmv-light",state.theme==="light"); }

function renderLightbox(){ let item=currentItem(); let cont=document.getElementById(LB_CONTENT); let main=cont.querySelector(".cmv-lb-main"); let name=cont.querySelector(".cmv-name"); let thumbs=cont.querySelector(".cmv-lb-thumbs");
name.textContent=item.desc; main.innerHTML=`<div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div><div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>`;
let el;
if(item.kind==="image"){ el=document.createElement("img"); el.src=item.downloadUrl; }
else if(item.kind==="video"){ el=document.createElement("video"); el.src=item.downloadUrl; el.controls=true; }
else { el=document.createElement("iframe"); el.src=item.viewerUrl; }
main.appendChild(el); renderTransform();
thumbs.innerHTML=""; MEDIA_ITEMS.forEach((m,i)=>{ let t=document.createElement("div"); t.className="cmv-thumb"+(i===state.index?" cmv-active":"");
if(m.kind==="image"){ let im=document.createElement("img"); im.src=m.downloadUrl; t.appendChild(im);} else t.textContent=m.ext.toUpperCase();
t.onclick=()=>{state.index=i;state.zoom=1;state.rotation=0;state.panX=0;state.panY=0;renderLightbox();}; thumbs.appendChild(t);});
}

function renderTransform(){ let cont=document.getElementById(LB_CONTENT); let el=cont.querySelector("img,video,iframe"); if(!el)return;
let item=currentItem();
if(["image","video"].includes(item.kind)){ el.style.objectFit=state.fit; el.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom}) rotate(${state.rotation}deg)`; }
else el.style.transform="none"; }

function downloadCurrent(){ let it=currentItem(); let n=(it.desc||it.fileName).replace(/[\\\/:*?"<>|]/g,"_"); if(!n.toLowerCase().endsWith("."+it.ext))n+="."+it.ext;
let a=document.createElement("a"); a.href=it.downloadUrl; a.download=n; a.click(); }

function getWOID(){ let e=document.querySelector("#ID"); return (e?.innerText||e?.value||"WorkOrder").trim();}
function getSelected(){ return [...document.querySelectorAll(".cmv-select:checked")].map(cb=>MEDIA_ITEMS[cb.dataset.idx]);}

function ensureJSZip(cb){ if(window.JSZip)return cb(window.JSZip); let s=document.createElement("script");
s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"; s.onload=()=>cb(window.JSZip); document.head.appendChild(s);}

function showProgress(t){ let m=document.getElementById("cmv-progress-v2"); if(!m){ m=document.createElement("div"); m.id="cmv-progress-v2"; m.innerHTML=`<div id="cmv-progress-text-v2">${t}</div>`; document.body.appendChild(m);} m.style.display="flex"; document.getElementById("cmv-progress-text-v2").innerText=t;}
function hideProgress(){ let m=document.getElementById("cmv-progress-v2"); if(m)m.style.display="none"; }

async function downloadZip(items,name,JSZip){ showProgress("Preparing ZIP…"); let zip=new JSZip(); let c=0;
for(let it of items){ c++; showProgress(`Downloading ${c}/${items.length}…`);
try{ let buf=await (await fetch(it.downloadUrl)).arrayBuffer(); let fname=it.desc.replace(/[\\\/:*?"<>|]/g,"_"); if(!fname.toLowerCase().endsWith("."+it.ext))fname+="."+it.ext;
let folder="Other"; if(it.kind==="image")folder="Images"; else if(it.kind==="video")folder="Videos"; else if(it.kind==="doc")folder="Documents";
zip.folder(folder).file(fname,buf); }catch(err){ console.error("Download failed:",it,err);} }
showProgress("Finalizing ZIP…"); let out=await zip.generateAsync({type:"blob"}); hideProgress();
let a=document.createElement("a"); a.href=URL.createObjectURL(out); a.download=name; a.click(); }

function downloadAll(){ ensureJSZip(JSZip=>downloadZip(MEDIA_ITEMS,getWOID()+".zip",JSZip)); }
function downloadSelected(){ let sel=getSelected(); ensureJSZip(JSZip=>downloadZip(sel,getWOID()+"-selected.zip",JSZip)); }

})();
