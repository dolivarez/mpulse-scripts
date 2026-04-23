(function () {
  const BTN_ID = "mpulse-download-csv-btn";

  if (!window.__MPULSE_MOREVIEW_HOOKED__) {
    window.__MPULSE_MOREVIEW_HOOKED__ = true;
    window.__MPULSE_MOREVIEW_DATA__ = null;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = args[0]?.url || args[0];
        if (typeof url === "string" && /MoreViewClick/i.test(url)) {
          const clone = response.clone();
          const data = await clone.json();

          if (data && Array.isArray(data.DataObject)) {
            window.__MPULSE_MOREVIEW_DATA__ = {
              url,
              capturedAt: new Date().toISOString(),
              payload: data
            };
            console.log("Captured MoreViewClick data:", window.__MPULSE_MOREVIEW_DATA__);
          }
        }
      } catch (err) {
        console.warn("MoreViewClick fetch capture failed:", err);
      }

      return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__mpulse_url__ = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      this.addEventListener("load", function () {
        try {
          const url = this.__mpulse_url__ || "";
          if (!/MoreViewClick/i.test(url)) return;
          if (!this.responseText) return;

          const data = JSON.parse(this.responseText);
          if (data && Array.isArray(data.DataObject)) {
            window.__MPULSE_MOREVIEW_DATA__ = {
              url,
              capturedAt: new Date().toISOString(),
              payload: data
            };
            console.log("Captured MoreViewClick data:", window.__MPULSE_MOREVIEW_DATA__);
          }
        } catch (err) {
          console.warn("MoreViewClick XHR capture failed:", err);
        }
      });

      return originalSend.apply(this, arguments);
    };
  }

  function getOpenModal() {
    return document.querySelector("body > div.modal.fade.ng-isolate-scope.in");
  }

  function getRecordLabel(modal) {
    if (!modal) return "Export";

    const el = modal.querySelector(
      "div.modal-body.view-popup-body.customize.ng-scope > div > div:nth-child(1) > div:nth-child(1) > div > div > span"
    );

    return (el?.innerText || "Export").trim();
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return normalizeText(div.textContent || div.innerText || "");
  }

  function formatDateOnly(value) {
    if (!value) return "";
    const str = String(value).trim();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return str;
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toFixed(2);
  }

  function getRows() {
    const payload = window.__MPULSE_MOREVIEW_DATA__?.payload;
    return Array.isArray(payload?.DataObject) ? payload.DataObject : [];
  }

  function getDatasetType(rows) {
    const first = rows[0] || {};

    if ("WKOCode" in first || "WKOStatus" in first || "WKOPriority" in first) {
      return "open_work_orders";
    }

    if ("HSTCODE" in first || "HSTDESC" in first || "WKODDONE" in first) {
      return "work_order_history";
    }

    return "unknown";
  }

  function detectFileLabel(rows) {
    const type = getDatasetType(rows);
    return type === "open_work_orders" ? "Open Work Orders" : "Work Order History";
  }

  function buildCsv(rows) {
    if (!rows.length) return "";

    const type = getDatasetType(rows);
    const csv = [];

    if (type === "open_work_orders") {
      const columns = [
        { header: "Due", key: "Due", formatter: formatDateOnly },
        { header: "ID#", key: "WKOCode" },
        { header: "Description", key: "WKODescription" },
        { header: "Status", key: "WKOStatus" },
        { header: "Work Order Priority", key: "WKOPriority" }
      ];

      csv.push(columns.map(col => csvEscape(col.header)).join(","));

      rows.forEach(row => {
        const line = columns.map(col => {
          const raw = row[col.key];
          const val = col.formatter ? col.formatter(raw) : normalizeText(raw);
          return csvEscape(val);
        });
        csv.push(line.join(","));
      });

      return csv.join("\n");
    }

    if (type === "work_order_history") {
      const columns = [
        { header: "Date Done", key: "WKODDONE", formatter: formatDateOnly },
        { header: "ID#", key: "HSTCODE" },
        { header: "Description", key: "HSTDESC" },
        { header: "Cost", key: "WKOCOST", formatter: formatCurrency },
        { header: "Comments", key: "HSTCM", formatter: stripHtml }
      ];

      csv.push(columns.map(col => csvEscape(col.header)).join(","));

      rows.forEach(row => {
        const line = columns.map(col => {
          const raw = row[col.key];
          const val = col.formatter ? col.formatter(raw) : normalizeText(raw);
          return csvEscape(val);
        });
        csv.push(line.join(","));
      });

      return csv.join("\n");
    }

    // fallback: export all keys if shape is unknown
    const headers = Object.keys(rows[0]);
    csv.push(headers.map(csvEscape).join(","));

    rows.forEach(row => {
      const line = headers.map(key => csvEscape(normalizeText(row[key])));
      csv.push(line.join(","));
    });

    return csv.join("\n");
  }

  function downloadCsv() {
    const rows = getRows();

    if (!rows.length) {
      alert("No captured MoreViewClick data found yet. Open the popup first, then try again.");
      return;
    }

    console.log("Detected dataset type:", getDatasetType(rows));
    console.log("First row:", rows[0]);

    const modal = getOpenModal();
    const recordLabel = getRecordLabel(modal);
    const fileLabel = detectFileLabel(rows);
    const csvContent = buildCsv(rows);

    if (!csvContent) {
      alert("No CSV data could be built.");
      return;
    }

    const fileName = `${recordLabel} ${fileLabel}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addButton() {
    const modal = getOpenModal();
    if (!modal) return;
    if (modal.querySelector("#" + BTN_ID)) return;

    const modalBody = modal.querySelector(".modal-body");
    if (!modalBody) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.innerHTML = '<i class="fa fa-file-csv"></i> CSV';
   btn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "gap:6px",
      "margin:0 0 10px 0",
      "padding:6px 10px",
      "background:#1976d2",
      "color:#fff",
      "border:none",
      "border-radius:4px",
      "cursor:pointer",
      "font-size:13px",
      "font-weight:600"
    ].join(";");

    btn.addEventListener("click", downloadCsv);
    modalBody.insertBefore(btn, modalBody.firstChild);
  }

  function init() {
    addButton();

    const observer = new MutationObserver(() => {
      addButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  init();
})();
