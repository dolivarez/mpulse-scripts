(function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseReviewPanel")?.remove();
  document.querySelectorAll(".review-section-btn").forEach(b => b.remove());

  /* ================= CONFIG ================= */

  const REVIEW_FIELDNAME = "CustomFields.OBJ_818";
  const STATUS_FIELD = "CustomFields.OBJ_879";

  const REVIEW_FLOW = {
    NOT_REVIEWED: ["CORRECTION", "APPROVED"],
    CORRECTION: ["RESUBMITTED"],
    RESUBMITTED: ["CORRECTION", "APPROVED"],
    APPROVED: []
  };

  const CORRECTION_OPTIONS = [
    "Asset missing",
    "Labor missing",
    "Inventory missing",
    "Task(s) not complete",
    "Dose missing",
    "Media missing",
    "Other costs missing",
    "Required field missing",
    "Other"
  ];

  let selectedStatus = null;
  const selectedCorrections = new Set();
  let __ALLOW_REVIEW_WRITE__ = false;

  /* ================= CORE HELPERS ================= */

  function getUserName() {
    return document
      .querySelector("#navbar span.text-capitalize span")
      ?.textContent?.trim() || "Unknown User";
  }

  function getCurrentUserGroup() {
    return document
      .querySelector("#navbar small.ng-binding")
      ?.textContent
      ?.trim() || null;
  }

  const REVIEW_GROUPS = [
    "Maintenance Managers",
    "Field Service Engineers",
    "TSG Manager - East Region",
    "MPulse Custodian (System Designer)",
  ];

  const TECH_GROUPS = [
    "TSG Maintenance Engineers - Default Group"
  ];
  
  function currentUserIsReviewer() {
    const group = getCurrentUserGroup();
    return REVIEW_GROUPS.includes(group);
  }

  function currentUserIsTech() {
    const group = getCurrentUserGroup();
    return TECH_GROUPS.includes(group);
  }



  function getRecord() {
    const scope = angular
      .element(document.querySelector('[ng-controller]'))
      .scope();
    return scope?.getSelectedRecordObj?.() || null;
  }

  function getCurrentStatus() {
    const record = getRecord();
    return record?.CustomFields?.OBJ_879 || "NOT_REVIEWED";
  }

  function setStatus(value) {
    const record = getRecord();
    if (!record) return;

    if (!record.CustomFields) record.CustomFields = {};

    angular.element(document.body)
      .injector()
      .get("$rootScope")
      .$applyAsync(() => {
        record.CustomFields.OBJ_879 = value;
      });

    console.log("🟢 Status set:", value);
  }

  function isValidTransition(from, to) {
    return REVIEW_FLOW[from]?.includes(to);
  }

  /* ================= EDIT MODE CONTROL ================= */

  function ensureRecordInEditMode() {
    const pencil = document.querySelector(
      ".editor[ng-click*='switchToEditModeSingle']"
    );
    const isEditing = !!document.querySelector(
      'textarea[fieldname="CustomFields.OBJ_818"]'
    );
    if (!isEditing && pencil) pencil.click();
  }

  function forceMemoIntoEditMode() {
    const container = document.querySelector(".OBJ_818");
    if (!container) return;

    const scope = angular.element(container).scope();
    const controlKey = container
      .querySelector("[controlkey]")
      ?.getAttribute("controlkey");

    if (!scope || !controlKey) return;

    scope.$applyAsync(() => {
      scope.switchToEditModeSingle(null, parseInt(controlKey), "TEXTEDITOR");
    });
  }

  /* ================= MEMO PROTECTION ================= */

  function getReviewEditor() {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === REVIEW_FIELDNAME);
  }

  function protectReviewEditor(editor) {
    if (!editor || editor.__PROTECTED__) return;
    editor.__PROTECTED__ = true;

    editor.on("key", evt => {
      if (!__ALLOW_REVIEW_WRITE__) evt.cancel();
    });

    editor.on("paste", evt => {
      if (!__ALLOW_REVIEW_WRITE__) evt.cancel();
    });

    editor.on("beforeCommandExec", evt => {
      const blocked = ["cut","delete","backspace","undo","redo"];
      if (!__ALLOW_REVIEW_WRITE__ && blocked.includes(evt.data.name))
        evt.cancel();
    });

    editor.on("contentDom", () => {
      editor.document.getBody().on("drop", e => {
        if (!__ALLOW_REVIEW_WRITE__) e.cancel();
      });
    });

    console.log("🔒 Memo protected");
  }

  function appendToMemo(htmlBlock) {
    const editor = getReviewEditor();
    if (!editor) return false;

    const existing = editor.getData() || "";
    const separator = `<hr style="margin:15px 0;">`;
    const updated = existing ? existing + separator + htmlBlock : htmlBlock;

    __ALLOW_REVIEW_WRITE__ = true;
    editor.setData(updated);
    __ALLOW_REVIEW_WRITE__ = false;
    return true;
  }

  /* ================= STATUS FIELD LOCK ================= */

  function disableStatusEditToggle() {
    const container = document.querySelector(".OBJ_879");
    if (!container) return;
    const pencil = container.querySelector("span.editor");
    if (pencil) pencil.style.display = "none";
  }

  function hardLockStatusField() {
    const el = document.getElementById("OBJ_879");
    if (!el) return;
  
    try {
  
      const instance = DevExpress.ui.dxTextBox.getInstance(el);
  
      if (!instance) return;
  
      instance.option("readOnly", true);
  
      console.log("🔒 Status dxTextBox locked (DevExtreme)");
  
    } catch (e) {
      console.warn("Status lock failed:", e);
    }
  }


  /* ================= PANEL ================= */

  function openPanel(mode) {

    document.getElementById("mpulseReviewPanel")?.remove();
    selectedStatus = null;
    selectedCorrections.clear();

    ensureRecordInEditMode();
    forceMemoIntoEditMode();

    const panel = document.createElement("div");
    panel.id = "mpulseReviewPanel";
    panel.style.cssText = `
      position:fixed;
      top:80px;
      right:20px;
      width:360px;
      background:#fff;
      border:1px solid #ccc;
      border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);
      font-family:Arial;
      z-index:99999;
    `;

    panel.innerHTML = `
      <div style="padding:10px;font-weight:bold;border-bottom:1px solid #ddd">
        📝 Work Order Review
      </div>
      <div style="padding:10px" id="panelBody"></div>
      <div style="padding:10px;border-top:1px solid #ddd">
        <button id="applyBtn">Apply</button>
        <button id="closeBtn" style="float:right">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    if (mode === "reviewer") renderReviewer(panel);
    if (mode === "technician") renderTechnician(panel);

    panel.querySelector("#closeBtn").onclick = () => panel.remove();

    setTimeout(() => {
      protectReviewEditor(getReviewEditor());
      disableStatusEditToggle();
      hardLockStatusField();
    }, 500);
  }

  /* ================= REVIEWER ================= */

  function renderReviewer(panel) {

    const body = panel.querySelector("#panelBody");

    body.innerHTML = `
      <button data-status="CORRECTION">Requires Correction</button>
      <button data-status="APPROVED">Approve</button>
      <div id="correctionSection" style="display:none;margin-top:10px"></div>
    `;

    body.querySelectorAll("button[data-status]").forEach(btn => {
      btn.onclick = () => {
        selectedStatus = btn.dataset.status;
        body.querySelector("#correctionSection").style.display =
          selectedStatus === "CORRECTION" ? "block" : "none";
        renderCorrections(panel);
      };
    });

    panel.querySelector("#applyBtn").onclick = applyReview;
  }

  function renderCorrections(panel) {
    const section = panel.querySelector("#correctionSection");
    section.innerHTML = "";

    CORRECTION_OPTIONS.forEach(opt => {
      const row = document.createElement("div");
      row.innerHTML = `
        <label>
          <input type="checkbox" data-val="${opt}"> ${opt}
        </label>
      `;
      section.appendChild(row);
    });

    section.addEventListener("change", e => {
      const val = e.target.dataset.val;
      if (!val) return;
      e.target.checked
        ? selectedCorrections.add(val)
        : selectedCorrections.delete(val);
    });
  }

  function applyReview() {

    const current = getCurrentStatus();
    const target = selectedStatus;

    if (!target) return alert("Select status.");
    if (!isValidTransition(current, target))
      return alert("Invalid transition.");

    let block = `
      <div>
        <strong>Status:</strong> ${target}<br>
        <strong>By:</strong> ${getUserName()}<br>
        <strong>Date:</strong> ${new Date().toLocaleString()}
    `;

    if (target === "CORRECTION") {
      if (!selectedCorrections.size)
        return alert("Select corrections.");
      block += "<ul>";
      selectedCorrections.forEach(c => block += `<li>${c}</li>`);
      block += "</ul>";
    }

    block += "</div>";

    if (!appendToMemo(block)) return;

    setStatus(target);

    setTimeout(() => window.SaveTabAndKey?.(), 500);

    document.getElementById("mpulseReviewPanel")?.remove();
  }

  /* ================= TECHNICIAN ================= */

  function renderTechnician(panel) {

    panel.querySelector("#panelBody").innerHTML =
      "Corrections completed. Ready to resubmit?";

    panel.querySelector("#applyBtn").onclick = () => {

      const current = getCurrentStatus();
      if (!isValidTransition(current, "RESUBMITTED"))
        return alert("Invalid transition.");

      const block = `
        <div>
          <strong>Work Order Resubmitted</strong><br>
          <strong>By:</strong> ${getUserName()}<br>
          <strong>Date:</strong> ${new Date().toLocaleString()}
        </div>
      `;

      if (!appendToMemo(block)) return;

      setStatus("RESUBMITTED");
      setTimeout(() => window.SaveTabAndKey?.(), 500);

      panel.remove();
    };
  }

  /* ================= BUTTON WATCHER ================= */

  setInterval(() => {

    disableStatusEditToggle();
    hardLockStatusField();

    const status = getCurrentStatus();
    const existing = document.querySelector(".review-section-btn");

    function attach(label, mode) {
      if (existing) return;
      const header = [...document.querySelectorAll(".tabTitle")]
        .find(t => t.textContent.includes("Review"));
      if (!header) return;

      const btn = document.createElement("button");
      btn.className = "review-section-btn";
      btn.textContent = label;
      btn.style.marginLeft = "10px";
      btn.onclick = () => openPanel(mode);
      header.appendChild(btn);
    }

    const securitygroup = getCurrentUserGroup();

    if (REVIEW_GROUPS.includes(securitygroup)) {
      if (status !== "APPROVED") attach("📝 Review", "reviewer");
      else existing?.remove();
      return;
    }

    if (TECH_GROUPS.includes(securitygroup)) {
      if (status === "CORRECTION") attach("📤 Resubmit", "technician");
      else existing?.remove();
      return;
    }

    existing?.remove();

  }, 1000);

})();
