(function () {
  const SCRIPT_VERSION = "1.0.0";
  const BUTTON_ID = "toolbarMaintenanceTaskEmailButton";
  const BUTTON_TITLE = "Draft maintenance task email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarMaintenanceTaskEmailModal";
  const OVERLAY_ID = "toolbarMaintenanceTaskEmailOverlay";

  const TEMPLATE_OPTIONS = [
    { key: "general", label: "General Review Needed" },
    { key: "approval", label: "Approval Needed" },
    { key: "correction", label: "Correction Needed" },
    { key: "completion", label: "Completion / Closeout Review" }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function extractTaskRecordInfo(payload) {
    if (!payload || typeof payload !== "object") return null;

    const candidates = [
      payload.SelectedObject,
      payload.selectedObject,
      payload,
      payload.header,
      payload.Header,
      payload.ObjHeader,
      payload.Data,
      payload.data,
      payload.d
    ].filter(Boolean);

    for (const obj of candidates) {
      const recordKey =
        obj.RecordKey ??
        obj.recordKey ??
        obj.SelectedRecordKey ??
        obj.RecordID ??
        "";

      const status =
        obj.StatusDesc ??
        obj.TaskStatus?.Desc ??
        obj.Status?.Desc ??
        obj.Status ??
        obj.status ??
        "";

      const id =
        obj.RecordId ??
        obj.RecordID ??
        obj.ID ??
        obj.Id ??
        obj.TaskID ??
        obj.MaintTaskID ??
        "";

      if (recordKey || status || id) {
        return {
          recordKey: String(recordKey || ""),
          status: String(status || ""),
          id: String(id || ""),
          raw: payload,
          obj
        };
      }
    }

    return null;
  }

  function installTaskFormViewInterceptor() {
    if (window.__TASK_FORMVIEW_INTERCEPTOR_INSTALLED__) return;
    window.__TASK_FORMVIEW_INTERCEPTOR_INSTALLED__ = true;

    function isRelevant(url) {
      return /GetFormViewData|Load/i.test(url || "");
    }

    function processPayload(data, source, url) {
      const info = extractTaskRecordInfo(data);
      if (!info || !info.recordKey) return;

      window.__MPULSE_TASK_FORMVIEW__ = {
        ...info,
        source,
        url,
        capturedAt: new Date().toISOString()
      };

      log("Updated maintenance task form view", window.__MPULSE_TASK_FORMVIEW__);
    }

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (isRelevant(url)) {
          const clone = response.clone();
          const data = await clone.json();
          processPayload(data, "fetch", url);
        }
      } catch (err) {
        console.warn("[TASK] fetch intercept failed", err);
      }

      return response;
    };

    const OriginalXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OriginalXHR();
      let requestUrl = "";

      const originalOpen = xhr.open;
      xhr.open = function (method, url, ...rest) {
        requestUrl = url || "";
        return originalOpen.call(this, method, url, ...rest);
      };

      xhr.addEventListener("load", function () {
        try {
          if (!isRelevant(requestUrl)) return;
          if (!this.responseText) return;
          const data = JSON.parse(this.responseText);
          processPayload(data, "xhr", requestUrl);
        } catch (err) {
          console.warn("[TASK] xhr intercept failed", err);
        }
      });

      return xhr;
    }

    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;

    log("Maintenance task interceptor installed");
  }

  function seedTaskFormViewFromPage() {
    try {
      if (window.__MPULSE_TASK_FORMVIEW__?.recordKey) return;

      const scope = angular.element(document.body).scope();
      const selectedObject =
        scope?.$parent?.listviewlayouts?.SelectedObject ||
        scope?.$parent?.SelectedObject ||
        null;

      if (!selectedObject) return;

      const info = extractTaskRecordInfo({ SelectedObject: selectedObject });
      if (!info || !info.recordKey) return;

      window.__MPULSE_TASK_FORMVIEW__ = {
        ...info,
        source: "seeded-from-page",
        capturedAt: new Date().toISOString()
      };

      log("Seeded maintenance task form view from current page", window.__MPULSE_TASK_FORMVIEW__);
    } catch (err) {
      log("Failed to seed maintenance task form view", err);
    }
  }

  function getTaskObj() {
    return (
      window.__MPULSE_TASK_FORMVIEW__?.obj ||
      window.__MPULSE_TASK_FORMVIEW__?.raw?.SelectedObject ||
      null
    );
  }

  function normalizeText(value) {
    if (value == null) return "";

    if (typeof value === "object") {
      const text =
        value.Desc ??
        value.Description ??
        value.Value ??
        value.Name ??
        "";
      return String(text).replace(/\s+/g, " ").trim();
    }

    return String(value).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function htmlToText(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return normalizeText(div.textContent || div.innerText || "");
  }

  function wrapText(text, width) {
    if (!text) return "";
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (const word of words) {
      if ((current + " " + word).trim().length > width) {
        if (current.trim()) lines.push(current.trim());
        current = word;
      } else {
        current += " " + word;
      }
    }

    if (current.trim()) lines.push(current.trim());
    return lines.join("\n");
  }

  function section(title, bodyLines) {
    const cleaned = (bodyLines || []).filter(Boolean);
    if (!cleaned.length) return "";
    return [title, "-".repeat(title.length), ...cleaned, ""].join("\n");
  }

  function formatDateOnly(value) {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (isNaN(d)) return String(value).split("T")[0];
      return d.toLocaleDateString("en-US");
    } catch {
      return String(value).split("T")[0];
    }
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const txt = normalizeText(
        el.value || el.innerText || el.textContent || ""
      );

      if (txt) return txt;
    }
    return "";
  }

  function getFieldValueByLabel(labelText) {
    const labels = Array.from(
      document.querySelectorAll("label, .dx-field-item-label-text, .fal-form-label, .form-group label, .control-label, span, div")
    );
    const wanted = normalizeText(labelText).toLowerCase();

    for (const node of labels) {
      const txt = normalizeText(node.textContent || "");
      if (!txt || txt.toLowerCase() !== wanted) continue;

      const container = node.closest(".dx-field-item, .form-group, td, tr, .row, div") || node.parentElement;
      if (!container) continue;

      const input =
        container.querySelector("input, textarea, select") ||
        node.parentElement?.querySelector("input, textarea, select") ||
        node.nextElementSibling?.querySelector?.("input, textarea, select") ||
        node.nextElementSibling;

      if (input) {
        const value = input.value ?? input.innerText ?? input.textContent ?? "";
        const cleaned = normalizeText(value);
        if (cleaned) return cleaned;
      }

      const nearby = Array.from(container.querySelectorAll("a, span, div"))
        .map(el => normalizeText(el.textContent || ""))
        .find(v => v && v.toLowerCase() !== wanted);

      if (nearby) return nearby;
    }

    return "";
  }

  function getDisplayValueByLabel(labelText) {
    const wanted = normalizeText(labelText).toLowerCase();

    const labelNodes = Array.from(
      document.querySelectorAll("label, .dx-field-item-label-text, .fal-form-label, .form-group label, .control-label")
    );

    for (const labelNode of labelNodes) {
      const txt = normalizeText(labelNode.textContent || "");
      if (!txt || txt.toLowerCase() !== wanted) continue;

      const container =
        labelNode.closest(".dx-field-item, .form-group, td, tr, .row") ||
        labelNode.parentElement;

      if (!container) continue;

      const linkedText = Array.from(container.querySelectorAll("a"))
        .map(a => normalizeText(a.textContent || ""))
        .find(Boolean);
      if (linkedText) return linkedText;

      const dxDisplay =
        container.querySelector(".dx-texteditor-input") ||
        container.querySelector(".dx-dropdowneditor-input-wrapper input") ||
        container.querySelector(".dx-selectbox .dx-texteditor-input") ||
        container.querySelector(".dx-tag-content") ||
        container.querySelector(".dx-textbox input");

      if (dxDisplay) {
        const displayVal = normalizeText(dxDisplay.value || dxDisplay.textContent || "");
        if (displayVal) return displayVal;
      }

      const visibleText = Array.from(container.querySelectorAll("span, div"))
        .map(el => normalizeText(el.textContent || ""))
        .find(v => v && v.toLowerCase() !== wanted);
      if (visibleText) return visibleText;

      const rawInput = container.querySelector("input, textarea, select");
      if (rawInput) {
        const rawVal = normalizeText(rawInput.value || rawInput.textContent || "");
        if (rawVal) return rawVal;
      }
    }

    return "";
  }

  function getCommentsText() {
    const nodes = Array.from(
      document.querySelectorAll(".dx-scrollview-content .ng-binding, .dx-scrollview-content")
    );

    const texts = nodes
      .map(node => htmlToText(node.innerHTML))
      .filter(Boolean);

    return texts[0] || "";
  }

  function getLatestCommentText() {
    const text = getCommentsText();
    if (!text) return "";

    const parts = text.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
    let latest = parts.length ? parts[parts.length - 1].trim() : text.trim();

    if (latest.length > 450) {
      latest = latest.slice(0, 450).trim() + "... [truncated]";
    }

    return latest;
  }

  function getGridItems(selectorCandidates) {
    for (const selector of selectorCandidates) {
      try {
        const el = document.querySelector(selector);
        if (!el || !window.DevExpress?.ui?.dxDataGrid) continue;
        const instance = window.DevExpress.ui.dxDataGrid.getInstance(el);
        if (!instance) continue;
        const items = instance.getDataSource()?.items?.() || [];
        if (items.length || instance) return items;
      } catch (err) {
        log(`Failed reading grid ${selector}`, err);
      }
    }
    return [];
  }

  function getRecordId() {
    const obj = getTaskObj();
    return (
      obj?.RecordId ||
      obj?.RecordID ||
      obj?.TaskID ||
      obj?.MaintTaskID ||
      getText(["#ID", "#TaskID", "[id='ID']"]) ||
      getDisplayValueByLabel("ID#")
    );
  }

  function getTaskStatus() {
    const obj = getTaskObj();
    return (
      obj?.StatusDesc ||
      obj?.TaskStatus?.Desc ||
      getDisplayValueByLabel("Status") ||
      getDisplayValueByLabel("Task Status") ||
      getText(["#StatusDesc"])
    );
  }

  function getDescription() {
    const obj = getTaskObj();
    return (
      obj?.Description ||
      obj?.Desc ||
      getText(["#Description", "#TaskDescription", "#MTSDescription"]) ||
      getDisplayValueByLabel("Description")
    );
  }

  function getPriority() {
    const obj = getTaskObj();
    return (
      obj?.Priority?.Desc ||
      obj?.PriorityDesc ||
      getDisplayValueByLabel("Priority") ||
      getText(["#PriorityDesc"])
    );
  }

  function getType() {
    const obj = getTaskObj();
    return (
      obj?.Type?.Desc ||
      obj?.TaskType?.Desc ||
      getDisplayValueByLabel("Type") ||
      getDisplayValueByLabel("Task Type")
    );
  }

  function getAssignedTo() {
    const obj = getTaskObj();
    return (
      obj?.AssignedTo?.Desc ||
      obj?.Employee?.Desc ||
      obj?.AssignedEmployee?.Desc ||
      getDisplayValueByLabel("Assigned To") ||
      getDisplayValueByLabel("Employee")
    );
  }

  function getDateOpened() {
    const obj = getTaskObj();
    return (
      obj?.OpenDate ||
      obj?.DateOpened ||
      getDisplayValueByLabel("Date Opened") ||
      getText(["#Open"])
    );
  }

  function getDateDue() {
    const obj = getTaskObj();
    return (
      obj?.DueDate ||
      obj?.DateDue ||
      getDisplayValueByLabel("Date Due") ||
      getText(["#Due"])
    );
  }

  function getDateDone() {
    const obj = getTaskObj();
    return (
      obj?.DateDone ||
      obj?.DoneDate ||
      getDisplayValueByLabel("Date Done") ||
      getText(["#DateDone"])
    );
  }

  function getSystem() {
    const obj = getTaskObj();
    return (
      obj?.System?.Desc ||
      obj?.SystemDesc ||
      getDisplayValueByLabel("System")
    );
  }

  function getSubsystem() {
    const obj = getTaskObj();
    return (
      obj?.Subsystem?.Desc ||
      obj?.SubsystemDesc ||
      getDisplayValueByLabel("Subsystem")
    );
  }

  function getAssetSummary() {
    const gridItems = getGridItems(["#AssetList", "#assetList", ".dx-datagrid[aria-label='Asset List']"]);
    if (gridItems.length) {
      return gridItems
        .slice(0, 10)
        .map(row => normalizeText(row.Description || row.AssetDesc || row.ID || row.Code || ""))
        .filter(Boolean);
    }

    const fromField =
      getDisplayValueByLabel("Asset") ||
      getDisplayValueByLabel("Equipment") ||
      getDisplayValueByLabel("Asset Description");

    return fromField ? [fromField] : [];
  }

  function getPersonnelSummary() {
    const gridItems = getGridItems(["#PersonalList", "#PersonnelList", "#personalList"]);
    return gridItems
      .slice(0, 10)
      .map(row => normalizeText(row.Description || row.EmployeeDesc || row.Code || row.Name || ""))
      .filter(Boolean);
  }

  function getTaskFlag() {
    const obj = getTaskObj();
    const recordFlag = obj?.RecordFlag;
    if (recordFlag) return recordFlag;

    const status = String(getTaskStatus() || window.__MPULSE_TASK_FORMVIEW__?.status || "").toLowerCase();
    return status.includes("closed") ? "TSKHST" : "TSK";
  }

  function buildTaskUrl() {
    try {
      const flag = getTaskFlag();
      const recordKey = window.__MPULSE_TASK_FORMVIEW__?.recordKey;
      if (recordKey) {
        return `${location.origin}/#/main/fal/MaintenanceTaskRecords/${recordKey}?Flag=${flag}`;
      }

      const match = location.hash.match(/\/MaintenanceTaskRecords\/([^?\/]+)/i);
      if (match && match[1]) {
        return `${location.origin}/#/main/fal/MaintenanceTaskRecords/${match[1]}?Flag=${flag}`;
      }

      return location.href;
    } catch (err) {
      console.error("Task URL build failed", err);
    }

    return location.href;
  }

  function getTaskData() {
    return {
      id: getRecordId(),
      status: getTaskStatus(),
      description: getDescription(),
      priority: getPriority(),
      type: getType(),
      assignedTo: getAssignedTo(),
      system: getSystem(),
      subsystem: getSubsystem(),
      dateOpened: formatDateOnly(getDateOpened()),
      dateDue: formatDateOnly(getDateDue()),
      dateDone: formatDateOnly(getDateDone()),
      assets: getAssetSummary(),
      personnel: getPersonnelSummary(),
      latestComment: getLatestCommentText(),
      link: buildTaskUrl()
    };
  }

  function getTemplateContent(templateKey) {
    switch (templateKey) {
      case "approval":
        return {
          label: "Approval Needed",
          subjectPrefix: "Approval Needed",
          actionHeader: "Approval Requested",
          defaultContext: "Approval is needed before this maintenance task can proceed.",
          issue: "This maintenance task requires review and approval before additional action can be taken.",
          impact: "Progress, execution, or closeout may be delayed until approval or direction is provided.",
          action: "Please review the task and approve it or advise next steps."
        };

      case "correction":
        return {
          label: "Correction Needed",
          subjectPrefix: "Correction Needed",
          actionHeader: "Correction Requested",
          defaultContext: "This maintenance task needs updates or corrections before it can move forward.",
          issue: "This maintenance task appears to need correction, clarification, or additional information.",
          impact: "Execution, review, or closeout may be delayed until corrections are made.",
          action: "Please review the task, make the needed corrections, or advise next steps."
        };

      case "completion":
        return {
          label: "Completion / Closeout Review",
          subjectPrefix: "Closeout Review Needed",
          actionHeader: "Closeout Review Requested",
          defaultContext: "This maintenance task needs completion or closeout review.",
          issue: "This maintenance task appears to need completion confirmation, closeout review, or status update.",
          impact: "Record completion or downstream processing may remain incomplete until reviewed.",
          action: "Please review task completion status and advise whether it can be updated or closed."
        };

      case "general":
      default:
        return {
          label: "General Review Needed",
          subjectPrefix: "Review Needed",
          actionHeader: "Action Requested",
          defaultContext: "This maintenance task needs review and next-step direction.",
          issue: "This maintenance task needs review and follow-up.",
          impact: "Progress may be delayed until direction is provided.",
          action: "Please review and advise on next steps."
        };
    }
  }

  function buildSubject(templateKey, data) {
    const template = getTemplateContent(templateKey);
    const descPart = data.description ? ` - ${data.description}` : "";
    return `TASK ${data.id || "[Unknown]"} - ${template.subjectPrefix}${descPart}`;
  }

  function buildSummaryLines(data) {
    return [
      `Maintenance Task: ${data.id || "[Unavailable]"}`,
      data.status ? `Status: ${data.status}` : "",
      data.description ? `Description: ${data.description}` : "",
      data.priority ? `Priority: ${data.priority}` : "",
      data.type ? `Type: ${data.type}` : "",
      data.assignedTo ? `Assigned To: ${data.assignedTo}` : "",
      data.system ? `System: ${data.system}` : "",
      data.subsystem ? `Subsystem: ${data.subsystem}` : "",
      data.dateOpened ? `Date Opened: ${data.dateOpened}` : "",
      data.dateDue ? `Date Due: ${data.dateDue}` : "",
      data.dateDone ? `Date Done: ${data.dateDone}` : ""
    ].filter(Boolean);
  }

  function buildPlainTextBody(templateKey, userContext) {
    const data = getTaskData();
    const template = getTemplateContent(templateKey);

    const lines = [
      "ACTION REQUIRED",
      "",
      section("TASK SUMMARY", buildSummaryLines(data)),
      data.assets.length ? section("ASSETS", data.assets) : "",
      data.personnel.length ? section("PERSONNEL", data.personnel) : "",
      section("ISSUE", [wrapText(template.issue, 95)]),
      section("IMPACT", [wrapText(template.impact, 95)]),
      section(template.actionHeader.toUpperCase(), [wrapText(template.action, 95)]),
      userContext ? section("ADDITIONAL CONTEXT", [wrapText(userContext, 95)]) : "",
      data.latestComment ? section("LATEST UPDATE", [wrapText(data.latestComment, 95)]) : "",
      section("OPEN MAINTENANCE TASK", [data.link]),
    ].filter(Boolean);

    return lines.join("\n");
  }

  function htmlSection(title, bodyHtml) {
    if (!bodyHtml) return "";
    return `
      <div style="margin-top:14px;">
        <div style="font-weight:bold; text-transform:uppercase; margin-bottom:4px;">${escapeHtml(title)}</div>
        <div style="border-top:1px solid #cfcfcf; margin-bottom:8px;"></div>
        <div>${bodyHtml}</div>
      </div>
    `;
  }

  function buildHtmlBody(templateKey, userContext) {
    const data = getTaskData();
    const template = getTemplateContent(templateKey);

    const summaryRows = buildSummaryLines(data)
      .map(line => {
        const idx = line.indexOf(":");
        if (idx === -1) return `<div>${escapeHtml(line)}</div>`;
        const label = line.slice(0, idx + 1);
        const value = line.slice(idx + 1).trim();
        return `<div><b>${escapeHtml(label)}</b> ${escapeHtml(value)}</div>`;
      })
      .join("");

    const assetsHtml = data.assets.length
      ? `<ul style="margin:0; padding-left:18px;">${data.assets.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>`
      : "";

    const personnelHtml = data.personnel.length
      ? `<ul style="margin:0; padding-left:18px;">${data.personnel.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>`
      : "";

    return `
      <div style="font-family:Arial,sans-serif; font-size:13px; line-height:1.45; color:#222;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:14px;">ACTION REQUIRED</div>
        ${htmlSection("Task Summary", summaryRows)}
        ${assetsHtml ? htmlSection("Assets", assetsHtml) : ""}
        ${personnelHtml ? htmlSection("Personnel", personnelHtml) : ""}
        ${htmlSection("Issue", `<div>${escapeHtml(template.issue)}</div>`)}
        ${htmlSection("Impact", `<div>${escapeHtml(template.impact)}</div>`)}
        ${htmlSection(template.actionHeader, `<div>${escapeHtml(template.action)}</div>`)}
        ${userContext ? htmlSection("Additional Context", `<div>${escapeHtml(userContext)}</div>`) : ""}
        ${data.latestComment ? htmlSection("Latest Update", `<div>${escapeHtml(data.latestComment)}</div>`) : ""}
        ${htmlSection(
          "Open Maintenance Task",
          `<div><a href="${escapeHtml(data.link)}">Open Maintenance Task</a></div><div style="margin-top:6px; color:#666;">${escapeHtml(data.link)}</div>`
        )}
      </div>
    `;
  }

  function openOutlookDraft(templateKey, userContext) {
    const data = getTaskData();
    const subject = buildSubject(templateKey, data);
    const body = buildPlainTextBody(templateKey, userContext);

    const parts = [];
    if (DEFAULT_TO) parts.push("to=" + encodeURIComponent(DEFAULT_TO));
    if (DEFAULT_CC) parts.push("cc=" + encodeURIComponent(DEFAULT_CC));
    parts.push("subject=" + encodeURIComponent(subject));
    parts.push("body=" + encodeURIComponent(body));

    const url = "https://outlook.office.com/mail/deeplink/compose?" + parts.join("&");
    window.open(url, "_blank");
  }

  async function copyFormattedEmail(templateKey, userContext) {
    const data = getTaskData();
    const subject = buildSubject(templateKey, data);
    const plainText = buildPlainTextBody(templateKey, userContext);
    const html = buildHtmlBody(templateKey, userContext);

    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        "text/plain": new Blob([`Subject: ${subject}\n\n${plainText}`], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      });
      await navigator.clipboard.write([item]);
      return true;
    }

    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${plainText}`);
    return false;
  }

  function removeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function showModalStatus(message, isError) {
    const statusEl = document.querySelector("#taskEmailModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelectorAll(".task-template-option").forEach(btn => {
      const isActive = btn.dataset.templateKey === templateKey;
      btn.style.borderColor = isActive ? "#1976d2" : "#cfd8dc";
      btn.style.background = isActive ? "#eaf3ff" : "#fff";
      btn.style.color = "#222";
    });

    const contextBox = modal.querySelector("#taskContextInput");
    if (contextBox && !contextBox.dataset.userEdited) {
      contextBox.value = template.defaultContext;
    }

    showModalStatus("Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.", false);
  }

  function createModal() {
    removeModal();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.zIndex = "99998";

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.width = "min(620px, calc(100vw - 32px))";
    modal.style.maxHeight = "calc(100vh - 48px)";
    modal.style.overflow = "auto";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #cfd8dc";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 12px 32px rgba(0,0,0,0.2)";
    modal.style.padding = "16px";
    modal.style.zIndex = "99999";
    modal.style.fontFamily = "Arial, sans-serif";
    modal.style.color = "#222";

    modal.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="font-size:16px; font-weight:bold;">Maintenance Task Email</div>
        <button type="button" id="taskModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Select template</div>

      <div id="taskTemplateOptions" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        ${TEMPLATE_OPTIONS.map(opt => `
          <button
            type="button"
            class="task-template-option"
            data-template-key="${opt.key}"
            style="padding:10px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; text-align:left; font-size:13px;"
          >${opt.label}</button>
        `).join("")}
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="taskContextInput"
        style="width:100%; min-height:110px; resize:vertical; border:1px solid #cfd8dc; border-radius:6px; padding:10px; font-family:Arial, sans-serif; font-size:13px; box-sizing:border-box;"
      ></textarea>

      <div id="taskEmailModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="taskModalCancelBtn"
          style="padding:8px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;"
        >Cancel</button>

        <button
          type="button"
          id="taskModalCopyBtn"
          style="padding:8px 12px; border:1px solid #2e7d32; border-radius:6px; background:#388e3c; color:#fff; cursor:pointer; font-size:13px;"
        >Copy Formatted Email</button>

        <button
          type="button"
          id="taskModalDraftBtn"
          style="padding:8px 12px; border:1px solid #1565c0; border-radius:6px; background:#1976d2; color:#fff; cursor:pointer; font-size:13px;"
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const contextInput = modal.querySelector("#taskContextInput");
    contextInput.addEventListener("input", function () {
      this.dataset.userEdited = "true";
    });

    modal.querySelectorAll(".task-template-option").forEach(btn => {
      btn.addEventListener("click", function () {
        applyTemplateSelection(modal, this.dataset.templateKey);
      });
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#taskModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#taskModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#taskModalDraftBtn").addEventListener("click", function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();
      openOutlookDraft(selectedTemplate, context);
    });

    modal.querySelector("#taskModalCopyBtn").addEventListener("click", async function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();

      try {
        const richCopied = await copyFormattedEmail(selectedTemplate, context);
        if (richCopied) {
          showModalStatus("Formatted email copied. Open a new Outlook message and paste it into the body.", false);
        } else {
          showModalStatus("Plain text email copied. Rich clipboard was not available in this browser context.", false);
        }
      } catch (err) {
        log("Clipboard copy failed", err);
        showModalStatus("Unable to copy email content to clipboard.", true);
      }
    });

    applyTemplateSelection(modal, "general");
    contextInput.focus();
  }

  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = BUTTON_ID;
    button.title = BUTTON_TITLE;
    button.innerHTML = `<i class="fa fa-paper-plane" aria-hidden="true"></i>`;

    button.style.setProperty("display", "inline-flex", "important");
    button.style.setProperty("align-items", "center", "important");
    button.style.setProperty("justify-content", "center", "important");
    button.style.setProperty("width", "24px", "important");
    button.style.setProperty("height", "24px", "important");
    button.style.setProperty("min-width", "24px", "important");
    button.style.setProperty("min-height", "24px", "important");
    button.style.setProperty("padding", "0", "important");
    button.style.setProperty("margin", "0", "important");
    button.style.setProperty("background", "transparent", "important");
    button.style.setProperty("background-color", "transparent", "important");
    button.style.setProperty("border", "none", "important");
    button.style.setProperty("border-radius", "0", "important");
    button.style.setProperty("box-shadow", "none", "important");
    button.style.setProperty("outline", "none", "important");
    button.style.setProperty("appearance", "none", "important");
    button.style.setProperty("-webkit-appearance", "none", "important");
    button.style.setProperty("cursor", "pointer", "important");
    button.style.setProperty("color", "#666", "important");
    button.style.setProperty("line-height", "1", "important");
    button.style.setProperty("font-size", "0", "important");
    button.style.setProperty("vertical-align", "middle", "important");

    const icon = button.querySelector("i");
    icon.style.setProperty("font-size", "13px", "important");
    icon.style.setProperty("line-height", "1", "important");
    icon.style.setProperty("display", "inline-block", "important");
    icon.style.setProperty("margin", "0", "important");
    icon.style.setProperty("padding", "0", "important");
    icon.style.setProperty("color", "#666", "important");
    icon.style.setProperty("pointer-events", "none", "important");

    button.addEventListener("mouseenter", () => {
      button.style.setProperty("background-color", "transparent", "important");
      icon.style.setProperty("color", "#0078d7", "important");
    });

    button.addEventListener("mouseleave", () => {
      button.style.setProperty("background-color", "transparent", "important");
      icon.style.setProperty("color", "#666", "important");
    });

    button.addEventListener("focus", () => {
      button.style.setProperty("background-color", "transparent", "important");
      button.style.setProperty("outline", "none", "important");
      button.style.setProperty("box-shadow", "none", "important");
    });

    button.addEventListener("mousedown", () => {
      button.style.setProperty("background-color", "transparent", "important");
    });

    button.addEventListener("mouseup", () => {
      button.style.setProperty("background-color", "transparent", "important");
    });

    button.addEventListener("click", function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      createModal();
    });

    return button;
  }

  function injectButton() {
    const actionMenu = document.querySelector(ACTION_MENU_SELECTOR);
    if (!actionMenu) return false;
    if (document.getElementById(BUTTON_ID)) return true;

    const li = document.createElement("li");
    li.style.setProperty("list-style", "none", "important");
    li.style.setProperty("margin", "0 6px 0 0", "important");
    li.style.setProperty("padding", "0", "important");
    li.style.setProperty("display", "inline-flex", "important");
    li.style.setProperty("align-items", "center", "important");
    li.style.setProperty("background", "transparent", "important");
    li.style.setProperty("background-color", "transparent", "important");
    li.style.setProperty("border", "none", "important");
    li.style.setProperty("box-shadow", "none", "important");

    li.appendChild(createButton());
    actionMenu.appendChild(li);

    log("Maintenance task email button injected");
    return true;
  }

  function waitForActionMenuAndInject() {
    if (injectButton()) return;

    const observer = new MutationObserver(() => {
      if (injectButton()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    try {
      installTaskFormViewInterceptor();
      seedTaskFormViewFromPage();
      waitForActionMenuAndInject();
    } catch (err) {
      log("Initialization failed", err);
    }
  }

  init();
})();
