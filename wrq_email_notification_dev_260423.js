(function () {
  const SCRIPT_VERSION = "1.0.0";
  const BUTTON_ID = "toolbarMaintenanceRequestEmailButton";
  const BUTTON_TITLE = "Draft maintenance request email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarMaintenanceRequestEmailModal";
  const OVERLAY_ID = "toolbarMaintenanceRequestEmailOverlay";

  const TEMPLATE_OPTIONS = [
    { key: "general", label: "General Review Needed" },
    { key: "approval", label: "Approval Needed" },
    { key: "correction", label: "Correction Needed" },
    { key: "conversion", label: "Conversion / Routing Review" }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function extractRequestRecordInfo(payload) {
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
        obj.RequestStatus?.Desc ??
        obj.ReqStatus?.Desc ??
        obj.Status?.Desc ??
        obj.Status ??
        obj.status ??
        "";

      const id =
        obj.RecordId ??
        obj.RecordID ??
        obj.ID ??
        obj.Id ??
        obj.RequestID ??
        obj.WorkRequestID ??
        obj.MRID ??
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

  function installRequestFormViewInterceptor() {
    if (window.__REQUEST_FORMVIEW_INTERCEPTOR_INSTALLED__) return;
    window.__REQUEST_FORMVIEW_INTERCEPTOR_INSTALLED__ = true;

    function isRelevant(url) {
      return /GetFormViewData|Load/i.test(url || "");
    }

    function processPayload(data, source, url) {
      const info = extractRequestRecordInfo(data);
      if (!info || !info.recordKey) return;

      window.__MPULSE_REQUEST_FORMVIEW__ = {
        ...info,
        source,
        url,
        capturedAt: new Date().toISOString()
      };

      log("Updated maintenance request form view", window.__MPULSE_REQUEST_FORMVIEW__);
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
        console.warn("[REQUEST] fetch intercept failed", err);
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
          console.warn("[REQUEST] xhr intercept failed", err);
        }
      });

      return xhr;
    }

    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  }

  function seedRequestFormViewFromPage() {
    try {
      if (window.__MPULSE_REQUEST_FORMVIEW__?.recordKey) return;

      const scope = angular.element(document.body).scope();
      const selectedObject =
        scope?.$parent?.listviewlayouts?.SelectedObject ||
        scope?.$parent?.SelectedObject ||
        null;

      if (!selectedObject) return;

      const info = extractRequestRecordInfo({ SelectedObject: selectedObject });
      if (!info || !info.recordKey) return;

      window.__MPULSE_REQUEST_FORMVIEW__ = {
        ...info,
        source: "seeded-from-page",
        capturedAt: new Date().toISOString()
      };

      log("Seeded maintenance request form view from current page", window.__MPULSE_REQUEST_FORMVIEW__);
    } catch (err) {
      log("Failed to seed maintenance request form view", err);
    }
  }

  function getRequestObj() {
    return (
      window.__MPULSE_REQUEST_FORMVIEW__?.obj ||
      window.__MPULSE_REQUEST_FORMVIEW__?.raw?.SelectedObject ||
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

  function cleanLookup(value) {
    if (!value) return "";

    if (typeof value === "object") {
      const desc = value.Desc ?? value.Description ?? value.Value ?? "";
      const key = value.Key ?? value.key ?? "";
      const cleanedDesc = String(desc || "").trim();
      const cleanedKey = String(key || "").trim();

      if (!cleanedDesc || cleanedDesc === "ID #Description" || cleanedDesc === "-999") {
        return cleanedKey === "-999" ? "" : "";
      }

      return cleanedDesc;
    }

    const text = String(value).trim();
    if (!text || text === "ID #Description" || text === "-999") return "";
    return text;
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

      const txt = normalizeText(el.value || el.innerText || el.textContent || "");
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
    const obj = getRequestObj();
    return (
      obj?.RecordId ||
      obj?.RecordID ||
      obj?.RequestID ||
      obj?.WorkRequestID ||
      obj?.MRID ||
      getText(["#ID", "#REQID", "#WRQID", "[id='ID']"]) ||
      getDisplayValueByLabel("ID#")
    );
  }

  function getStatus() {
    const obj = getRequestObj();
    return (
      obj?.StatusDesc ||
      obj?.RequestStatus?.Desc ||
      obj?.ReqStatus?.Desc ||
      getDisplayValueByLabel("Request Status") ||
      getDisplayValueByLabel("Status") ||
      getText(["#StatusDesc"])
    );
  }

  function getDescription() {
    const obj = getRequestObj();
    return (
      obj?.Description ||
      obj?.Desc ||
      getText(["#Description", "#REQDescription", "#WRQDescription"]) ||
      getDisplayValueByLabel("Description")
    );
  }

  function getRequestType() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.RequestType ||
      obj?.Type ||
      getDisplayValueByLabel("Request Type") ||
      getDisplayValueByLabel("Type") ||
      ""
    );
  }

  function getPriority() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.Priority ||
      obj?.PriorityDesc ||
      getDisplayValueByLabel("Priority") ||
      ""
    );
  }

  function getRequester() {
    const obj = getRequestObj();
    const cleaned = cleanLookup(
      obj?.Requester ||
      obj?.Employee ||
      obj?.EnteredBy ||
      getDisplayValueByLabel("Requester") ||
      getDisplayValueByLabel("Requested By") ||
      getDisplayValueByLabel("Employee") ||
      ""
    );
    return cleaned || "Unavailable";
  }

  function getDepartment() {
    return cleanLookup(
      getRequestObj()?.Department ||
      getDisplayValueByLabel("Department") ||
      ""
    );
  }

  function getSystem() {
    return cleanLookup(
      getRequestObj()?.System ||
      getDisplayValueByLabel("System") ||
      ""
    );
  }

  function getSubsystem() {
    return cleanLookup(
      getRequestObj()?.Subsystem ||
      getDisplayValueByLabel("Subsystem") ||
      ""
    );
  }

  function getLocation() {
    return cleanLookup(
      getRequestObj()?.Location ||
      getDisplayValueByLabel("Location") ||
      getDisplayValueByLabel("Room") ||
      ""
    );
  }

  function getDateOpened() {
    const obj = getRequestObj();
    return (
      obj?.OpenDate ||
      obj?.DateOpened ||
      getDisplayValueByLabel("Date Opened") ||
      getText(["#Open"])
    );
  }

  function getDateDue() {
    const obj = getRequestObj();
    return (
      obj?.DueDate ||
      obj?.DateDue ||
      getDisplayValueByLabel("Date Due") ||
      getText(["#Due"])
    );
  }

  function getConvertedWorkOrder() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.WorkOrder ||
      obj?.ConvertedWorkOrder ||
      getDisplayValueByLabel("Work Order") ||
      getDisplayValueByLabel("Converted Work Order") ||
      ""
    );
  }

  function getAssetSummary() {
    const obj = getRequestObj();

    const singleAsset = cleanLookup(
      obj?.WKRQSTCADesc ||
      obj?.wkrqstcadesc ||
      obj?.WKRQSTCADesc ||
      ""
    );

    return singleAsset ? [singleAsset] : [];
  }

  function getRequestFlag() {
    const obj = getRequestObj();
    if (obj?.RecordFlag) return obj.RecordFlag;

    const status = String(getStatus() || window.__MPULSE_REQUEST_FORMVIEW__?.status || "").toLowerCase();
    if (status.includes("converted") || status.includes("closed") || status.includes("cancelled")) {
      return "WRQHST";
    }

    return "WRQ";
  }

  function buildRequestUrl() {
    try {
      const flag = getRequestFlag();
      const recordKey = window.__MPULSE_REQUEST_FORMVIEW__?.recordKey;
      if (recordKey) {
        return `${location.origin}/#/main/fal/RequestRecords/${recordKey}?Flag=${flag}`;
      }

      const match = location.hash.match(/\/(RequestRecords|MaintenanceRequestRecords|WorkRequestRecords)\/([^?\/]+)/i);
      if (match && match[2]) {
        return `${location.origin}/#/main/fal/RequestRecords/${match[2]}?Flag=${flag}`;
      }

      return location.href;
    } catch (err) {
      console.error("Request URL build failed", err);
    }

    return location.href;
  }

  function getRequestData() {
    return {
      id: getRecordId(),
      status: getStatus(),
      description: getDescription(),
      requestType: getRequestType(),
      priority: getPriority(),
      requester: getRequester(),
      department: getDepartment(),
      system: getSystem(),
      subsystem: getSubsystem(),
      location: getLocation(),
      dateOpened: formatDateOnly(getDateOpened()),
      dateDue: formatDateOnly(getDateDue()),
      convertedWorkOrder: getConvertedWorkOrder(),
      assets: getAssetSummary(),
      latestComment: getLatestCommentText(),
      link: buildRequestUrl()
    };
  }

  function getTemplateContent(templateKey) {
    switch (templateKey) {
      case "approval":
        return {
          label: "Approval Needed",
          subjectPrefix: "Approval Needed",
          actionHeader: "Approval Requested",
          defaultContext: "Approval is needed before this maintenance request can move forward.",
          issue: "This maintenance request requires review and approval before additional action can be taken.",
          impact: "Routing, conversion, or follow-up may be delayed until approval or direction is provided.",
          action: "Please review the request and approve it or advise next steps."
        };

      case "correction":
        return {
          label: "Correction Needed",
          subjectPrefix: "Correction Needed",
          actionHeader: "Correction Requested",
          defaultContext: "This maintenance request needs updates or corrections before it can move forward.",
          issue: "This maintenance request appears to need correction, clarification, or additional information.",
          impact: "Routing, conversion, or execution may be delayed until corrections are made.",
          action: "Please review the request, make the needed corrections, or advise next steps."
        };

      case "conversion":
        return {
          label: "Conversion / Routing Review",
          subjectPrefix: "Routing Review Needed",
          actionHeader: "Routing Review Requested",
          defaultContext: "This maintenance request needs routing or conversion review.",
          issue: "This maintenance request appears to need manager review for routing, conversion, or assignment.",
          impact: "Work order creation or follow-up action may remain pending until reviewed.",
          action: "Please review the request and advise whether it should be converted, reassigned, or otherwise updated."
        };

      case "general":
      default:
        return {
          label: "General Review Needed",
          subjectPrefix: "Review Needed",
          actionHeader: "Action Requested",
          defaultContext: "This maintenance request needs review and next-step direction.",
          issue: "This maintenance request needs review and follow-up.",
          impact: "Progress may be delayed until direction is provided.",
          action: "Please review and advise on next steps."
        };
    }
  }

  function buildSubject(templateKey, data) {
    const template = getTemplateContent(templateKey);
    const descPart = data.description ? ` - ${data.description}` : "";
    return `REQUEST ${data.id || "[Unknown]"} - ${template.subjectPrefix}${descPart}`;
  }

  function buildSummaryLines(data) {
    return [
      `Maintenance Request: ${data.id || "[Unavailable]"}`,
      data.status ? `Status: ${data.status}` : "",
      data.description ? `Description: ${data.description}` : "",
      data.requestType ? `Request Type: ${data.requestType}` : "",
      data.priority ? `Priority: ${data.priority}` : "",
      data.requester ? `Requester: ${data.requester}` : "",
      data.department ? `Department: ${data.department}` : "",
      data.system ? `System: ${data.system}` : "",
      data.subsystem ? `Subsystem: ${data.subsystem}` : "",
      data.location ? `Location: ${data.location}` : "",
      data.dateOpened ? `Date Opened: ${data.dateOpened}` : "",
      data.dateDue ? `Date Due: ${data.dateDue}` : "",
      data.convertedWorkOrder ? `Work Order: ${data.convertedWorkOrder}` : ""
    ].filter(Boolean);
  }

  function buildPlainTextBody(templateKey, userContext) {
    const data = getRequestData();
    const template = getTemplateContent(templateKey);

    const lines = [
      "ACTION REQUIRED",
      "",
      section("REQUEST SUMMARY", buildSummaryLines(data)),
      data.assets.length ? section("ASSOCIATED ASSETS", data.assets) : "",
      section("ISSUE", [wrapText(template.issue, 95)]),
      section("IMPACT", [wrapText(template.impact, 95)]),
      section(template.actionHeader.toUpperCase(), [wrapText(template.action, 95)]),
      userContext ? section("ADDITIONAL CONTEXT", [wrapText(userContext, 95)]) : "",
      data.latestComment ? section("LATEST UPDATE", [wrapText(data.latestComment, 95)]) : "",
      section("OPEN MAINTENANCE REQUEST", [data.link]),
      "Thank you."
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
    const data = getRequestData();
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

    return `
      <div style="font-family:Arial,sans-serif; font-size:13px; line-height:1.45; color:#222;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:14px;">ACTION REQUIRED</div>
        ${htmlSection("Request Summary", summaryRows)}
        ${assetsHtml ? htmlSection("Associated Assets", assetsHtml) : ""}
        ${htmlSection("Issue", `<div>${escapeHtml(template.issue)}</div>`)}
        ${htmlSection("Impact", `<div>${escapeHtml(template.impact)}</div>`)}
        ${htmlSection(template.actionHeader, `<div>${escapeHtml(template.action)}</div>`)}
        ${userContext ? htmlSection("Additional Context", `<div>${escapeHtml(userContext)}</div>`) : ""}
        ${data.latestComment ? htmlSection("Latest Update", `<div>${escapeHtml(data.latestComment)}</div>`) : ""}
        ${htmlSection(
          "Open Maintenance Request",
          `<div><a href="${escapeHtml(data.link)}">Open Maintenance Request</a></div><div style="margin-top:6px; color:#666;">${escapeHtml(data.link)}</div>`
        )}
        <div style="margin-top:14px;">Thank you.</div>
      </div>
    `;
  }

  function openOutlookDraft(templateKey, userContext) {
    const data = getRequestData();
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
    const data = getRequestData();
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
    const statusEl = document.querySelector("#requestEmailModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelectorAll(".request-template-option").forEach(btn => {
      const isActive = btn.dataset.templateKey === templateKey;
      btn.style.borderColor = isActive ? "#1976d2" : "#cfd8dc";
      btn.style.background = isActive ? "#eaf3ff" : "#fff";
      btn.style.color = "#222";
    });

    const contextBox = modal.querySelector("#requestContextInput");
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
        <div style="font-size:16px; font-weight:bold;">Maintenance Request Email</div>
        <button type="button" id="requestModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Select template</div>

      <div id="requestTemplateOptions" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        ${TEMPLATE_OPTIONS.map(opt => `
          <button
            type="button"
            class="request-template-option"
            data-template-key="${opt.key}"
            style="padding:10px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; text-align:left; font-size:13px;"
          >${opt.label}</button>
        `).join("")}
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="requestContextInput"
        style="width:100%; min-height:110px; resize:vertical; border:1px solid #cfd8dc; border-radius:6px; padding:10px; font-family:Arial, sans-serif; font-size:13px; box-sizing:border-box;"
      ></textarea>

      <div id="requestEmailModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="requestModalCancelBtn"
          style="padding:8px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;"
        >Cancel</button>

        <button
          type="button"
          id="requestModalCopyBtn"
          style="padding:8px 12px; border:1px solid #2e7d32; border-radius:6px; background:#388e3c; color:#fff; cursor:pointer; font-size:13px;"
        >Copy Formatted Email</button>

        <button
          type="button"
          id="requestModalDraftBtn"
          style="padding:8px 12px; border:1px solid #1565c0; border-radius:6px; background:#1976d2; color:#fff; cursor:pointer; font-size:13px;"
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const contextInput = modal.querySelector("#requestContextInput");
    contextInput.addEventListener("input", function () {
      this.dataset.userEdited = "true";
    });

    modal.querySelectorAll(".request-template-option").forEach(btn => {
      btn.addEventListener("click", function () {
        applyTemplateSelection(modal, this.dataset.templateKey);
      });
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#requestModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#requestModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#requestModalDraftBtn").addEventListener("click", function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();
      openOutlookDraft(selectedTemplate, context);
    });

    modal.querySelector("#requestModalCopyBtn").addEventListener("click", async function () {
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

    log("Maintenance request email button injected");
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
      installRequestFormViewInterceptor();
      seedRequestFormViewFromPage();
      waitForActionMenuAndInject();
    } catch (err) {
      log("Initialization failed", err);
    }
  }

  init();
})();
