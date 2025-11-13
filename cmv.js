
(() => {
  if (window.__CMV_V2_ACTIVE__) return;
  window.__CMV_V2_ACTIVE__ = true;

  const PANEL_ID = "cmv-panel-v2";
  const TOGGLE_ID = "cmv-toggle-v2";
  const LB_ID = "cmv-lightbox-v2";
  const LB_CONTENT = "cmv-lightbox-main-v2";

  let GLOBAL_TOKEN = null;
  let MEDIA_ITEMS = [];

  const state = {
    index: 0,
    zoom: 1,
    rotation: 0,
    fit: "contain",
    theme: "dark",
    panX: 0,
    panY: 0
  };

  /** ---------------------------------------------------
   *  Inject CSS
   * --------------------------------------------------- */
  function ensureStyles() {
    if (document.getElementById("cmv-v2-styles")) return;

    const css = `
      #${PANEL_ID} {
        border:1px solid #ccc; border-radius:6px; background:#fafafa;
        padding:10px; margin-bottom:10px; font-size:13px;
      }
      #${PANEL_ID} .cmv-title { font-weight:600; margin-bottom:6px; }

      .cmv-group {
        border:1px solid #ddd; border-radius:5px; margin-bottom:6px;
      }
      .cmv-group-header {
        padding:6px 8px; cursor:pointer; background:#eee;
        font-weight:600; display:flex; justify-content:space-between; align-items:center;
      }
      .cmv-group-body {
        display:none; padding:6px 8px; background:#fff;
      }

      .cmv-group-tools {
        display:flex; gap:4px; margin-bottom:4px;
      }
      .cmv-group-tools button {
        padding:2px 6px; font-size:11px; border:none; border-radius:3px;
        background:#ddd; cursor:pointer; color:#333;
      }

      .cmv-item {
        padding:4px 0; border-bottom:1px solid #eee;
        display:flex; justify-content:space-between; align-items:center; gap:6px;
      }
      .cmv-item:last-child { border-bottom:none; }
      .cmv-label { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; }
      .cmv-select { margin-right:4px; }

      #${TOGGLE_ID} {
        margin-bottom:8px; padding:5px 10px; background:#0078d4; color:#fff;
        border:none; border-radius:4px; cursor:pointer; font-size:12px;
      }

      /* --------------------------------------------------
       * Lightbox Shell
       * -------------------------------------------------- */
      #${LB_ID} {
        position:fixed; top:0; left:0; width:100vw; height:100vh;
        background:rgba(0,0,0,0.8); display:none; align-items:center;
        justify-content:center; z-index:999999;
      }
      #${LB_CONTENT} {
        width:80vw; height:80vh; background:#111; border-radius:8px;
        box-shadow:0 0 12px rgba(0,0,0,0.5);
        display:flex; flex-direction:column; overflow:hidden;
      }
      #${LB_CONTENT}.cmv-light { background:#f7f7f7; }

      .cmv-lb-header {
        padding:6px 10px; color:#fff;
        background:#222; display:flex; justify-content:space-between; align-items:center;
      }
      .cmv-light .cmv-lb-header { background:#ddd; color:#000; }

      .cmv-lb-main {
        flex:1; background:#000; position:relative;
        display:flex; align-items:center; justify-content:center;
        overflow:hidden;
      }
      .cmv-light .cmv-lb-main { background:#fafafa; }

      /* --------------------------------------------------
       * FIX: Images & Videos (proper scaling)
       * -------------------------------------------------- */
      .cmv-lb-main img,
      .cmv-lb-main video {
        max-width:100% !important;
        max-height:100% !important;
        width:auto !important;
        height:auto !important;
        object-fit:contain !important;
        margin:auto;
        transform-origin:center center !important;
      }

      /* --------------------------------------------------
       * FIX: Native MPulse Document Viewer (iframe)
       * -------------------------------------------------- */
      .cmv-lb-main iframe {
        width:100% !important;
        height:100% !important;
        display:block;
        border:none !important;
        margin:0 !important;
        padding:0 !important;
        object-fit:contain !important;
        contain:strict !important; /* prevents leaking styling */
      }

      /* --------------------------------------------------
       * Navigation arrows / thumbnails
       * -------------------------------------------------- */
      .cmv-nav-arrow {
        position:absolute; top:50%; transform:translateY(-50%);
        font-size:32px; padding:8px 12px; border-radius:24px;
        background:rgba(0,0,0,0.4); color:#fff; cursor:pointer;
      }
      .cmv-nav-left { left:10px; }
      .cmv-nav-right { right:10px; }

      .cmv-lb-thumbs {
        height:80px; background:#181818; padding:4px 6px;
        display:flex; overflow-x:auto; gap:4px; align-items:center;
      }
      .cmv-thumb {
        width:70px; height:60px; border-radius:4px; overflow:hidden;
        border:2px solid transparent; flex:0 0 auto;
        display:flex; align-items:center; justify-content:center;
        background:#333; cursor:pointer;
      }
      .cmv-thumb img { width:100%; height:100%; object-fit:contain; }
      .cmv-thumb.cmv-active { border-color:#00aeff; }

      /* ZIP modal */
      #cmv-progress-v2 {
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.6); display:none;
        align-items:center; justify-content:center; color:#fff;
        z-index:1000000; font-size:18px;
      }
    `;
    const s = document.createElement("style");
    s.id = "cmv-v2-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /** ---------------------------------------------------
   *  Token detection
   * --------------------------------------------------- */
  function getToken() {
    if (GLOBAL_TOKEN) return GLOBAL_TOKEN;

    const perf = performance.getEntries();
    for (const e of perf) {
      const m = e.name.match(/[?&]Token=([^&]+)/i);
      if (m) return (GLOBAL_TOKEN = m[1]);
    }

    if (window.angular) {
      const nodes = document.querySelectorAll("[ng-controller], [ng-repeat]");
      for (let el of nodes) {
        try {
          const s = angular.element(el).scope();
          if (s?.Token) return (GLOBAL_TOKEN = s.Token);
          if (s?.$parent?.Token) return (GLOBAL_TOKEN = s.$parent.Token);
        } catch (_) {}
      }
    }

    return null;
  }

  /** ---------------------------------------------------
   *  Extract MPulse media
   * --------------------------------------------------- */
  function extractRawMedia() {
    try {
      const el = document.querySelector('[ng-repeat="mediadetails in media"]');
      if (!el || !window.angular) return [];
      return angular.element(el).scope()?.media || [];
    } catch {
      return [];
    }
  }

  function buildDownloadUrl(fileName, key, token) {
    const encF = encodeURIComponent(fileName);
    const encT = encodeURIComponent(token);
    const encK = encodeURIComponent(key);
    return `${location.origin}/Media/DownloadMediaStream/${encF}?Token=${encT}&FileName=${encF}&MediaKey=${encK}`;
  }

  function buildViewerUrl(fileName, key, token) {
    const path = `${key},${fileName},WorkOrderRecords`;
    return `${location.origin}/mediaviewer?fileName=${encodeURIComponent(path)}&Token=${encodeURIComponent(token)}`;
  }

  function classifyMedia(raw) {
    const token = getToken();
    if (!token) return { items: [], groups: null };

    const groups = { Images: [], Videos: [], Documents: [], Other: [] };
    const items = [];

    raw.forEach((m) => {
      const file = m.FileName;
      const ext = (file.split(".").pop() || "").toLowerCase();
      const type = (m.FileType || "").toLowerCase();
      const key = m.Key;

      let kind = "other";
      if (["jpg","jpeg","png","gif","bmp","tif","tiff"].includes(type)) kind = "image";
      else if (["mp4","mov","webm","avi","wmv","mpeg","mpg"].includes(type)) kind = "video";
      else if (["pdf","doc","docx","xls","xlsx","csv","ppt","pptx","rtf","txt"].includes(type)) kind = "doc";

      const viewerUrl = (kind === "doc")
        ? buildViewerUrl(file, key, token)
        : buildDownloadUrl(file, key, token);

      const downloadUrl = buildDownloadUrl(file, key, token);

      const item = {
        desc: m.Description || file,
        fileName: file,
        ext,
        kind,
        viewerUrl,
        downloadUrl,
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

  /** ---------------------------------------------------
   *  Build panel UI
   * --------------------------------------------------- */
  function buildGroupHtml(title, list) {
    return `
      <div class="cmv-group">
        <div class="cmv-group-header">
          <span>${title} (${list.length})</span><span>▼</span>
        </div>
        <div class="cmv-group-body">
          <div class="cmv-group-tools">
            <button class="cmv-sel-all">Select All</button>
            <button class="cmv-sel-none">None</button>
          </div>
          ${list.map(i => `
            <div class="cmv-item">
              <input type="checkbox" class="cmv-select" data-idx="${i.flatIndex}">
              <span class="cmv-label" data-idx="${i.flatIndex}">${i.desc}</span>
              <button data-idx="${i.flatIndex}">Preview</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildPanel() {
    ensureStyles();

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `<div class="cmv-title">Media Viewer (Custom)</div><div id="cmv-body-v2">Loading…</div>`;

    const raw = extractRawMedia();
    const body = panel.querySelector("#cmv-body-v2");

    if (!raw.length) {
      body.innerHTML = "<i>No media found.</i>";
      return panel;
    }

    const { items, groups } = classifyMedia(raw);
    MEDIA_ITEMS = items;

    const html =
      buildGroupHtml("Images", groups.Images) +
      buildGroupHtml("Videos", groups.Videos) +
      buildGroupHtml("Documents", groups.Documents) +
      buildGroupHtml("Other", groups.Other);

    body.innerHTML = html;

    // Collapsibles
    body.querySelectorAll(".cmv-group-header").forEach(h =>
      h.addEventListener("click", () => {
        const b = h.nextElementSibling;
        b.style.display = b.style.display === "block" ? "none" : "block";
      })
    );

    body.querySelectorAll(".cmv-sel-all").forEach(btn =>
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb => cb.checked = true);
      })
    );
    body.querySelectorAll(".cmv-sel-none").forEach(btn =>
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select").forEach(cb => cb.checked = false);
      })
    );

    body.querySelectorAll(".cmv-label, .cmv-item button").forEach(el =>
      el.addEventListener("click", e => {
        const idx = Number(el.dataset.idx);
        if (!isNaN(idx)) openLightbox(idx);
      })
    );

    return panel;
  }

  /** ---------------------------------------------------
   *  Toggle native vs custom viewer
   * --------------------------------------------------- */
  function injectToggle() {
    const mediaPane = document.querySelector(".mobile-media-content-area");
    if (!mediaPane) return;

    if (document.getElementById(TOGGLE_ID)) return;

    const btn = document.createElement("button");
    btn.id = TOGGLE_ID;
    btn.textContent = "Enable Custom Viewer";

    btn.onclick = () => {
      const panel = document.getElementById(PANEL_ID);
      const active = !!(panel && panel.style.display !== "none");

      if (active) {
        panel.style.display = "none";
        mediaPane.style.display = "";
        btn.textContent = "Enable Custom Viewer";
      } else {
        const p = buildPanel();
        mediaPane.parentNode.insertBefore(p, mediaPane);
        mediaPane.style.display = "none";
        btn.textContent = "Use Native Viewer";
      }
    };

    mediaPane.parentNode.insertBefore(btn, mediaPane);
  }

  new MutationObserver(() => injectToggle())
    .observe(document.body, { childList: true, subtree: true });

  injectToggle();

  /** ---------------------------------------------------
   *  Lightbox
   * --------------------------------------------------- */
  function ensureLightbox() {
    if (document.getElementById(LB_ID)) return;

    const lb = document.createElement("div");
    lb.id = LB_ID;
    lb.innerHTML = `
      <div id="${LB_CONTENT}">
        <div class="cmv-lb-header">
          <span class="cmv-name"></span>
          <div class="cmv-controls">
            <button data-act="prev">◀</button>
            <button data-act="next">▶</button>
            <button data-act="zoom-in">＋</button>
            <button data-act="zoom-out">－</button>
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

    // Click controls
    lb.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (!act) return;
      e.stopPropagation();
      handleAction(act);
    });

    lb.addEventListener("click", e => {
      if (e.target.id === LB_ID) closeLightbox();
    });

    document.addEventListener("keydown", e => {
      const lbEl = document.getElementById(LB_ID);
      if (lbEl?.style.display !== "flex") return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextItem();
      if (e.key === "ArrowLeft") prevItem();
    });

    // wheel zoom
    const main = document.querySelector(`#${LB_CONTENT} .cmv-lb-main`);
    main.addEventListener("wheel", e => {
      const item = MEDIA_ITEMS[state.index];
      if (!["image","video"].includes(item.kind)) return;
      e.preventDefault();
      e.deltaY < 0 ? zoomIn() : zoomOut();
    });
  }

  function openLightbox(idx) {
    ensureLightbox();
    state.index = idx;
    state.zoom = 1;
    state.rotation = 0;
    state.panX = 0;
    state.panY = 0;

    const lb = document.getElementById(LB_ID);
    lb.style.display = "flex";
    renderLightbox();
  }

  function closeLightbox() {
    const lb = document.getElementById(LB_ID);
    if (lb) lb.style.display = "none";
  }

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
      case "fit-width": state.fit = "cover"; renderTransform(); break;
      case "fit-height": state.fit = "contain"; renderTransform(); break;
      case "fit-original": state.fit = "none"; renderTransform(); break;
      case "theme": toggleTheme(); break;
      case "download": downloadCurrent(); break;
      case "download-all": downloadAll(); break;
      case "download-selected": downloadSelected(); break;
    }
  }

  function currentItem() {
    return MEDIA_ITEMS[state.index];
  }

  function nextItem() {
    state.index = (state.index + 1) % MEDIA_ITEMS.length;
    state.zoom = 1; state.rotation = 0; state.panX = 0; state.panY = 0;
    renderLightbox(true);
  }

  function prevItem() {
    state.index = (state.index - 1 + MEDIA_ITEMS.length) % MEDIA_ITEMS.length;
    state.zoom = 1; state.rotation = 0; state.panX = 0; state.panY = 0;
    renderLightbox(true);
  }

  function zoomIn() { state.zoom *= 1.2; renderTransform(); }
  function zoomOut() { state.zoom /= 1.2; renderTransform(); }
  function zoomReset() { state.zoom = 1; state.panX = 0; state.panY = 0; renderTransform(); }
  function rotate(deg) { state.rotation = (state.rotation + deg) % 360; renderTransform(); }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    const c = document.getElementById(LB_CONTENT);
    c.classList.toggle("cmv-light", state.theme === "light");
  }

  function renderLightbox(skipFade) {
    const item = currentItem();
    const cont = document.getElementById(LB_CONTENT);
    const main = cont.querySelector(".cmv-lb-main");
    const title = cont.querySelector(".cmv-name");
    const thumbs = cont.querySelector(".cmv-lb-thumbs");

    title.textContent = item.desc;

    main.innerHTML = `
      <div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div>
      <div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>
    `;

    let el;
    if (item.kind === "image") {
      el = document.createElement("img");
      el.src = item.downloadUrl;
    } else if (item.kind === "video") {
      el = document.createElement("video");
      el.src = item.downloadUrl;
      el.controls = true;
    } else {
      el = document.createElement("iframe");
      el.src = item.viewerUrl;
    }

    el.style.opacity = skipFade ? "1" : "0";
    main.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = "1");

    renderTransform();

    thumbs.innerHTML = "";
    MEDIA_ITEMS.forEach((m, idx) => {
      const t = document.createElement("div");
      t.className = "cmv-thumb" + (idx === state.index ? " cmv-active" : "");
      t.title = m.desc;

      if (m.kind === "image") {
        const ti = document.createElement("img");
        ti.src = m.downloadUrl;
        t.appendChild(ti);
      } else {
        t.textContent = m.ext.toUpperCase();
      }

      t.onclick = () => {
        state.index = idx;
        state.zoom = 1; state.rotation = 0; state.panX = 0; state.panY = 0;
        renderLightbox(true);
      };

      thumbs.appendChild(t);
    });
  }

  function renderTransform() {
    const cont = document.getElementById(LB_CONTENT);
    const media = cont.querySelector("img, video, iframe");
    if (!media) return;

    const item = currentItem();
    if (["image", "video"].includes(item.kind)) {
      media.style.objectFit = state.fit;
      media.style.transform =
        `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}) rotate(${state.rotation}deg)`;
    } else {
      media.style.transform = "none";
    }
  }

  /** ---------------------------------------------------
   *  Downloads
   * --------------------------------------------------- */
  function downloadCurrent() {
    const item = currentItem();
    if (!item) return;

    let name = (item.desc || item.fileName || "file")
      .replace(/[\\\/:*?"<>|]+/g, "_");

    if (!name.toLowerCase().endsWith("." + item.ext)) {
      name += "." + item.ext;
    }

    const a = document.createElement("a");
    a.href = item.downloadUrl;
    a.download = name;
    a.click();
  }

  function getWOID() {
    const id = document.querySelector("#ID");
    return (id?.innerText || id?.value || "WorkOrder").trim();
  }

  function ensureJSZip(cb) {
    if (window.JSZip) return cb(window.JSZip);

    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js";
    s.onload = () => cb(window.JSZip);
    document.head.appendChild(s);
  }

  function showProgress(msg) {
    let m = document.getElementById("cmv-progress-v2");
    if (!m) {
      m = document.createElement("div");
      m.id = "cmv-progress-v2";
      m.innerHTML = `<div id="cmv-progress-text-v2">${msg}</div>`;
      document.body.appendChild(m);
    }
    m.style.display = "flex";
    document.getElementById("cmv-progress-text-v2").innerText = msg;
  }

  function hideProgress() {
    const m = document.getElementById("cmv-progress-v2");
    if (m) m.style.display = "none";
  }

  async function zipDownload(items, name, JSZip) {
    showProgress("Preparing ZIP…");
    const zip = new JSZip();
    let count = 0;

    for (const item of items) {
      count++;
      showProgress(`Downloading ${count}/${items.length}…`);

      try {
        const resp = await fetch(item.downloadUrl);
        const buf = await resp.arrayBuffer();

        let fname = (item.desc || item.fileName)
          .replace(/[\\\/:*?"<>|]+/g, "_");
        if (!fname.toLowerCase().endsWith("." + item.ext))
          fname += "." + item.ext;

        let folder = "Other";
        if (item.kind === "image") folder = "Images";
        else if (item.kind === "video") folder = "Videos";
        else if (item.kind === "doc") folder = "Documents";

        zip.folder(folder).file(fname, buf);
      } catch (err) {
        console.error("Failed to fetch:", item, err);
      }
    }

    showProgress("Finalizing ZIP…");
    const out = await zip.generateAsync({ type: "blob" });
    hideProgress();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = name;
    a.click();
  }

  function downloadAll() {
    const items = MEDIA_ITEMS;
    const name = getWOID() + ".zip";
    ensureJSZip(JSZip => zipDownload(items, name, JSZip));
  }

  function downloadSelected() {
    const boxes = [...document.querySelectorAll(".cmv-select:checked")];
    const items = boxes.map(x => MEDIA_ITEMS[x.dataset.idx]);
    const name = getWOID() + "-selected.zip";

    ensureJSZip(JSZip => zipDownload(items, name, JSZip));
  }

})();
