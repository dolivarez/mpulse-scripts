(function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseReviewPanel")?.remove();
  document.querySelectorAll(".maint-review-btn").forEach(b => b.remove());

  /* ================= CONFIG ================= */

  const REVIEW_FIELDNAME = "CustomFields.OBJ_818";
  const STATUS_FIELD = "OBJ_879";

  const REVIEW_GROUPS = [
    "Maintenance Managers",
    "Field Service Engineers",
    "TSG Manager - East Region",
    "MPulse Custodian (System Designer)",
    "TSG TEST"
  ];

  const TECH_GROUPS = [
    "TSG Maintenance Engineers",
    "TSG TEST"
  ];

  const REVIEW_FLOW = {
    NOT_REVIEWED: ["CORRECTION", "APPROVED"],
    CORRECTION: ["RESUBMITTED"],
    RESUBMITTED: ["CORRECTION", "APPROVED"],
    APPROVED: []
  };

  const CORRECTION_OPTIONS = [
    "Asset Missing",
    "Labor missing",
    "Inventory missing",
    "Task(s) not complete",
    "Dose missing",
    "Media missing",
    "Other costs missing",
    "Required field missing",
    "Other"
  ];

  let __ALLOW_WRITE__ = false;
  let selectedStatus = null;
  const selectedCorrections = new Set();

  /* ================= USER INFO ================= */

  function getUserName() {
    return document
      .querySelector("#navbar span.text-capitalize span")
      ?.textContent?.trim() || "Unknown User";
  }

  function getUserGroup() {
    // Try mobile layout
    let el = document.querySelector(".userDetails small");
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  
    // Try desktop layout
    el = document.querySelector("#navbar small");
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  
    return null;
  }

  function isReviewer() {
    return REVIEW_GROUPS.includes(getUserGroup());
  }

  function isTech() {
    return TECH_GROUPS.includes(getUserGroup());
  }

  /* ================= RECORD ACCESS ================= */

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
  if (!record) {
    console.warn("Record not found");
    return;
  }

  if (!record.CustomFields) {
    record.CustomFields = {};
  }

  // ✅ Update Angular model directly
  record.CustomFields.OBJ_879 = value;

  // 🔁 Force Angular digest
  const injector = angular.element(document.body).injector();
  if (injector) {
    injector.get("$rootScope").$applyAsync();
  }

  console.log("🟢 Status updated via Angular model:", value);
}




  function isValidTransition(from, to) {
    return REVIEW_FLOW[from]?.includes(to);
  }

  /* ================= CKEDITOR ================= */

  function getEditor() {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === REVIEW_FIELDNAME);
  }

  function getReviewLabel() {
    const ta = document.querySelector(
      `textarea[fieldname="${REVIEW_FIELDNAME}"]`
    );
    return ta?.closest("div")?.querySelector("label") || null;
  }

  function protectEditor(editor) {
    if (!editor || editor.__PROTECTED__) return;
    editor.__PROTECTED__ = true;

    editor.on("key", e => { if (!__ALLOW_WRITE__) e.cancel(); });
    editor.on("paste", e => { if (!__ALLOW_WRITE__) e.cancel(); });
    editor.on("beforeCommandExec", e => {
      if (!__ALLOW_WRITE__) e.cancel();
    });
  }

  function appendToMemo(html) {
    const editor = getEditor();
    if (!editor) return false;

    const existing = editor.getData() || "";
    const sep = `<hr style="margin:15px 0;border-top:1px solid #ccc;">`;

    __ALLOW_WRITE__ = true;
    editor.setData(existing ? existing + sep + html : html);
    __ALLOW_WRITE__ = false;

    return true;
  }

  /* ================= PANEL ================= */

  function openPanel() {

    if (document.getElementById("mpulseReviewPanel")) return;

    selectedStatus = null;
    selectedCorrections.clear();

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
      <div style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold">
        📝 Work Order Review
      </div>
      <div style="padding:10px" id="panelBody"></div>
      <div style="padding:10px;border-top:1px solid #ddd">
        <button id="applyBtn">Apply</button>
        <button id="closeBtn" style="float:right">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    if (isReviewer()) renderReviewer(panel);
    else if (isTech()) renderTechnician(panel);
    else {
      panel.querySelector("#panelBody").innerHTML =
        "<div style='font-size:12px'>No review permission.</div>";
      panel.querySelector("#applyBtn").style.display = "none";
    }

    panel.querySelector("#closeBtn").onclick = () => panel.remove();
  }

  /* ================= REVIEWER ================= */

  function renderReviewer(panel) {

    const body = panel.querySelector("#panelBody");

    body.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">Review Status</div>
      <button data-status="CORRECTION">Requires Correction</button>
      <button data-status="APPROVED">Approve</button>
      <div id="corrSection" style="display:none;margin-top:12px"></div>
    `;

    body.querySelectorAll("button[data-status]").forEach(btn => {
      btn.onclick = () => {
        selectedStatus = btn.dataset.status;
        body.querySelector("#corrSection").style.display =
          selectedStatus === "CORRECTION" ? "block" : "none";
        renderCorrections(panel);
      };
    });

    panel.querySelector("#applyBtn").onclick = () => {

      const current = getCurrentStatus();
      if (!selectedStatus) return alert("Select status.");
      if (!isValidTransition(current, selectedStatus))
        return alert(`Invalid transition: ${current} → ${selectedStatus}`);

      let html = `
        <div>
          <strong>Status:</strong> ${selectedStatus}<br>
          <strong>By:</strong> ${getUserName()}<br>
          <strong>Date:</strong> ${new Date().toLocaleString()}
      `;

      if (selectedStatus === "CORRECTION") {

        if (!selectedCorrections.size)
          return alert("Select at least one correction.");

        html += "<ul>";
        selectedCorrections.forEach(c => html += `<li>${c}</li>`);
        html += "</ul>";
      }

      html += "</div>";

      if (!appendToMemo(html)) return;

      setStatus(selectedStatus);

      panel.remove();
    };
  }

  function renderCorrections(panel) {
    const section = panel.querySelector("#corrSection");
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

  /* ================= TECH ================= */

  function renderTechnician(panel) {

    panel.querySelector("#panelBody").innerHTML =
      "Corrections completed. Ready to resubmit?";

    panel.querySelector("#applyBtn").onclick = () => {

      const current = getCurrentStatus();
      if (!isValidTransition(current, "RESUBMITTED"))
        return alert("Invalid transition.");

      const html = `
        <div>
          <strong>Status:</strong> RESUBMITTED<br>
          <strong>By:</strong> ${getUserName()}<br>
          <strong>Date:</strong> ${new Date().toLocaleString()}
        </div>
      `;

      if (!appendToMemo(html)) return;

      setStatus("RESUBMITTED");

      panel.remove();
    };
  }

  /* ================= EDIT MODE WATCHER ================= */

  (function watchEditMode() {

    let lastState = null;

    function check() {

      const editor = getEditor();
      if (!editor) {
        requestAnimationFrame(check);
        return;
      }

      protectEditor(editor);

      const editable = !editor.readOnly;

      if (editable !== lastState) {

        lastState = editable;

        document.querySelectorAll(".maint-review-btn")
          .forEach(b => b.remove());

        if (editable && (isReviewer() || isTech())) {

          const label = getReviewLabel();
          if (!label) return;

          const btn = document.createElement("button");
          btn.className = "maint-review-btn";
          btn.textContent = isTech() ? "📤 Resubmit" : "📝 Review";

          Object.assign(btn.style, {
            marginLeft: "8px",
            padding: "2px 10px",
            fontSize: "12px",
            borderRadius: "12px",
            border: "1px solid #0f766e",
            background: "#fff",
            color: "#0f766e",
            cursor: "pointer"
          });

          btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            openPanel();
          };

          label.appendChild(btn);
        }
      }

      requestAnimationFrame(check);
    }

    check();

  })();

})();
