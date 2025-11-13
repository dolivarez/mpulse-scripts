/* ============================================================
 * CMV v2.7 — Custom Media Viewer for MPulse
 * Author: Daniel Olivarez
 * ============================================================ */
(() => {
  if (window.__CMV_V2_ACTIVE__) return;
  window.__CMV_V2_ACTIVE__ = true;

  const PANEL_ID   = "cmv-panel-v2";
  const TOGGLE_ID  = "cmv-toggle-v2";
  const LB_ID      = "cmv-lightbox-v2";
  const LB_CONTENT = "cmv-lightbox-main-v2";

  let GLOBAL_TOKEN = null;
  let MEDIA_ITEMS  = [];

  const state = {
    index: 0,
    zoom: 1,
    rotation: 0,
    fit: "contain",
    theme: "dark",
    panX: 0,
    panY: 0
  };

  /* ============================================================
   * Inject CSS (single instance)
   * ============================================================ */
  function ensureStyles() {
    if (document.getElementById("cmv-v2-styles")) return;

    const css = `
      #${PANEL_ID} { border:1px solid #ccc; border-radius:6px; background:#fafafa;
        padding:10px; margin-bottom:10px; font-size:13px; }
      #${PANEL_ID} .cmv-title { font-weight:600; margin-bottom:6px; }

      #${TOGGLE_ID} {
        margin-bottom:8px; padding:6px 12px; background:#0078d4; color:white;
        border:none; border-radius:4px; cursor:pointer; font-size:13px;
      }

      .cmv-group { border:1px solid #ddd; border-radius:5px; margin-bottom:8px; }
      .cmv-group-header {
        padding:6px 10px; cursor:pointer; background:#eee; font-weight:600;
        display:flex; justify-content:space-between; align-items:center;
      }
      .cmv-group-body { display:none; padding:6px 10px; background:white; }

      .cmv-item { padding:5px 0; border-bottom:1px solid #f0f0f0;
        display:flex; align-items:center; gap:6px; }
      .cmv-item:last-child { border-bottom:none; }
      .cmv-label { flex:1; cursor:pointer; overflow:hidden;
        text-overflow:ellipsis; white-space:nowrap; }
      .cmv-select { margin-right:4px; }

      /* Lightbox shell */
      #${LB_ID} {
        position:fixed; top:0; left:0; width:100vw; height:100vh;
        background:rgba(0,0,0,0.85); display:none; z-index:999999;
        align-items:center; justify-content:center;
      }
      #${LB_CONTENT} {
        width:80vw; height:80vh; background:#111; border-radius:8px;
        display:flex; flex-direction:column; overflow:hidden;
      }
      .cmv-light { background:#f7f7f7 !important; }

      .cmv-lb-header {
        padding:6px 10px; font-size:13px; background:#222; color:white;
        display:flex; justify-content:space-between; align-items:center;
      }
      .cmv-light .cmv-lb-header { background:#ddd !important; color:black !important; }

      .cmv-lb-main {
        flex:1; background:#000; overflow:hidden; position:relative;
        display:flex; align-items:center; justify-content:center;
      }
      .cmv-light .cmv-lb-main { background:#fafafa !important; }

      /* FIX: images/videos fit correctly */
      .cmv-lb-main img,
      .cmv-lb-main video {
        max-width:100% !important;
        max-height:100% !important;
        width:auto !important;
        height:auto !important;
        object-fit:contain !important;
        transform-origin:center center !important;
      }

      /* FIX: native MPulse doc viewer */
      .cmv-lb-main iframe {
        width:100% !important; height:100% !important;
        border:none !important; object-fit:contain !important;
      }

      .cmv-nav-arrow {
        position:absolute; top:50%; transform:translateY(-50%);
        padding:10px 14px; font-size:28px;
        background:rgba(0,0,0,0.4); color:white; cursor:pointer;
        border-radius:20px;
      }
      .cmv-nav-left { left:10px; }
      .cmv-nav-right { right:10px; }

      .cmv-lb-thumbs {
        height:80px; background:#181818; display:flex; overflow-x:auto;
        gap:4px; padding:4px;
      }
      .cmv-thumb {
        width:70px; height:60px; background:#333; display:flex;
        align-items:center; justify-content:center; border-radius:4px;
        border:2px solid transparent; cursor:pointer; flex:0 0 auto;
      }
      .cmv-thumb img { width:100%; height:100%; object-fit:contain; }
      .cmv-thumb.cmv-active { border-color:#00aaff; }

      #cmv-progress-v2 {
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.5); color:white; display:none;
        align-items:center; justify-content:center; font-size:18px;
        z-index:1000000;
      }
    `;
    const style = document.createElement("style");
    style.id = "cmv-v2-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
   * Token detection
   * ============================================================ */
  function ensureToken() {
    if (GLOBAL_TOKEN) return GLOBAL_TOKEN;

    const perf = performance.getEntries();
    for (const e of perf) {
      const m = e.name.match(/[?&]Token=([^&]+)/i);
      if (m) return (GLOBAL_TOKEN = m[1]);
    }

    if (window.angular) {
      const nodes = document.querySelectorAll("[ng-controller],[ng-repeat]");
      for (const n of nodes) {
        try {
          const s = angular.element(n).scope();
          if (s?.Token) return (GLOBAL_TOKEN = s.Token);
          if (s?.$parent?.Token) return (GLOBAL_TOKEN = s.$parent.Token);
        } catch {}
      }
    }
    return null;
  }

  /* ============================================================
   * Extract media (mobile-safe method)
   * ============================================================ */
  function extractRawMedia() {
    try {
      const panel = document.querySelector(".mobile-media-content-area");
      if (!panel) return [];

      const scopeEl = panel.querySelector("[ng-repeat='mediadetails in media']");
      if (!scopeEl) return [];

      return angular.element(scopeEl).scope()?.media || [];
    } catch {
      return [];
    }
  }

  function buildDownloadUrl(file, key, token) {
    const f = encodeURIComponent(file);
    const t = encodeURIComponent(token);
    const k = encodeURIComponent(key);
    return `${location.origin}/Media/DownloadMediaStream/${f}?Token=${t}&FileName=${f}&MediaKey=${k}`;
  }

  function buildViewerUrl(file, key, token) {
    const path = `${key},${file},WorkOrderRecords`;
    return `${location.origin}/mediaviewer?fileName=${encodeURIComponent(path)}&Token=${encodeURIComponent(token)}`;
  }

  function classifyMedia(raw) {
    const token = ensureToken();
    if (!token) return { items: [], groups: null };

    const types = {
      image:["jpg","jpeg","png","gif","bmp","tif","tiff"],
      video:["mp4","mov","webm","avi","wmv","mpeg","mpg"],
      doc:["pdf","doc","docx","xls","xlsx","csv","ppt","pptx","rtf","txt"]
    };

    const groups = { Images:[], Videos:[], Documents:[], Other:[] };
    const items = [];

    raw.forEach(m => {
      const file = m.FileName;
      const ext = (file.split(".").pop() || "").toLowerCase();
      const key = m.Key;

      let kind = "other";
      if (types.image.includes(ext)) kind = "image";
      else if (types.video.includes(ext)) kind = "video";
      else if (types.doc.includes(ext))   kind = "doc";

      const item = {
        desc: m.Description || file,
        fileName: file,
        ext,
        kind,
        downloadUrl: buildDownloadUrl(file, key, token),
        viewerUrl: kind === "doc" ? buildViewerUrl(file, key, token)
                                  : buildDownloadUrl(file, key, token),
        flatIndex: items.length
      };

      items.push(item);
      if (kind === "image") groups.Images.push(item);
      else if (kind === "video") groups.Videos.push(item);
      else if (kind === "doc") groups.Documents.push(item);
      else groups.Other.push(item);
    });

    return { items, groups };
  }

  /* ============================================================
   * Build collapsible panel
   * ============================================================ */
  function groupHTML(name, arr) {
    return `
      <div class="cmv-group">
        <div class="cmv-group-header">${name} (${arr.length}) <span>▼</span></div>
        <div class="cmv-group-body">
          <button class="cmv-sel-all">Select All</button>
          <button class="cmv-sel-none">None</button>
          ${arr.map(i => `
            <div class="cmv-item">
              <input type="checkbox" class="cmv-select" data-idx="${i.flatIndex}">
              <span class="cmv-label" data-idx="${i.flatIndex}">${i.desc}</span>
              <button data-idx="${i.flatIndex}">Preview</button>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  function buildPanel() {
    ensureStyles();

    const raw = extractRawMedia();
    const panel = document.getElementById(PANEL_ID) || document.createElement("div");
    panel.id = PANEL_ID;

    if (!raw.length) {
      panel.innerHTML = `<div class="cmv-title">Media Viewer (Custom)</div><i>No media found.</i>`;
      return panel;
    }

    const { items, groups } = classifyMedia(raw);
    MEDIA_ITEMS = items;

    panel.innerHTML = `
      <div class="cmv-title">Media Viewer (Custom)</div>
      ${groupHTML("Images", groups.Images)}
      ${groupHTML("Videos", groups.Videos)}
      ${groupHTML("Documents", groups.Documents)}
      ${groupHTML("Other", groups.Other)}
    `;

    panel.querySelectorAll(".cmv-group-header").forEach(h =>
      h.addEventListener("click", () => {
        const b = h.nextElementSibling;
        b.style.display = b.style.display === "block" ? "none" : "block";
      })
    );

    panel.querySelectorAll(".cmv-sel-all").forEach(btn =>
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb => cb.checked = true);
      })
    );

    panel.querySelectorAll(".cmv-sel-none").forEach(btn =>
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb => cb.checked = false);
      })
    );

    panel.querySelectorAll(".cmv-label, .cmv-item button").forEach(el =>
      el.addEventListener("click", e => {
        const idx = Number(el.dataset.idx);
        if (!isNaN(idx)) openLightbox(idx);
      })
    );

    return panel;
  }

  /* ============================================================
   * Toggle: Switch between native & custom viewer
   * ============================================================ */
  function injectToggle() {
    const pane = document.querySelector(".mobile-media-content-area");
    if (!pane) return;

    let button = document.getElementById(TOGGLE_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = TOGGLE_ID;
      button.textContent = "Switch to Custom Viewer";
      pane.parentNode.insertBefore(button, pane);
    }

    button.onclick = () => {
      const panel = document.getElementById(PANEL_ID);

      if (panel?.style.display !== "none") {
        // Switch to native
        panel.style.display = "none";
        pane.style.display = "";
        button.textContent = "Switch to Custom Viewer";
        return;
      }

      // Switch to custom
      const newPanel = buildPanel();
      newPanel.style.display = "";
      pane.style.display = "none";
      button.textContent = "Switch to Native Viewer";

      const existing = document.getElementById(PANEL_ID);
      if (!existing) pane.parentNode.insertBefore(newPanel, pane);
    };
  }

  const mo = new MutationObserver(() => injectToggle());
  mo.observe(document.body, { childList:true, subtree:true });

  injectToggle();

  /* ============================================================
   * Lightbox
   * ============================================================ */
  function ensureLightbox() {
    if (document.getElementById(LB_ID)) return;

    const lb = document.createElement("div");
    lb.id = LB_ID;
    lb.innerHTML = `
      <div id="${LB_CONTENT}">
        <div class="cmv-lb-header">
          <span class="cmv-name"></span>
          <div>
            <button data-act="prev">◀</button>
            <button data-act="next">▶</button>
            <button data-act="zoom-in">+</button>
            <button data-act="zoom-out">-</button>
            <button data-act="zoom-reset">100%</button>
            <button data-act="rotate-left">⟲</button>
            <button data-act="rotate-right">⟳</button>
            <button data-act="fit-width">Fit W</button>
            <button data-act="fit-height">Fit H</button>
            <button data-act="fit-original">1:1</button>
            <button data-act="theme">☯</button>
            <button data-act="download">⬇</button>
            <button data-act="download-all">⇩ All</button>
            <button data-act="download-selected">⇩ Selected</button>
            <button data-act="close">✕</button>
          </div>
        </div>
        <div class="cmv-lb-main">
          <div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div>
          <div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>
        </div>
        <div class="cmv-lb-thumbs"></div>
      </div>
    `;

    document.body.appendChild(lb);

    lb.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (act) {
        e.stopPropagation();
        handleAction(act);
      }
    });

    lb.addEventListener("click", e => {
      if (e.target.id === LB_ID) closeLightbox();
    });

    document.addEventListener("keydown", e => {
      const lb = document.getElementById(LB_ID);
      if (lb.style.display !== "flex") return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextItem();
      if (e.key === "ArrowLeft") prevItem();
    });

    /* ---- Middle mouse panning ---- */
    const main = lb.querySelector(".cmv-lb-main");
    let panning = false, startX=0, startY=0, baseX=0, baseY=0;

    main.addEventListener("mousedown", e => {
      if (e.button !== 1) return;
      const item = currentItem();
      if (!["image","video"].includes(item.kind)) return;

      e.preventDefault();
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = state.panX;
      baseY = state.panY;
    });

    document.addEventListener("mousemove", e => {
      if (!panning) return;
      state.panX = baseX + (e.clientX - startX);
      state.panY = baseY + (e.clientY - startY);
      renderTransform();
    });
    document.addEventListener("mouseup", () => panning=false);
  }

  function currentItem() { return MEDIA_ITEMS[state.index]; }

  function openLightbox(i) {
    ensureLightbox();
    state.index = i;
    state.zoom = 1;
    state.rotation = 0;
    state.panX = 0;
    state.panY = 0;

    const lb = document.getElementById(LB_ID);
    lb.style.display = "flex";
    renderLightbox();
  }
  function closeLightbox(){ document.getElementById(LB_ID).style.display="none"; }

  function handleAction(act) {
    switch (act) {
      case "close": closeLightbox(); break;
      case "prev": prevItem(); break;
      case "next": nextItem(); break;
      case "zoom-in": zoomIn(); break;
      case "zoom-out": zoomOut(); break;
      case "zoom-reset": zoomReset(); break;
      case "rotate-left": rotate(-90); break;
      case "rotate-right": rotate(90); break;
      case "fit-width": state.fit="cover"; renderTransform(); break;
      case "fit-height": state.fit="contain"; renderTransform(); break;
      case "fit-original": state.fit="none"; renderTransform(); break;
      case "theme": toggleTheme(); break;
      case "download": downloadCurrent(); break;
      case "download-all": downloadAll(); break;
      case "download-selected": downloadSelected(); break;
    }
  }

  function nextItem(){
    state.index=(state.index+1)%MEDIA_ITEMS.length;
    state.zoom=1;state.rotation=0;state.panX=0;state.panY=0;
    renderLightbox(true);
  }
  function prevItem(){
    state.index=(state.index-1+MEDIA_ITEMS.length)%MEDIA_ITEMS.length;
    state.zoom=1;state.rotation=0;state.panX=0;state.panY=0;
    renderLightbox(true);
  }

  function zoomIn(){ state.zoom*=1.2; renderTransform(); }
  function zoomOut(){ state.zoom/=1.2; renderTransform(); }
  function zoomReset(){ state.zoom=1; state.panX=0; state.panY=0; renderTransform(); }
  function rotate(deg){ state.rotation=(state.rotation+deg)%360; renderTransform(); }
  function toggleTheme(){
    state.theme=(state.theme==="dark"?"light":"dark");
    const cont=document.getElementById(LB_CONTENT);
    cont.classList.toggle("cmv-light", state.theme==="light");
  }

  function renderLightbox() {
    const item=currentItem();
    const cont=document.getElementById(LB_CONTENT);
    const main=cont.querySelector(".cmv-lb-main");
    const title=cont.querySelector(".cmv-name");
    const thumbs=cont.querySelector(".cmv-lb-thumbs");

    title.textContent=item.desc;

    main.innerHTML = `
      <div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div>
      <div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>
    `;

    let el;
    if (item.kind==="image"){
      el=document.createElement("img");
      el.src=item.downloadUrl;
    } else if (item.kind==="video"){
      el=document.createElement("video");
      el.src=item.downloadUrl; el.controls=true;
    } else {
      el=document.createElement("iframe");
      el.src=item.viewerUrl;
    }

    main.appendChild(el);
    renderTransform();

    /* Thumbnails */
    thumbs.innerHTML="";
    MEDIA_ITEMS.forEach((m,idx)=>{
      const t=document.createElement("div");
      t.className="cmv-thumb"+(idx===state.index?" cmv-active":"");
      t.title=m.desc;

      if (m.kind==="image"){
        const img=document.createElement("img");
        img.src=m.downloadUrl;
        t.appendChild(img);
      } else t.textContent=m.ext.toUpperCase();

      t.onclick=()=>{
        state.index=idx; state.zoom=1; state.rotation=0;
        state.panX=0; state.panY=0; renderLightbox();
      };
      thumbs.appendChild(t);
    });
  }

  function renderTransform(){
    const cont=document.getElementById(LB_CONTENT);
    const el=cont.querySelector("img,video,iframe");
    const item=currentItem();
    if (!el) return;

    if (["image","video"].includes(item.kind)){
      el.style.objectFit=state.fit;
      el.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom}) rotate(${state.rotation}deg)`;
    } else {
      el.style.transform="none";
    }
  }

  /* ============================================================
   * Downloads
   * ============================================================ */
  function downloadCurrent(){
    const item=currentItem();
    let name=(item.desc||item.fileName).replace(/[\\\/:*?"<>|]/g,"_");
    if (!name.toLowerCase().endsWith("."+item.ext)) name+="."+item.ext;

    const a=document.createElement("a");
    a.href=item.downloadUrl;
    a.download=name;
    a.click();
  }

  function getWOID(){
    const id=document.querySelector("#ID");
    return (id?.innerText||id?.value||"WorkOrder").trim();
  }

  function getSelected(){
    return [...document.querySelectorAll(".cmv-select:checked")]
      .map(cb => MEDIA_ITEMS[cb.dataset.idx]);
  }

  function ensureJSZip(cb){
    if (window.JSZip) return cb(window.JSZip);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js";
    s.onload=()=>cb(window.JSZip);
    document.head.appendChild(s);
  }

  function showProgress(t){
    let m=document.getElementById("cmv-progress-v2");
    if (!m){
      m=document.createElement("div");
      m.id="cmv-progress-v2";
      m.innerHTML=`<div id="cmv-progress-text-v2">${t}</div>`;
      document.body.appendChild(m);
    }
    m.style.display="flex";
    document.getElementById("cmv-progress-text-v2").innerText=t;
  }
  function hideProgress(){
    const m=document.getElementById("cmv-progress-v2");
    if (m) m.style.display="none";
  }

  async function downloadZip(items, zipName, JSZip){
    showProgress("Preparing ZIP…");

    const zip=new JSZip();
    let count=0;

    for (const item of items){
      count++;
      showProgress(`Downloading ${count}/${items.length}…`);

      try {
        const buf=await (await fetch(item.downloadUrl)).arrayBuffer();
        let name=item.desc.replace(/[\\\/:*?"<>|]/g,"_");
        if (!name.toLowerCase().endsWith("."+item.ext)) name+="."+item.ext;

        let folder="Other";
        if (item.kind==="image") folder="Images";
        else if (item.kind==="video") folder="Videos";
        else if (item.kind==="doc") folder="Documents";

        zip.folder(folder).file(name,buf);
      } catch (err){
        console.error("Download failed:", item, err);
      }
    }

    showProgress("Finalizing ZIP…");
    const out=await zip.generateAsync({type:"blob"});
    hideProgress();

    const a=document.createElement("a");
    a.href=URL.createObjectURL(out);
    a.download=zipName;
    a.click();
  }

  function downloadAll(){
    const items=MEDIA_ITEMS;
    ensureJSZip(JSZip => downloadZip(items, getWOID()+".zip", JSZip));
  }

  function downloadSelected(){
    const items=getSelected();
    ensureJSZip(JSZip => downloadZip(items, getWOID()+"-selected.zip", JSZip));
  }

})();
