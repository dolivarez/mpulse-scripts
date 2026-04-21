
(function () {
  const SCRIPT_VERSION = "1.0.0";
  const BUTTON_ID = "toolbarRequisitionEmailButton";
  const BUTTON_TITLE = "Draft requisition email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarRequisitionEmailModal";
  const OVERLAY_ID = "toolbarRequisitionEmailOverlay";

  const TEMPLATE_OPTIONS = [
    { key: "general", label: "General Review Needed" },
    { key: "approval", label: "Approval Needed" },
    { key: "vendor", label: "Vendor Follow-Up Needed" },
    { key: "receiving", label: "Receiving / Closeout Review" }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function extractReqRecordInfo(payload) {
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
        obj.PorReqStatus?.Desc ??
        obj.StatusDesc ??
        obj.statusDesc ??
        obj.Status?.Desc ??
        obj.Status ??
        obj.status ??
        "";
  
      const id =
        obj.RecordId ??
        obj.RecordID ??
        obj.ID ??
        obj.Id ??
        obj.RequisitionID ??
        obj.ReqID ??
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
  
  function storeReqFormView(payload, source) {
    const info = extractReqRecordInfo(payload);
    if (!info || !info.recordKey) return;
  
    window.__MPULSE_REQ_FORMVIEW__ = {
      ...info,
      source,
      capturedAt: new Date().toISOString()
    };
  
    log("Captured requisition form view", window.__MPULSE_REQ_FORMVIEW__);
  }
  
  function installReqFormViewInterceptor() {
    if (window.__REQ_FORMVIEW_INTERCEPTOR_INSTALLED__) return;
    window.__REQ_FORMVIEW_INTERCEPTOR_INSTALLED__ = true;
  
    function isRelevant(url) {
      return /GetFormViewData|Load/i.test(url);
    }
  
    function processPayload(data, source, url) {
      const info = extractReqRecordInfo(data);
      if (!info || !info.recordKey) return;
  
      window.__MPULSE_REQ_FORMVIEW__ = {
        ...info,
        source,
        url,
        capturedAt: new Date().toISOString()
      };
  
      console.log("[REQ] Updated form view:", window.__MPULSE_REQ_FORMVIEW__);
    }
  
    // FETCH
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
        console.warn("[REQ] fetch intercept failed", err);
      }
  
      return response;
    };
  
    // XHR
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
          console.warn("[REQ] xhr intercept failed", err);
        }
      });
  
      return xhr;
    }
  
    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  
    console.log("[REQ] interceptor installed");
  }

  function getReqObj() {
    return (
      window.__MPULSE_REQ_FORMVIEW__?.obj ||
      window.__MPULSE_REQ_FORMVIEW__?.raw?.SelectedObject ||
      null
    );
  }

  function seedReqFormViewFromPage() {
    try {
      if (window.__MPULSE_REQ_FORMVIEW__?.recordKey) return;
  
      const scope = angular.element(document.body).scope();
      const selectedObject =
        scope?.$parent?.listviewlayouts?.SelectedObject ||
        scope?.$parent?.SelectedObject ||
        null;
  
      if (!selectedObject) return;
  
      const info = extractReqRecordInfo({ SelectedObject: selectedObject });
      if (!info || !info.recordKey) return;
  
      window.__MPULSE_REQ_FORMVIEW__ = {
        ...info,
        source: "seeded-from-page",
        capturedAt: new Date().toISOString()
      };
  
      log("Seeded requisition form view from current page", window.__MPULSE_REQ_FORMVIEW__);
    } catch (err) {
      log("Failed to seed requisition form view from page", err);
    }
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
      .replace(/"/g, "&quot;")
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
    return [
      title,
      "-".repeat(title.length),
      ...cleaned,
      ""
    ].join("\n");
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

  function formatDateOnly(value) {
    if (!value) return "";
  
    try {
      const d = new Date(value);
  
      // fallback if invalid date
      if (isNaN(d)) return String(value).split("T")[0];
  
      return d.toLocaleDateString("en-US"); // or your preferred format
    } catch {
      return String(value).split("T")[0];
    }
  }

  function getFieldValueByLabel(labelText) {
    const labels = Array.from(document.querySelectorAll("label, .dx-field-item-label-text, .fal-form-label, .form-group label, .control-label, span, div"));
    const wanted = normalizeText(labelText).toLowerCase();

    for (const node of labels) {
      const txt = normalizeText(node.textContent || "");
      if (!txt) continue;
      if (txt.toLowerCase() !== wanted) continue;

      // Common patterns: sibling input, next element, container input/text
      const container = node.closest(".dx-field-item, .form-group, td, tr, .row, div") || node.parentElement;
      if (!container) continue;

      const input =
        container.querySelector("input, textarea, select") ||
        node.parentElement?.querySelector("input, textarea, select") ||
        node.nextElementSibling?.querySelector?.("input, textarea, select") ||
        node.nextElementSibling;

      if (input) {
        const value =
          input.value ??
          input.innerText ??
          input.textContent ??
          "";
        const cleaned = normalizeText(value);
        if (cleaned) return cleaned;
      }

      // Fallback: search nearby text nodes/anchors
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
  
      // 1. Prefer linked/displayed text
      const linkedText = Array.from(container.querySelectorAll("a"))
        .map(a => normalizeText(a.textContent || ""))
        .find(Boolean);
      if (linkedText) return linkedText;
  
      // 2. DevExtreme rendered display text
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
  
      // 3. Read-only rendered text blocks / spans
      const visibleText = Array.from(container.querySelectorAll("span, div"))
        .map(el => normalizeText(el.textContent || ""))
        .find(v => v && v.toLowerCase() !== wanted);
      if (visibleText) return visibleText;
  
      // 4. Fallback to raw input/select value only if necessary
      const rawInput = container.querySelector("input, textarea, select");
      if (rawInput) {
        const rawVal = normalizeText(rawInput.value || rawInput.textContent || "");
        if (rawVal) return rawVal;
      }
    }
  
    return "";
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
  
      const txt = normalizeText(
        el.value ||
        el.innerText ||
        el.textContent ||
        ""
      );
  
      if (txt) return txt;
    }
    return "";
  }

  function formatCurrency(value) {
    const num = Number(value);
  
    if (isNaN(num)) return value || "";
  
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(num);
  }

  function readCurrencyLike(label) {
    const raw = getFieldValueByLabel(label);
    return raw || "";
  }

  function getRecordId() {
    const obj = getReqObj();
    return (
      obj?.RecordId ||
      obj?.RecordID ||
      getText(["#ID", "#REQID", "[id='ID']"]) ||
      getDisplayValueByLabel("ID#")
    );
  }


  function getRequisitionStatus() {
    const obj = getReqObj();
    return (
      obj?.PorReqStatus?.Desc ||
      obj?.StatusDesc ||
      getDisplayValueByLabel("Requisition Status") ||
      getText(["#StatusDesc", "#REQStatusDesc"])
    );
  }

  function cleanLookupText(value) {
    if (value == null) return "";
  
    if (typeof value === "object") {
      const desc = value.Desc ?? value.Description ?? value.Value ?? "";
      const key = value.Key ?? value.key ?? "";
  
      if (String(desc).trim() && String(desc).trim() !== "-999") {
        return String(desc).trim();
      }
  
      if (String(key).trim() === "-999") return "";
      return "";
    }
  
    const text = String(value).trim();
    return text === "-999" ? "" : text;
  }
  
  function getSupplier() {
    const obj = getReqObj();
    return (
      cleanLookupText(obj?.Supplier) ||
      cleanLookupText(obj?.SelectedVendor) ||
      getDisplayValueByLabel("Supplier") ||
      getText(["#SupplierDesc", "#CompanyDesc"])
    );
  }
  
  function getShipToCompany() {
    const obj = getReqObj();
    return (
      cleanLookupText(obj?.ShipToCompany) ||
      getDisplayValueByLabel("Ship to Company") ||
      getDisplayValueByLabel("Ship To Company")
    );
  }
  
  function getBillToCompany() {
    const obj = getReqObj();
    return (
      cleanLookupText(obj?.BillToCompany) ||
      getDisplayValueByLabel("Bill to Company") ||
      getDisplayValueByLabel("Bill To Company")
    );
  }

  function getQuoteNumber() {
    return getFieldValueByLabel("Quote #");
  }

  function getRO() {
    return getFieldValueByLabel("RO");
  }

  function getPO() {
    return getFieldValueByLabel("PO");
  }

  function getOrderDate() {
    const obj = getReqObj();
    return (
      obj?.OrderDate ||
      getDisplayValueByLabel("Order Date") ||
      getText(["#Open", "#OrderDate"])
    );
  }

  function getDateRequired() {
    const obj = getReqObj();
    return (
      obj?.RequiredDate ||
      getDisplayValueByLabel("Date Required") ||
      getText(["#Due", "#DateRequired"])
    );
  }

  function getDateReceived() {
    const obj = getReqObj();
    return (
      obj?.PORDone ||
      getFieldValueByLabel("Date Received")
    );
  }

  function getTaxValue() {
    const obj = getReqObj();
    return obj?.PorTaxDollar ?? readCurrencyLike("Tax Value");
  }

  function getSubtotal() {
    const obj = getReqObj();
    return obj?.SubTotal ?? readCurrencyLike("Subtotal");
  }

  function getTotal() {
    const obj = getReqObj();
    const subtotal = Number(obj?.SubTotal ?? 0);
    const tax = Number(obj?.PorTaxDollar ?? 0);
  
    if (obj && ("SubTotal" in obj || "PorTaxDollar" in obj)) {
      return subtotal + tax;
    }
  
    return readCurrencyLike("Total");
  }

  function getFinancialItems() {
    const obj = getReqObj();
  
    const rows =
      (Array.isArray(obj?.LstRequisitionInv) && obj.LstRequisitionInv) ||
      (Array.isArray(obj?.LnkRequisitionInv) && obj.LnkRequisitionInv) ||
      (Array.isArray(window.__MPULSE_REQ_FORMVIEW__?.raw?.SelectedObject?.LstRequisitionInv) &&
        window.__MPULSE_REQ_FORMVIEW__.raw.SelectedObject.LstRequisitionInv) ||
      (Array.isArray(window.__MPULSE_REQ_FORMVIEW__?.raw?.LnkRequisitionInv) &&
        window.__MPULSE_REQ_FORMVIEW__.raw.LnkRequisitionInv) ||
      [];
  
    return rows.map((row, idx) => ({
      itemNo: normalizeText(
        row.ItemNo || row.LineNo || row.Seq || String(idx + 1)
      ),
      itemCode: normalizeText(
        row.ReqItemCode || ""
      ),
      description: normalizeText(
        row.ReqItemDesc || ""
      ),
      qtyOrdered: normalizeText(
        row.ReqQtyOrdered ?? ""
      ),
      units: normalizeText(
        row.UnitOfStock3?.Desc || row.UnitOfStock3 || ""
      ),
      unitPrice: normalizeText(
        row.ReqUnitPrice ?? ""
      ),
      netPrice: normalizeText(
        row.ReqNetPrice ?? ""
      )
    })).filter(item =>
      item.itemCode ||
      item.description ||
      item.qtyOrdered ||
      item.netPrice
    );
  }

  function getRequisitionFlag() {
    const obj = getReqObj();
    const recordFlag = obj?.RecordFlag;
    if (recordFlag) return recordFlag;
  
    const interceptedStatus = window.__MPULSE_REQ_FORMVIEW__?.status || "";
    const visibleStatus = getRequisitionStatus() || "";
    const status = (visibleStatus || interceptedStatus).toLowerCase();
  
    return status.includes("closed") ? "PORHST" : "POR";
  }
  
  function buildRequisitionUrl() {
    try {
      const flag = getRequisitionFlag();
  
      // 1. Primary: intercepted data (always correct after Load or navigation)
      const recordKey = window.__MPULSE_REQ_FORMVIEW__?.recordKey;
      if (recordKey) {
        return `${location.origin}/#/main/fal/RequisitionRecords/${recordKey}?Flag=${flag}`;
      }
  
      // 2. Fallback: current hash
      const match = location.hash.match(/\/RequisitionRecords\/([^?\/]+)/i);
      if (match && match[1]) {
        return `${location.origin}/#/main/fal/RequisitionRecords/${match[1]}?Flag=${flag}`;
      }
  
      // 3. Last fallback
      return location.href;
    } catch (e) {
      console.error("URL build failed", e);
    }
  
    return location.href;
  }

  function getRequisitionData() {
    return {
      id: getRecordId(),
      status: getRequisitionStatus(),
      supplier: getSupplier(),
      shipToCompany: getShipToCompany(),
      billToCompany: getBillToCompany(),
      quoteNumber: getQuoteNumber(),
      ro: getRO(),
      po: getPO(),
      orderDate: formatDateOnly(getOrderDate()),
      dateRequired: formatDateOnly(getDateRequired()),
      dateReceived: formatDateOnly(getDateReceived()),
      taxValue: getTaxValue(),
      subtotal: getSubtotal(),
      total: getTotal(),
      latestComment: getLatestCommentText(),
      items: getFinancialItems(),
      link: buildRequisitionUrl()
    };
  }

  function getTemplateContent(templateKey) {
    switch (templateKey) {
      case "approval":
        return {
          label: "Approval Needed",
          subjectPrefix: "Approval Needed",
          actionHeader: "Approval Requested",
          defaultContext: "Approval is needed before this requisition can proceed.",
          issue: "This requisition requires review and approval before additional action can be taken.",
          impact: "Ordering, receiving, or follow-up may be delayed until approval or direction is provided.",
          action: "Please review the requisition and approve it or advise next steps."
        };

      case "vendor":
        return {
          label: "Vendor Follow-Up Needed",
          subjectPrefix: "Vendor Follow-Up Needed",
          actionHeader: "Vendor Follow-Up Requested",
          defaultContext: "Vendor follow-up is needed to confirm status, delivery, or open questions.",
          issue: "This requisition needs vendor follow-up to confirm current order status or outstanding details.",
          impact: "Delivery timing, receiving, or closure may be delayed without vendor response.",
          action: "Please review the requisition and follow up with the vendor or advise next steps."
        };

      case "receiving":
        return {
          label: "Receiving / Closeout Review",
          subjectPrefix: "Receiving Review Needed",
          actionHeader: "Receiving Review Requested",
          defaultContext: "This requisition needs receiving or closeout review.",
          issue: "This requisition appears to need receiving confirmation, closeout review, or status update.",
          impact: "Record completion or downstream processing may remain incomplete until reviewed.",
          action: "Please review receiving status and advise whether the requisition can be updated or closed."
        };

      case "general":
      default:
        return {
          label: "General Review Needed",
          subjectPrefix: "Review Needed",
          actionHeader: "Action Requested",
          defaultContext: "This requisition needs review and next-step direction.",
          issue: "This requisition needs review and follow-up.",
          impact: "Progress may be delayed until direction is provided.",
          action: "Please review and advise on next steps."
        };
    }
  }

  function buildSubject(templateKey, data) {
    const template = getTemplateContent(templateKey);
    const supplierPart = data.supplier ? ` - ${data.supplier}` : "";
    return `REQ ${data.id || "[Unknown]"} - ${template.subjectPrefix}${supplierPart}`;
  }

  function buildItemSummaryLines(items) {
    if (!items.length) return [];
  
    return items.slice(0, 10).map(item =>
      [
        item.itemCode || "",
        item.description || "",
        item.qtyOrdered ? `Qty ${item.qtyOrdered}` : "",
        item.units || "",
        item.unitPrice ? `Unit ${formatCurrency(item.unitPrice)}` : "",
        item.netPrice ? `Net ${formatCurrency(item.netPrice)}` : ""
      ].filter(Boolean).join(" | ")
    );
  }

  function buildPlainTextBody(templateKey, userContext) {
    const data = getRequisitionData();
    const template = getTemplateContent(templateKey);

    const summaryLines = [
      `Requisition: ${data.id || "[Unavailable]"}`,
      data.status ? `Status: ${data.status}` : "",
      data.supplier ? `Supplier: ${data.supplier}` : "",
      data.quoteNumber ? `Quote #: ${data.quoteNumber}` : "",
      data.ro ? `RO: ${data.ro}` : "",
      data.po ? `PO: ${data.po}` : "",
      data.shipToCompany ? `Ship To: ${data.shipToCompany}` : "",
      data.billToCompany ? `Bill To: ${data.billToCompany}` : "",
      data.orderDate ? `Order Date: ${data.orderDate}` : "",
      data.dateRequired ? `Date Required: ${data.dateRequired}` : "",
      data.dateReceived ? `Date Received: ${data.dateReceived}` : "",
      data.subtotal ? `Subtotal: ${formatCurrency(data.subtotal)}` : "",
      data.taxValue ? `Tax: ${formatCurrency(data.taxValue)}` : "",
      data.total ? `Total: ${formatCurrency(data.total)}` : ""
    ].filter(Boolean);

    const itemLines = buildItemSummaryLines(data.items);

    const lines = [
      "ACTION REQUIRED",
      "",
      section("REQUISITION SUMMARY", summaryLines),
      itemLines.length ? section("ITEMS SUMMARY", itemLines) : "",
      section("ISSUE", [wrapText(template.issue, 95)]),
      section(template.actionHeader.toUpperCase(), [wrapText(template.action, 95)]),
      userContext ? section("ADDITIONAL CONTEXT", [wrapText(userContext, 95)]) : "",
      data.latestComment ? section("LATEST UPDATE", [wrapText(data.latestComment, 95)]) : "",
      section("OPEN REQUISITION", [data.link]),
      "Thank you."
    ].filter(Boolean);

    return lines.join("\n");
  }

  function buildHtmlBody(templateKey, userContext) {
    const data = getRequisitionData();
    const template = getTemplateContent(templateKey);

    const summaryRows = [
      data.id ? `<div><b>Requisition:</b> ${escapeHtml(data.id)}</div>` : "",
      data.status ? `<div><b>Status:</b> ${escapeHtml(data.status)}</div>` : "",
      data.supplier ? `<div><b>Supplier:</b> ${escapeHtml(data.supplier)}</div>` : "",
      data.quoteNumber ? `<div><b>Quote #:</b> ${escapeHtml(data.quoteNumber)}</div>` : "",
      data.ro ? `<div><b>RO:</b> ${escapeHtml(data.ro)}</div>` : "",
      data.po ? `<div><b>PO:</b> ${escapeHtml(data.po)}</div>` : "",
      data.shipToCompany ? `<div><b>Ship To:</b> ${escapeHtml(data.shipToCompany)}</div>` : "",
      data.billToCompany ? `<div><b>Bill To:</b> ${escapeHtml(data.billToCompany)}</div>` : "",
      data.orderDate ? `<div><b>Order Date:</b> ${escapeHtml(data.orderDate)}</div>` : "",
      data.dateRequired ? `<div><b>Date Required:</b> ${escapeHtml(data.dateRequired)}</div>` : "",
      data.dateReceived ? `<div><b>Date Received:</b> ${escapeHtml(data.dateReceived)}</div>` : "",
      data.subtotal ? `<div><b>Subtotal:</b> ${formatCurrency(data.subtotal)}</div>` : "",
      data.taxValue ? `<div><b>Tax:</b> ${formatCurrency(data.taxValue)}</div>` : "",
      data.total ? `<div><b>Total:</b> ${formatCurrency(data.total)}</div>` : ""
    ].filter(Boolean).join("");

    const itemHtml = data.items.length
      ? `
        <table style="border-collapse:collapse; width:100%; font-size:12px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #ccc; text-align:left; padding:4px 6px;">Item Code</th>
              <th style="border-bottom:1px solid #ccc; text-align:left; padding:4px 6px;">Description</th>
              <th style="border-bottom:1px solid #ccc; text-align:right; padding:4px 6px;">Qty</th>
              <th style="border-bottom:1px solid #ccc; text-align:left; padding:4px 6px;">Units</th>
              <th style="border-bottom:1px solid #ccc; text-align:right; padding:4px 6px;">Unit Price</th>
              <th style="border-bottom:1px solid #ccc; text-align:right; padding:4px 6px;">Net Price</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.slice(0, 10).map(item => `
              <tr>
                <td style="padding:4px 6px;">${escapeHtml(item.itemCode || "")}</td>
                <td style="padding:4px 6px;">${escapeHtml(item.description || "")}</td>
                <td style="padding:4px 6px; text-align:right;">${escapeHtml(item.qtyOrdered || "")}</td>
                <td style="padding:4px 6px;">${escapeHtml(item.units || "")}</td>
                <td style="padding:4px 6px; text-align:right;">${formatCurrency(item.unitPrice || 0)}</td>
                <td style="padding:4px 6px; text-align:right;">${formatCurrency(item.netPrice || 0)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `
      : "";

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

    return `
      <div style="font-family:Arial,sans-serif; font-size:13px; line-height:1.45; color:#222;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:14px;">ACTION REQUIRED</div>

        ${htmlSection("Requisition Summary", summaryRows)}
        ${itemHtml ? htmlSection("Items", itemHtml) : ""}
        ${data.items.length > 10 ? `
          <div style="margin-top:6px; color:#666;">
            Showing first 10 of ${data.items.length} items. See full requisition for details.
          </div>
        ` : ""}
        ${htmlSection("Issue", `<div>${escapeHtml(template.issue)}</div>`)}
        ${htmlSection(template.actionHeader, `<div>${escapeHtml(template.action)}</div>`)}
        ${userContext ? htmlSection("Additional Context", `<div>${escapeHtml(userContext)}</div>`) : ""}
        ${data.latestComment ? htmlSection("Latest Update", `<div>${escapeHtml(data.latestComment)}</div>`) : ""}
        ${htmlSection(
          "Open Requisition",
          `<div><a href="${escapeHtml(data.link)}">Open Requisition</a></div><div style="margin-top:6px; color:#666;">${escapeHtml(data.link)}</div>`
        )}
        <div style="margin-top:14px;">Thank you.</div>
      </div>
    `;
  }

  function openOutlookDraft(templateKey, userContext) {
    const data = getRequisitionData();
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
    const data = getRequisitionData();
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
    const statusEl = document.querySelector("#reqEmailModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelectorAll(".req-template-option").forEach(btn => {
      const isActive = btn.dataset.templateKey === templateKey;
      btn.style.borderColor = isActive ? "#1976d2" : "#cfd8dc";
      btn.style.background = isActive ? "#eaf3ff" : "#fff";
      btn.style.color = "#222";
    });

    const contextBox = modal.querySelector("#reqContextInput");
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
        <div style="font-size:16px; font-weight:bold;">Requisition Email</div>
        <button type="button" id="reqModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Select template</div>

      <div id="reqTemplateOptions" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        ${TEMPLATE_OPTIONS.map(opt => `
          <button
            type="button"
            class="req-template-option"
            data-template-key="${opt.key}"
            style="
              padding:10px 12px;
              border:1px solid #cfd8dc;
              border-radius:6px;
              background:#fff;
              cursor:pointer;
              text-align:left;
              font-size:13px;
            "
          >${opt.label}</button>
        `).join("")}
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="reqContextInput"
        style="
          width:100%;
          min-height:110px;
          resize:vertical;
          border:1px solid #cfd8dc;
          border-radius:6px;
          padding:10px;
          font-family:Arial, sans-serif;
          font-size:13px;
          box-sizing:border-box;
        "
      ></textarea>

      <div id="reqEmailModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="reqModalCancelBtn"
          style="
            padding:8px 12px;
            border:1px solid #cfd8dc;
            border-radius:6px;
            background:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Cancel</button>

        <button
          type="button"
          id="reqModalCopyBtn"
          style="
            padding:8px 12px;
            border:1px solid #2e7d32;
            border-radius:6px;
            background:#388e3c;
            color:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Copy Formatted Email</button>

        <button
          type="button"
          id="reqModalDraftBtn"
          style="
            padding:8px 12px;
            border:1px solid #1565c0;
            border-radius:6px;
            background:#1976d2;
            color:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const contextInput = modal.querySelector("#reqContextInput");

    contextInput.addEventListener("input", function () {
      this.dataset.userEdited = "true";
    });

    modal.querySelectorAll(".req-template-option").forEach(btn => {
      btn.addEventListener("click", function () {
        applyTemplateSelection(modal, this.dataset.templateKey);
      });
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#reqModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#reqModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#reqModalDraftBtn").addEventListener("click", function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();
      openOutlookDraft(selectedTemplate, context);
    });

    modal.querySelector("#reqModalCopyBtn").addEventListener("click", async function () {
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

    log("Requisition email button injected");
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
      installReqFormViewInterceptor();
      seedReqFormViewFromPage();
      waitForActionMenuAndInject();
    } catch (err) {
      log("Initialization failed", err);
    }
  }

  init();
})();
