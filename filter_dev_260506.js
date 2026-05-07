(function () {

  const SETTINGS_KEY = "mpulseAutoFilter";
  const MODULE_CONFIG = {
  4: { // Work Orders
    name: "Work Orders",
    siteField: "Locations",
    deptField: "Departments"
  },

  5: { // Maintenance Requests
    name: "Maintenance Requests",
    siteField: "Location",
    deptField: "Departments"
  },

  7: { // Scheduled Maintenance
    name: "Scheduled Maintenance",
    siteField: "Locations",
    deptField: "Departments"
  },

  10: { // Equipment
    name: "Equipment",
    siteField: "Location",
    deptField: "Department"
  },

  11: { // Building
    name: "Building",
    siteField: "Location",
    deptField: "Department"
  },

  12: { // Room
    name: "Room",
    siteField: "Location",
    deptField: "Department"
  },

  14: { // Vehicle
    name: "Vehicle",
    siteField: "Location",
    deptField: "Department"
  },

  19: { // Employee
    name: "Employee",
    siteField: "LK_EmpCustomC",
    deptField: "Department"
  },

  // Add others after confirming their SubModuleKey + field names
};

  function getSettings() {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  
    return {
      siteEnabled: saved.siteEnabled ?? false,
      site: saved.site ?? "TX4",
      deptEnabled: saved.deptEnabled ?? false,
      dept: saved.dept ?? "TSG"
    };
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  // ===== INTERCEPTOR =====
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  function makeFilter(s, cfg) {
    const filters = [];
  
    if (s.siteEnabled && s.site && s.site !== "ALL" && cfg.siteField) {
      filters.push([cfg.siteField, "=", s.site]);
    }
  
    if (s.deptEnabled && s.dept && s.dept !== "ALL" && cfg.deptField) {
      filters.push([cfg.deptField, "=", s.dept]);
    }
  
    if (!filters.length) return null;
    if (filters.length === 1) return filters[0];
  
    return filters.reduce((acc, f) => acc ? [acc, "and", f] : f, null);
  }

  function isAutoFilterNode(node, cfg) {
    return (
      Array.isArray(node) &&
      node.length === 3 &&
      [cfg.siteField, cfg.deptField].includes(node[0]) &&
      node[1] === "="
    );
  }
  
  function stripAutoFilters(filter, cfg) {
    if (!Array.isArray(filter)) return filter;
  
    if (isAutoFilterNode(filter, cfg)) return null;
  
    if (filter.length === 3 && typeof filter[1] === "string") {
      const left = stripAutoFilters(filter[0], cfg);
      const op = filter[1].toLowerCase();
      const right = stripAutoFilters(filter[2], cfg);
  
      if (!left && !right) return null;
      if (!left) return right;
      if (!right) return left;
  
      return [left, op, right];
    }
  
    const cleaned = [];
  
    for (const item of filter) {
      if (typeof item === "string" && ["and", "or"].includes(item.toLowerCase())) {
        cleaned.push(item.toLowerCase());
      } else {
        const cleanedItem = stripAutoFilters(item, cfg);
        if (cleanedItem) cleaned.push(cleanedItem);
      }
    }
  
    while (cleaned[0] === "and" || cleaned[0] === "or") cleaned.shift();
    while (cleaned[cleaned.length - 1] === "and" || cleaned[cleaned.length - 1] === "or") cleaned.pop();
  
    if (!cleaned.length) return null;
    if (cleaned.length === 1) return cleaned[0];
  
    return cleaned;
  }
  
  function getVisibleGrids() {
    const grids = [];
  
    for (const el of document.querySelectorAll("*")) {
      try {
        const inst = DevExpress.ui.dxDataGrid.getInstance(el);
        if (!inst || !inst.getDataSource) continue;
  
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
  
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden";
  
        if (visible) {
          grids.push({ el, inst });
        }
      } catch {}
    }
  
    return grids;
  }

  function isPopupVisible() {
    return Array.from(document.querySelectorAll(
      ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
    )).some(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  
  function refreshList() {
    const grids = getVisibleGrids();
  
    const mainGrid = grids.find(({ el }) =>
      el.classList.contains("gridContainer") ||
      el.getAttribute("dx-data-grid") === "listviewgrid"
    );
  
    if (!mainGrid) {
      console.log("⚠️ No main list grid found.");
      return;
    }
  
    try {
      const ds = mainGrid.inst.getDataSource?.();
  
      if (ds && typeof ds.reload === "function") {
        ds.reload();
        console.log("🔄 Reloaded main list grid", mainGrid.el);
      } else {
        console.log("⏭️ Main grid has no reloadable data source", mainGrid.el);
      }
    } catch (e) {
      console.warn("Main grid reload failed", e, mainGrid.el);
    }
  }

  function refreshPopupLists() {
    const popupRoots = Array.from(document.querySelectorAll(
      ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
    )).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  
    const grids = [];
  
    popupRoots.forEach(root => {
      root.querySelectorAll("*").forEach(el => {
        try {
          const inst = DevExpress.ui.dxDataGrid.getInstance(el);
          const ds = inst?.getDataSource?.();
  
          if (ds && typeof ds.reload === "function") {
            grids.push({ el, ds });
          }
        } catch {}
      });
    });
  
    if (!grids.length) {
      console.log("ℹ️ No reloadable popup grids found.");
      return;
    }
  
    grids.forEach(({ el, ds }, i) => {
      try {
        ds.reload();
        console.log(`🔄 Reloaded popup grid ${i + 1}`, el);
      } catch (e) {
        console.warn("Popup grid reload failed", e, el);
      }
    });
  }
  
  function mergeFilter(existing, injected, cfg) {
    const cleanedExisting = stripAutoFilters(existing, cfg);
  
    if (!cleanedExisting) return injected;
    if (!injected) return cleanedExisting;
  
    return [cleanedExisting, "and", injected];
  }

  function hasUserFilter(filter, field) {
    if (!filter) return false;
  
    if (Array.isArray(filter) && filter.length === 3) {
      return filter[0] === field;
    }
  
    if (Array.isArray(filter)) {
      return filter.some(f => hasUserFilter(f, field));
    }
  
    return false;
  }

  function patchPayload(payload, context = {}) {
    if (!payload) return payload;
  
    const cfg = MODULE_CONFIG[payload.SubModuleKey];
    if (!cfg) return payload;
  
    if (payload.RequestType === "Customize") {
      console.log(`⏭️ Skipping ${cfg.name} Customize request`);
      return payload;
    }
  
    const s = getSettings();
  
    payload.loadOptions = payload.loadOptions || {};
  
    const existing = payload.loadOptions.filter || null;
    const injected = makeFilter(s, cfg);
  
    payload.loadOptions.filter = mergeFilter(existing, injected, cfg);
  
    console.log(`✅ Auto filter applied to ${cfg.name}:`, {
      popup: !!context.isLinkPopup,
      url: context.url,
      RequestType: payload.RequestType,
      take: payload.loadOptions.take,
      filter: payload.loadOptions.filter
    });
  
    return payload;
  }

  function normalizeVisibleLinkPopupGrid() {
    const popup = Array.from(document.querySelectorAll(
      ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
    )).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  
    if (!popup) return;
  
    const popupText = popup.innerText || "";
  
    // ✅ Only normalize Link Additional Asset popup
    if (!/link\s+additional\s+asset/i.test(popupText)) {
      console.log("⏭️ Skipping popup normalization:", popupText.slice(0, 80));
      return;
    }
  
    let grid = null;
  
    popup.querySelectorAll("*").forEach(el => {
      if (grid) return;
  
      try {
        const inst = DevExpress.ui.dxDataGrid.getInstance(el);
        if (inst?.columnOption) grid = inst;
      } catch {}
    });
  
    if (!grid) {
      console.log("No Link Additional Asset popup grid found");
      return;
    }
  
    const cols = grid.option("columns") || [];
  
    cols.forEach((col, i) => {
      const field = [
        col.dataField,
        col.name,
        col.caption
      ].filter(Boolean).join(" ");
  
      const keep =
        /id/i.test(field) ||
        /code/i.test(field) ||
        /desc/i.test(field) ||
        /description/i.test(field);
  
      grid.columnOption(i, "visible", keep);
    });
  
    cols.forEach((col, i) => {
      const field = [
        col.dataField,
        col.name,
        col.caption
      ].filter(Boolean).join(" ");
  
      if (/id|code/i.test(field)) {
        grid.columnOption(i, "width", 140);
      }
  
      if (/desc|description/i.test(field)) {
        grid.columnOption(i, "width", 520);
      }
    });
  
    grid.updateDimensions();
  
    console.log("✅ Normalized Link Additional Asset popup only");
  }

  let popupNormalizeTimer = null;

  function schedulePopupNormalize(reason) {
    clearTimeout(popupNormalizeTimer);
  
    popupNormalizeTimer = setTimeout(() => {
      console.log("🧱 Normalizing popup grid:", reason);
      normalizeVisibleLinkPopupGrid();
    }, 400);
  }
  

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__url = typeof url === "string" ? url : "";
    return originalOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function (body) {
    if (typeof body === "string") {
      try {
        const payload = JSON.parse(body);
  
        const isLinkPopup =
          this.__url?.includes("LoadLinkPopUp") ||
          payload.RequestType === "LoadLinkPopUp";
  
        const isPopupRequest =
          isPopupVisible() &&
          ["Load", "Filter", "TemplateChange"].includes(payload.RequestType);
          
        const shouldNormalizePopup = isLinkPopup || isPopupRequest;
  
        if (payload && payload.SubModuleKey) {
          patchPayload(payload, { isLinkPopup: shouldNormalizePopup });
        }
  
        if (shouldNormalizePopup) {
          this.addEventListener("loadend", () => {
            schedulePopupNormalize(
              isLinkPopup ? "LoadLinkPopUp completed" : "popup Load completed"
            );
          });
        }
  
        body = JSON.stringify(payload);
      } catch {}
    }
  
    return originalSend.call(this, body);
  };

  console.log("🧪 Auto filter interceptor active");

  // ===== UI =====
  function injectUI() {
    if (document.querySelector("#mpulseAutoFilterCompact")) return;
  
    const s = getSettings();
    const nav = document.querySelector(".mainNavigationLists");
    if (!nav) return;
  
    const li = document.createElement("li");
    li.id = "mpulseAutoFilterCompact";
  
    li.style.cssText = `
      position:relative;
      display:flex;
      align-items:center;
      margin-top:8px;
      margin-right:8px;
    `;
  
    li.innerHTML = `
      <button id="afsIconBtn" title="Auto Filters" style="
        width:34px;
        height:34px;
        border:1px solid #cfd6df;
        border-radius:50%;
        background:#fff;
        box-shadow:0 1px 4px rgba(0,0,0,.15);
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#374151;
      ">
        <i class="fa fa-filter"></i>
      </button>
  
      <span id="afsDot" style="
        position:absolute;
        top:2px;
        right:2px;
        width:9px;
        height:9px;
        border-radius:50%;
        background:#16a34a;
        border:1px solid #fff;
        display:none;
      "></span>
  
      <div id="afsMenu" style="
        display:none;
        position:absolute;
        top:40px;
        right:0;
        width:260px;
        padding:12px;
        background:#fff;
        border:1px solid #cfd6df;
        border-radius:10px;
        box-shadow:0 8px 24px rgba(0,0,0,.18);
        z-index:99999;
        font-size:12px;
        color:#1f2933;
      ">
        <div style="font-weight:600;margin-bottom:10px;">
          Auto List Filters
        </div>
  
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <label>
            <input id="afsSiteEnabled" type="checkbox" ${s.siteEnabled ? "checked" : ""}>
            Site
          </label>
  
          <select id="afsSite" style="width:120px;height:26px;">
            ${["CA1","FL1","FL2","IL1","IL2","MA1","MO1","NJ2","NJ3","NJ5","NY1","OH1","TX3","TX4","VA1","WV2"].map(x =>
              `<option value="${x}" ${s.site === x ? "selected" : ""}>${x}</option>`
            ).join("")}
          </select>
        </div>
  
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <label>
            <input id="afsDeptEnabled" type="checkbox" ${s.deptEnabled ? "checked" : ""}>
            Dept
          </label>
  
          <select id="afsDept" style="width:120px;height:26px;">
            ${["ALL","TSG","FAC","RCM","PRD"].map(x =>
              `<option value="${x}" ${s.dept === x ? "selected" : ""}>${x}</option>`
            ).join("")}
          </select>
        </div>
  
        <div id="afsStatus" style="
          padding:6px 8px;
          border-radius:6px;
          background:#f3f4f6;
          color:#374151;
          margin-bottom:10px;
          font-size:11px;
        "></div>
  
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="afsOff" style="
            border:1px solid #d1d5db;
            background:#f9fafb;
            border-radius:6px;
            padding:4px 8px;
            cursor:pointer;
          ">Off</button>
  
          <button id="afsApply" style="
            border:1px solid #2563eb;
            background:#2563eb;
            color:#fff;
            border-radius:6px;
            padding:4px 10px;
            cursor:pointer;
          ">Apply</button>
        </div>
      </div>
    `;
  
    const userInfo = nav.querySelector(".userInfoWrap");
    if (userInfo && userInfo.parentElement.tagName === "LI") {
      nav.insertBefore(li, userInfo.parentElement);
    } else {
      nav.appendChild(li);
    }
  
    const iconBtn = li.querySelector("#afsIconBtn");
    const menu = li.querySelector("#afsMenu");
    const dot = li.querySelector("#afsDot");
  
    const siteToggle = li.querySelector("#afsSiteEnabled");
    const siteSelect = li.querySelector("#afsSite");
    const deptToggle = li.querySelector("#afsDeptEnabled");
    const deptSelect = li.querySelector("#afsDept");
    const applyBtn = li.querySelector("#afsApply");
    const offBtn = li.querySelector("#afsOff");
    const status = li.querySelector("#afsStatus");
  
    function updateStatus() {
      const s = getSettings();
      const parts = [];
  
      if (s.siteEnabled && s.site !== "ALL") parts.push(`Site: ${s.site}`);
      if (s.deptEnabled && s.dept !== "ALL") parts.push(`Dept: ${s.dept}`);
  
      status.textContent = parts.length ? parts.join(" | ") : "Auto filters off";
      dot.style.display = parts.length ? "block" : "none";
      iconBtn.style.borderColor = parts.length ? "#16a34a" : "#cfd6df";
    }
  
    function saveFromUI() {
      const s = getSettings();
  
      s.siteEnabled = siteToggle.checked;
      s.site = siteSelect.value;
  
      s.deptEnabled = deptToggle.checked;
      s.dept = deptSelect.value;
  
      saveSettings(s);
      updateStatus();
    }
  
    iconBtn.onclick = (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    };
  
    menu.onclick = (e) => e.stopPropagation();
  
    document.addEventListener("click", () => {
      menu.style.display = "none";
    });
  
    siteToggle.onchange = saveFromUI;
    siteSelect.onchange = saveFromUI;
    deptToggle.onchange = saveFromUI;
    deptSelect.onchange = saveFromUI;
  
    applyBtn.onclick = () => {
      const freshSettings = {
        siteEnabled: siteToggle.checked,
        site: siteSelect.value,
        deptEnabled: deptToggle.checked,
        dept: deptSelect.value
      };
    
      saveSettings(freshSettings);
      updateStatus();
      menu.style.display = "none";
    
      setTimeout(refreshList, 100);
      setTimeout(refreshList, 600);
    };
  
    offBtn.onclick = () => {
      const s = getSettings();
  
      s.siteEnabled = false;
      s.deptEnabled = false;
  
      saveSettings(s);
  
      siteToggle.checked = false;
      deptToggle.checked = false;
  
      updateStatus();
      menu.style.display = "none";
      refreshList();
    };
  
    updateStatus();
  }

  const observer = new MutationObserver(() => injectUI());
  observer.observe(document.body, { childList: true, subtree: true });

  injectUI();

  let lastModuleSeen = null;
  let lastModuleRefreshAt = 0;
  
  function maybeRefreshAfterModuleChange() {
    const activeModule =
      document.querySelector(".siteMainNavLists li.active")?.id ||
      location.hash ||
      location.href;
  
    const now = Date.now();
  
    if (activeModule !== lastModuleSeen && now - lastModuleRefreshAt > 1000) {
      lastModuleSeen = activeModule;
      lastModuleRefreshAt = now;
  
      console.log("🔄 Module changed; refreshing list");

      setTimeout(refreshList, 600);
      // setTimeout(refreshList, 1200);
      // setTimeout(refreshList, 2200);
    }
  }
  
  // const moduleObserver = new MutationObserver(() => {
  //   maybeRefreshAfterModuleChange();
  // });
  
  // moduleObserver.observe(document.body, {
  //   childList: true,
  //   subtree: true,
  //   attributes: true,
  //   attributeFilter: ["class"]
  // });
  
  // maybeRefreshAfterModuleChange();

  let lastPopupKey = null;
  let popupRefreshTimer = null;
  
  function getPopupKey() {
    const popup = Array.from(document.querySelectorAll(
      ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
    )).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  
    if (!popup) return null;
  
    return popup.id || popup.className || popup.innerText?.slice(0, 80) || "popup";
  }
  
  const popupObserver = new MutationObserver(() => {
    const popupKey = getPopupKey();
  
    if (!popupKey) {
      lastPopupKey = null;
      return;
    }
  
    // Only refresh once for this popup instance
    if (popupKey === lastPopupKey) return;
  
    lastPopupKey = popupKey;
  
    clearTimeout(popupRefreshTimer);
  
    popupRefreshTimer = setTimeout(() => {
      console.log("🔄 New popup detected; normalizing popup grids once");
      normalizeVisibleLinkPopupGrid();
      // setTimeout(refreshPopupLists, 600);
    }, 800);
  });
  
  popupObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

})();
