/* ============================================================
 * CMV v3.2 — Custom Media Viewer for MPulse
 * Author: Daniel Olivarez
 * Mode: Readable Full Source (for GitHub)
 * Build: 2025-11-13
 * ============================================================ */

(() => {
  /* ------------------------------------------------------------
   * Prevent double-loading
   * ------------------------------------------------------------ */
  if (window.__CMV_V3_ACTIVE__) return;
  window.__CMV_V3_ACTIVE__ = true;

  /* ------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------ */
  const PANEL_ID   = "cmv-panel-v3";
  const TOGGLE_ID  = "cmv-toggle-v3";
  const LB_ID      = "cmv-lightbox-v3";
  const LB_CONTENT = "cmv-lightbox-main-v3";

  let GLOBAL_TOKEN = null;
  let MEDIA_ITEMS  = [];

  /* ------------------------------------------------------------
   * Lightbox rendering state
   * ------------------------------------------------------------ */
  const state = {
    index: 0,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    fit: "contain",
    theme: "dark"
  };

  /* ============================================================
   *  1) CSS Injection
   * ============================================================ */
  function ensureStyles() {
    if (document.getElementById("cmv-v3-styles")) return;

    const css = `
      /* --------------------------------------------------------
       * Custom Viewer Panel
       * -------------------------------------------------------- */
      #${PANEL_ID} {
        border:1px solid #ccc;
        border-radius:6px;
        background:#fafafa;
        padding:10px;
        margin-bottom:10px;
        font-size:13px;
      }
      #${PANEL_ID} .cmv-title {
        font-weight:600;
        margin-bottom:6px;
      }

      /* --------------------------------------------------------
       * Toggle Button
       * -------------------------------------------------------- */
      #${TOGGLE_ID} {
        margin-bottom:8px;
        padding:6px 12px;
        background:#0078d4;
        color:white;
        border:none;
        border-radius:4px;
        cursor:pointer;
        font-size:13px;
      }

      /* --------------------------------------------------------
       * Group Sections
       * -------------------------------------------------------- */
      .cmv-group {
        border:1px solid #ddd;
        border-radius:5px;
        margin-bottom:8px;
      }
      .cmv-group-header {
        padding:6px 10px;
        background:#eee;
        font-weight:600;
        display:flex;
        justify-content:space-between;
        cursor:pointer;
      }
      .cmv-group-body {
        display:none;
        padding:6px 10px;
        background:white;
      }

      .cmv-item {
        padding:5px 0;
        border-bottom:1px solid #f0f0f0;
        display:flex;
        gap:6px;
        align-items:center;
      }
      .cmv-item:last-child {
        border-bottom:none;
      }
      .cmv-label {
        flex:1;
        cursor:pointer;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .cmv-select {
        margin-right:4px;
      }

      /* --------------------------------------------------------
       * Lightbox
       * -------------------------------------------------------- */
      #${LB_ID} {
        position:fixed;
        top:0; left:0;
        width:100vw; height:100vh;
        background:rgba(0,0,0,0.85);
        display:none;
        align-items:center;
        justify-content:center;
        z-index:999999;
      }
      #${LB_CONTENT} {
        width:80vw;
        height:80vh;
        background:#111;
        border-radius:8px;
        display:flex;
        flex-direction:column;
        overflow:hidden;
      }
      .cmv-light { background:#f4f4f4 !important; }

      .cmv-lb-header {
        padding:6px 10px;
        background:#222;
        color:white;
        font-size:13px;
        display:flex;
        justify-content:space-between;
        align-items:center;
      }
      .cmv-light .cmv-lb-header {
        background:#ddd !important;
        color:black !important;
      }

      .cmv-lb-main {
        flex:1;
        background:#000;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        position:relative;
      }
      .cmv-light .cmv-lb-main {
        background:#fafafa !important;
      }

      /* Prevent MPulse viewer cropping */
      .cmv-lb-main iframe {
        width:100% !important;
        height:100% !important;
        border:none !important;
        object-fit:contain !important;
      }

      /* Correct image + video scaling */
      .cmv-lb-main img,
      .cmv-lb-main video {
        max-width:100% !important;
        max-height:100% !important;
        width:auto !important;
        height:auto !important;
        object-fit:contain !important;
        transform-origin:center center !important;
      }

      /* Arrows */
      .cmv-nav-arrow {
        position:absolute;
        top:50%;
        transform:translateY(-50%);
        padding:10px 14px;
        background:rgba(0,0,0,0.4);
        color:white;
        cursor:pointer;
        border-radius:20px;
        font-size:28px;
      }
      .cmv-nav-left { left:10px; }
      .cmv-nav-right { right:10px; }

      /* Thumbnails */
      .cmv-lb-thumbs {
        height:80px;
        background:#181818;
        display:flex;
        gap:4px;
        padding:4px;
        overflow-x:auto;
      }
      .cmv-thumb {
        width:70px;
        height:60px;
        background:#333;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:4px;
        border:2px solid transparent;
        cursor:pointer;
        flex:0 0 auto;
      }
      .cmv-thumb img {
        width:100%;
        height:100%;
        object-fit:contain;
      }
      .cmv-thumb.cmv-active {
        border-color:#00aaff;
      }

      /* ZIP Download Modal */
      #cmv-progress-v3 {
        position:fixed;
        top:0; left:0;
        width:100%; height:100%;
        background:rgba(0,0,0,0.6);
        display:none;
        align-items:center;
        justify-content:center;
        color:white;
        z-index:1000000;
        font-size:18px;
      }
    `;

    const style = document.createElement("style");
    style.id = "cmv-v3-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* END PART 1/6 */

  /* ============================================================
   *  2) TOKEN EXTRACTION
   * ============================================================ */
  function ensureToken() {
    if (GLOBAL_TOKEN) return GLOBAL_TOKEN;

    /* ---- Check network performance entries ---- */
    const perf = performance.getEntries();
    for (const p of perf) {
      const m = p.name.match(/[?&]Token=([^&]+)/i);
      if (m) return (GLOBAL_TOKEN = m[1]);
    }

    /* ---- Check Angular scopes ---- */
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
   * 3) UNIVERSAL MEDIA EXTRACTION (Desktop + Mobile)
   * ============================================================ */
  function extractRawMedia() {
    try {
      /* Works for:
       * - Desktop PC browser
       * - Mobile browser (mobile layout)
       * - Mobile browser (desktop view)
       */

      const sel = [
        /* Desktop */
        "#MediaTab .mobile-media-content-area [ng-repeat='mediadetails in media']",

        /* Mobile view */
        "#falTabContainerWrapper .mobile-media-content-area [ng-repeat='mediadetails in media']",

        /* Fallback: any media repeater */
        "[ng-repeat='mediadetails in media']"
      ];

      for (const s of sel) {
        const el = document.querySelector(s);
        if (!el) continue;
        if (!window.angular) continue;

        const scope = angular.element(el).scope();
        if (scope?.media?.length) return scope.media;
      }

      return [];
    } catch {
      return [];
    }
  }

  /* ============================================================
   * 4) URL Builders
   * ============================================================ */
  function buildDownloadUrl(fileName, key, token) {
    const f = encodeURIComponent(fileName);
    const k = encodeURIComponent(key);
    const t = encodeURIComponent(token);
    return `${location.origin}/Media/DownloadMediaStream/${f}?Token=${t}&FileName=${f}&MediaKey=${k}`;
  }

  function buildViewerUrl(fileName, key, token) {
    const path = `${key},${fileName},WorkOrderRecords`;
    return `${location.origin}/mediaviewer?fileName=${encodeURIComponent(path)}&Token=${encodeURIComponent(token)}`;
  }

  /* ============================================================
   * 5) MEDIA CLASSIFICATION
   * ============================================================ */
  function classifyMedia(rawMedia) {
    const token = ensureToken();
    if (!token) return { items: [], groups: null };

    const exts = {
      image: ["jpg","jpeg","png","gif","bmp","tif","tiff"],
      video: ["mp4","mov","webm","avi","wmv","mpeg","mpg"],
      doc:   ["pdf","doc","docx","xls","xlsx","csv","ppt","pptx","rtf","txt"]
    };

    const groups = {
      Images: [],
      Videos: [],
      Documents: [],
      Other: []
    };

    const items = [];

    rawMedia.forEach((m) => {
      const file = m.FileName;
      const ext  = (file.split(".").pop() || "").toLowerCase();
      const key  = m.Key;

      let kind = "other";
      if (exts.image.includes(ext)) kind = "image";
      else if (exts.video.includes(ext)) kind = "video";
      else if (exts.doc.includes(ext))   kind = "doc";

      const item = {
        desc: m.Description || file,
        fileName: file,
        ext,
        kind,
        downloadUrl: buildDownloadUrl(file, key, token),
        viewerUrl:   kind === "doc"
                      ? buildViewerUrl(file, key, token)
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
   * 6) GROUP HTML BUILDER
   * ============================================================ */
  function groupHTML(name, arr) {
    return `
      <div class="cmv-group">
        <div class="cmv-group-header">
          ${name} (${arr.length})
          <span>▼</span>
        </div>
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
      </div>
    `;
  }

  /* END PART 2/6 */

  /* ============================================================
   * 7) BUILD CUSTOM PANEL
   * ============================================================ */
  function buildPanel() {
    ensureStyles();

    const raw = extractRawMedia();
    const existing = document.getElementById(PANEL_ID);
    const panel = existing || document.createElement("div");
    panel.id = PANEL_ID;

    if (!raw.length) {
      panel.innerHTML = `
        <div class="cmv-title">Media Viewer (Custom)</div>
        <i>No media found.</i>
      `;
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

    /* Expand / collapse */
    panel.querySelectorAll(".cmv-group-header").forEach(header => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        body.style.display = body.style.display === "block" ? "none" : "block";
      });
    });

    /* Select All / None */
    panel.querySelectorAll(".cmv-sel-all").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select")
          .forEach(cb => cb.checked = true);
      });
    });

    panel.querySelectorAll(".cmv-sel-none").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        btn.closest(".cmv-group").querySelectorAll(".cmv-select")
          .forEach(cb => cb.checked = false);
      });
    });

    /* Preview items */
    panel.querySelectorAll(".cmv-label, .cmv-item button").forEach(el => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.idx);
        if (!isNaN(idx)) openLightbox(idx);
      });
    });

    return panel;
  }

  /* ============================================================
   * 8) TOGGLE BUTTON (Desktop + Mobile hybrid)
   * ============================================================ */
  function findMediaPane() {
    const sel = [
      "#MediaTab .mobile-media-content-area",
      "#falTabContainerWrapper .mobile-media-content-area",
      ".mobile-media-content-area"
    ];
    for (const s of sel) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function injectToggle() {
    const pane = findMediaPane();
    if (!pane) return;

    let btn = document.getElementById(TOGGLE_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = TOGGLE_ID;
      btn.textContent = "Switch to Custom Viewer";
      pane.parentNode.insertBefore(btn, pane);
    }

    btn.onclick = () => {
      const existing = document.getElementById(PANEL_ID);

      /* Turn OFF custom viewer → back to native */
      if (existing && existing.style.display !== "none") {
        existing.style.display = "none";
        pane.style.display = "";
        btn.textContent = "Switch to Custom Viewer";
        return;
      }

      /* Turn ON custom viewer */
      const panel = buildPanel();
      pane.style.display = "none";
      panel.style.display = "";
      btn.textContent = "Switch to Native Viewer";

      if (!existing) pane.parentNode.insertBefore(panel, pane);
    };
  }

  /* Mutation observer ensures toggle appears even after MPulse reloads UI */
  const mo = new MutationObserver(() => injectToggle());
  mo.observe(document.body, { childList: true, subtree: true });

  injectToggle();

  /* ============================================================
   * 9) LIGHTBOX — SETUP
   * ============================================================ */
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
          <div class="cmv-nav-arrow cmv-nav-left"  data-act="prev">❮</div>
          <div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>
        </div>

        <div class="cmv-lb-thumbs"></div>
      </div>
    `;

    document.body.appendChild(lb);

    /* Close when clicking background */
    lb.addEventListener("click", e => {
      if (e.target.id === LB_ID) closeLightbox();
    });

    /* Control clicks */
    lb.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (act) {
        e.stopPropagation();
        handleAction(act);
      }
    });

    /* Keyboard shortcuts */
    document.addEventListener("keydown", e => {
      const lbEl = document.getElementById(LB_ID);
      if (lbEl.style.display !== "flex") return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextItem();
      if (e.key === "ArrowLeft")  prevItem();
    });

    /* Middle mouse panning */
    const main = lb.querySelector(".cmv-lb-main");
    let panning = false,
        startX = 0, startY = 0,
        baseX = 0,  baseY = 0;

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

    document.addEventListener("mouseup", () => panning = false);
  }

  /* ============================================================
   * 10) LIGHTBOX OPEN / CLOSE
   * ============================================================ */
  function currentItem() {
    return MEDIA_ITEMS[state.index];
  }

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

  function closeLightbox() {
    const lb = document.getElementById(LB_ID);
    if (lb) lb.style.display = "none";
  }

  /* END PART 3/6 */

  /* ============================================================
   * 11) LIGHTBOX ACTION HANDLERS
   * ============================================================ */
  function handleAction(act) {
    switch (act) {
      case "close":          closeLightbox(); break;
      case "prev":           prevItem(); break;
      case "next":           nextItem(); break;
      case "zoom-in":        zoomIn(); break;
      case "zoom-out":       zoomOut(); break;
      case "zoom-reset":     zoomReset(); break;
      case "rotate-left":    rotate(-90); break;
      case "rotate-right":   rotate(90); break;
      case "fit-width":      state.fit = "cover"; renderTransform(); break;
      case "fit-height":     state.fit = "contain"; renderTransform(); break;
      case "fit-original":   state.fit = "none"; renderTransform(); break;
      case "theme":          toggleTheme(); break;
      case "download":       downloadCurrent(); break;
      case "download-all":   downloadAll(); break;
      case "download-selected": downloadSelected(); break;
    }
  }

  /* ============================================================
   * 12) ITEM NAVIGATION
   * ============================================================ */
  function nextItem() {
    state.index = (state.index + 1) % MEDIA_ITEMS.length;
    resetTransforms();
    renderLightbox(true);
  }

  function prevItem() {
    state.index = (state.index - 1 + MEDIA_ITEMS.length) % MEDIA_ITEMS.length;
    resetTransforms();
    renderLightbox(true);
  }

  function resetTransforms() {
    state.zoom = 1;
    state.rotation = 0;
    state.panX = 0;
    state.panY = 0;
  }

  /* ============================================================
   * 13) ZOOM / ROTATE
   * ============================================================ */
  function zoomIn() {
    state.zoom *= 1.20;
    renderTransform();
  }

  function zoomOut() {
    state.zoom /= 1.20;
    renderTransform();
  }

  function zoomReset() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    renderTransform();
  }

  function rotate(deg) {
    state.rotation = (state.rotation + deg) % 360;
    renderTransform();
  }

  function toggleTheme() {
    state.theme = (state.theme === "dark" ? "light" : "dark");
    const cont = document.getElementById(LB_CONTENT);
    cont.classList.toggle("cmv-light", state.theme === "light");
  }

  /* ============================================================
   * 14) RENDER LIGHTBOX CONTENT
   * ============================================================ */
  function renderLightbox(skipFade) {
    const item  = currentItem();
    const cont  = document.getElementById(LB_CONTENT);
    const main  = cont.querySelector(".cmv-lb-main");
    const title = cont.querySelector(".cmv-name");
    const thumbs= cont.querySelector(".cmv-lb-thumbs");

    title.textContent = item.desc;

    /* Clear main container except nav arrows */
    main.innerHTML = `
      <div class="cmv-nav-arrow cmv-nav-left" data-act="prev">❮</div>
      <div class="cmv-nav-arrow cmv-nav-right" data-act="next">❯</div>
    `;

    /* Create correct media element */
    let el;
    if (item.kind === "image") {
      el = document.createElement("img");
      el.src = item.downloadUrl;

    } else if (item.kind === "video") {
      el = document.createElement("video");
      el.src = item.downloadUrl;
      el.controls = true;

    } else {
      /* Native MPulse doc viewer */
      el = document.createElement("iframe");
      el.src = item.viewerUrl;
    }

    if (!skipFade) el.style.opacity = "0";
    main.appendChild(el);
    if (!skipFade) requestAnimationFrame(() => el.style.opacity = "1");

    renderTransform();

    /* Thumbnails */
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
        resetTransforms();
        renderLightbox(true);
      };

      thumbs.appendChild(t);
    });
  }

  /* ============================================================
   * 15) MEDIA TRANSFORM LOGIC
   * ============================================================ */
  function renderTransform() {
    const cont = document.getElementById(LB_CONTENT);
    const el = cont.querySelector("img,video,iframe");
    if (!el) return;

    const item = currentItem();

    if (["image", "video"].includes(item.kind)) {
      el.style.objectFit = state.fit;

      el.style.transform =
        `translate(${state.panX}px, ${state.panY}px)
         scale(${state.zoom})
         rotate(${state.rotation}deg)`;
    } else {
      /* Don't transform if iframe */
      el.style.transform = "none";
    }
  }

  /* END PART 4/6 */

  /* ============================================================
   * 16) DOWNLOAD — SINGLE
   * ============================================================ */
  function downloadCurrent() {
    const item = currentItem();
    if (!item) return;

    let name = (item.desc || item.fileName).replace(/[\\\/:*?"<>|]/g, "_");
    if (!name.toLowerCase().endsWith("." + item.ext))
      name += "." + item.ext;

    const a = document.createElement("a");
    a.href = item.downloadUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  }

  /* ============================================================
   * 17) UTILITY — WORK ORDER ID
   * ============================================================ */
  function getWOID() {
    const id = document.querySelector("#ID");
    return (id?.innerText || id?.value || "WorkOrder").trim();
  }

  /* ============================================================
   * 18) SELECTED MEDIA
   * ============================================================ */
  function getSelected() {
    return [...document.querySelectorAll(".cmv-select:checked")]
      .map(cb => MEDIA_ITEMS[cb.dataset.idx]);
  }

  /* ============================================================
   * 19) JSZip LOADER
   * ============================================================ */
  function ensureJSZip(cb) {
    if (window.JSZip) return cb(window.JSZip);

    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js";
    s.onload = () => cb(window.JSZip);
    s.onerror = () => alert("Failed to load JSZip");
    document.head.appendChild(s);
  }

  /* ============================================================
   * 20) PROGRESS MODAL
   * ============================================================ */
  function showProgress(text) {
    let modal = document.getElementById("cmv-progress-v2");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "cmv-progress-v2";
      modal.innerHTML = `<div id="cmv-progress-text-v2">${text}</div>`;
      modal.style.display = "flex";
      document.body.appendChild(modal);
    } else {
      modal.style.display = "flex";
      modal.querySelector("#cmv-progress-text-v2").innerText = text;
    }
  }

  function hideProgress() {
    const modal = document.getElementById("cmv-progress-v2");
    if (modal) modal.style.display = "none";
  }

  /* ============================================================
   * 21) ZIP DOWNLOAD ENGINE
   * ============================================================ */
  async function downloadZip(items, zipName, JSZip) {
    showProgress("Preparing ZIP…");

    const zip = new JSZip();
    let count = 0;

    for (const item of items) {
      count++;
      showProgress(`Downloading ${count}/${items.length}…`);

      try {
        const buf = await (await fetch(item.downloadUrl)).arrayBuffer();

        let name = (item.desc || item.fileName).replace(/[\\\/:*?"<>|]/g, "_");
        if (!name.toLowerCase().endsWith("." + item.ext)) {
          name += "." + item.ext;
        }

        let folder = "Other";
        if (item.kind === "image") folder = "Images";
        else if (item.kind === "video") folder = "Videos";
        else if (item.kind === "doc") folder = "Documents";

        zip.folder(folder).file(name, buf);
      } catch (err) {
        console.error("Download failed:", item, err);
      }
    }

    showProgress("Finalizing ZIP…");

    const out = await zip.generateAsync({ type: "blob" });
    hideProgress();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = zipName;
    a.click();
  }

  /* ============================================================
   * 22) PUBLIC ZIP FUNCTIONS
   * ============================================================ */
  function downloadAll() {
    ensureJSZip(JSZip =>
      downloadZip(MEDIA_ITEMS, getWOID() + ".zip", JSZip)
    );
  }

  function downloadSelected() {
    const sel = getSelected();
    ensureJSZip(JSZip =>
      downloadZip(sel, getWOID() + "-selected.zip", JSZip)
    );
  }

})();  /* END OF CMV v3.2 MAIN WRAPPER */

/* ============================================================
 * 23) FINAL WATCHDOG (MOBILE + DESKTOP)
 * Ensures toggle always attaches even if MPulse re-renders tab
 * ============================================================ */

const __cmvObserver = new MutationObserver(() => {
  cmvLocatePanelSlot();
});
__cmvObserver.observe(document.body, { childList: true, subtree: true });


/* ============================================================
 * 24) EXPORT DIAGNOSTIC (Optional)
 * Lets you verify CMV version from console:
 *     window.CMV_VERSION
 * ============================================================ */
window.CMV_VERSION = "3.2";

/* ============================================================
 * END CMV v3.2
 * ============================================================ */
;


