(function () {

  if (window.__WO_TYPE_INTERCEPTOR_INSTALLED__) {
    console.log("WO interceptor already installed.");
    return;
  }

  window.__WO_TYPE_INTERCEPTOR_INSTALLED__ = true;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {

    this.addEventListener("load", function () {

      try {

        if (!this.responseText) return;

        const url = this._url || "";

        // ---- GetLayout ----
        if (url.includes("GetLayout")) {
          const json = JSON.parse(this.responseText);
        
          window.__MPULSE_LAYOUT__ = json;
        
          const group =
            json?.LayoutRequestClone?.UserDetails?.credentials?.GroupDescriptions ||
            json?.UserDetails?.credentials?.GroupDescriptions ||
            json?.credentials?.GroupDescriptions ||
            "";
        
          storeSecurityGroup(group);
        
          if (typeof window.__applyPMLock === "function") {
            setTimeout(window.__applyPMLock, 100);
          }
        }

        // ---- GetFormViewData ----
        if (url.includes("GetFormViewData")) {

          const json = JSON.parse(this.responseText);

          window.__MPULSE_FORMVIEW__ = json;
          if (typeof window.__applyPMLock === "function") {
            setTimeout(window.__applyPMLock, 100);
          }

          console.log(
            "Stored GetFormViewData:",
            json?.WorkOrderType?.Desc
          );
        }

        // ---- Load ----
        if (url.includes("/Load")) {

          const json = JSON.parse(this.responseText);

          window.__MPULSE_LOAD__ = json;
          if (typeof window.__applyPMLock === "function") {
            setTimeout(window.__applyPMLock, 100);
          }

          console.log(
            "Stored Load:",
            json?.SelectedObject?.WorkOrderType?.Desc
          );
        }

      } catch (err) {
        console.warn("WO interceptor parse error:", err);
      }

    });

    return originalSend.apply(this, arguments);
  };

  console.log("WO interceptor installed.");

})();
(function () {
  const PM_TYPES = [
    "preventative maintenance",
    "preventive maintenance",
    "pm"
  ];

  const LOCK_FIELDS = [
    "Work Order Priority",
    "Date Due"
  ];

  const ADMIN_SECURITY_GROUPS = [
    "Admin",
    "Administrator",
    "System Manager",
    "Mpulse Custodian (System Designer)"
  ];

  sessionStorage.removeItem("__MPULSE_SECURITY_GROUP__");
  window.__MPULSE_SECURITY_GROUP__ = "";
  
  function getCurrentUserSecurityGroup() { 
    const fromLayout =
      window.__MPULSE_LAYOUT__?.LayoutRequestClone?.UserDetails?.credentials?.GroupDescriptions ||
      window.__MPULSE_LAYOUT__?.UserDetails?.credentials?.GroupDescriptions ||
      window.__MPULSE_LAYOUT__?.credentials?.GroupDescriptions;
  
    if (fromLayout) {
      storeSecurityGroup(fromLayout);
      return String(fromLayout).trim();
    }
  
    const fromAngular =
      angular.element(document.body).injector?.()?.get?.("$rootScope")
        ?.UserDetails?.credentials?.GroupDescriptions ||
      angular.element(document.body).injector?.()?.get?.("$rootScope")
        ?.CurrentUser?.credentials?.GroupDescriptions ||
      "";
  
    if (fromAngular) {
      storeSecurityGroup(fromAngular);
      return String(fromAngular).trim();
    }
  
    return window.__MPULSE_SECURITY_GROUP__ || "";
  }

  function storeSecurityGroup(group) {
    group = String(group || "").trim();
  
    window.__MPULSE_SECURITY_GROUP__ = group || "";
  
    console.log("Stored Security Group:", window.__MPULSE_SECURITY_GROUP__ || "(none)");
  }
  
  function isAdminBypassUser() {
    const group = getCurrentUserSecurityGroup().toLowerCase();
  
    console.log("Detected Security Group:", group || "(not found)");
  
    return ADMIN_SECURITY_GROUPS
      .map(g => g.toLowerCase())
      .includes(group);
  }
  

  function clean(s) {
    return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findFieldBlock(labelText) {
    const target = clean(labelText);
  
    const labels = [
      ...document.querySelectorAll("label"),
      ...document.querySelectorAll(".control-label"),
      ...document.querySelectorAll("span")
    ];
  
    for (const label of labels) {
  
      const txt = clean(label.innerText);
  
      if (txt !== target) continue;
  
      const block =
        label.closest("[control]") ||
        label.closest(".form-group") ||
        label.closest(".four-column-layout");
  
      if (block) return block;
    }
  
    return null;
  }

  function getAngularSelectedRecord() {
    try {
      const candidates = [
        document.querySelector("[ng-controller]"),
        document.querySelector("[control]"),
        document.body
      ].filter(Boolean);
  
      for (const el of candidates) {
        const scope = angular.element(el).scope?.() || angular.element(el).isolateScope?.();
  
        let s = scope;
        while (s) {
          if (s.selectedRecord) return s.selectedRecord;
          if (s.SelectedRecord) return s.SelectedRecord;
          s = s.$parent;
        }
      }
    } catch (e) {}
  
    return null;
  }
  
  function isNewWorkOrder() {
    const sr = getAngularSelectedRecord();
  
    if (sr) {
      const key =
        sr.RecordKey ||
        sr.WorkOrderRecordKey ||
        sr.WKORecordKey ||
        "";
  
      const id =
        sr.RecordId ||
        sr.WorkOrderID ||
        sr.WorkOrderId ||
        sr.WkoID ||
        sr.WorkOrder ||
        "";
  
      if (!key || String(key) === "0" || !id) {
        console.log("New WO detected from Angular selectedRecord.");
        return true;
      }
    }
  
    const fv = window.__MPULSE_FORMVIEW__ || {};
    const load = window.__MPULSE_LOAD__?.SelectedObject || {};
  
    const recordKey =
      fv.RecordKey ||
      fv.WorkOrderRecordKey ||
      load.RecordKey ||
      load.WorkOrderRecordKey ||
      "";
  
    const recordId =
      fv.RecordId ||
      fv.WorkOrderID ||
      fv.WorkOrderId ||
      fv.WkoID ||
      load.RecordId ||
      load.WorkOrderID ||
      load.WorkOrderId ||
      load.WkoID ||
      "";
  
    return !recordKey || String(recordKey) === "0" || !recordId;
  }

  function isPMWorkOrder() {
    const woType = String(
      window.__MPULSE_FORMVIEW__?.WorkOrderType?.Desc ||
      window.__MPULSE_LOAD__?.SelectedObject?.WorkOrderType?.Desc ||
      ""
    ).trim().toLowerCase();
  
    console.log("Detected Work Order Type:", woType);
  
    return [
      "preventative maintenance",
      "preventive maintenance",
      "pm"
    ].includes(woType);
  }

  function addBlocker(block) {
    if (block.__pmBlockerAttached) return;

    block.__pmBlockerAttached = true;

    block.__pmBlocker = function (e) {
      if (!block.classList.contains("pm-pencil-locked")) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    block.addEventListener("click", block.__pmBlocker, true);
    block.addEventListener("mousedown", block.__pmBlocker, true);
    block.addEventListener("dblclick", block.__pmBlocker, true);
  }

  function lockField(block) {
    if (!block) return;

    block.classList.add("pm-pencil-locked");
    addBlocker(block);

    block.querySelectorAll(".fa-pencil, .fa-edit, i[class*='pencil'], i[class*='edit']")
      .forEach(icon => {
        icon.style.display = "none";
        icon.style.pointerEvents = "none";
      });
  }

  function unlockField(block) {
    if (!block) return;

    block.classList.remove("pm-pencil-locked");

    block.querySelectorAll(".fa-pencil, .fa-edit, i[class*='pencil'], i[class*='edit']")
      .forEach(icon => {
        icon.style.display = "";
        icon.style.pointerEvents = "";
      });
  }

  function unlockAll() {
    document.querySelectorAll(".pm-pencil-locked").forEach(unlockField);
  }

  function applyLock() {
    unlockAll();
  
    if (isAdminBypassUser()) {
      console.log("Admin security group bypass active — PM lock skipped.");
      return;
    }
  
    if (isNewWorkOrder()) {
      console.log("New WO detected — PM lock skipped.");
      return;
    }
  
    if (!isPMWorkOrder()) return;
  
    LOCK_FIELDS.forEach(label => {
      const block = findFieldBlock(label);
      if (block) lockField(block);
    });
  }

  if (!document.getElementById("pm-pencil-lock-style")) {
    const style = document.createElement("style");
    style.id = "pm-pencil-lock-style";
    style.textContent = `
      .pm-pencil-locked .fa-pencil,
      .pm-pencil-locked .fa-edit,
      .pm-pencil-locked i[class*="pencil"],
      .pm-pencil-locked i[class*="edit"] {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  window.__applyPMLock = applyLock;
  applyLock();

  const obs = new MutationObserver(() => {
    clearTimeout(window.__pmLockTimer);
    window.__pmLockTimer = setTimeout(applyLock, 300);
  });

  obs.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("PM Work Order Priority / Date Due pencil lock active.");
})();
