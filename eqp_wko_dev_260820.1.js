(function () {
  const SCRIPT_VERSION =
    "2026.08.20-inventory-open-context2-record-count-comments-sort";

  const CSV_BTN_ID =
    "mpulse-download-csv-btn";

  const PDF_BTN_ID =
    "mpulse-print-pdf-btn";

  const COL_BTN_ID =
    "mpulse-columns-btn";

  const COL_PANEL_ID =
    "mpulse-columns-panel";

  const TOOLBAR_ID =
    "mpulse-export-toolbar";

  const WRAPPER_ID =
    "mpulse-export-wrapper";

  const RECORD_COUNT_ATTR =
    "data-mpulse-record-count";

  const RECORD_COUNT_VALUE_ATTR =
    "data-mpulse-record-count-value";

  /* =====================================================================
     CUSTOM COLUMN ATTRIBUTES
     ===================================================================== */

  const LOCATION_ATTR =
    "data-mpulse-location-column";

  const LOCATION_COL_ATTR =
    "data-mpulse-location-col";

  const LOCATION_FILTER_ATTR =
    "data-mpulse-location-filter";

  const ASSET_ATTR =
    "data-mpulse-asset-column";

  const ASSET_COL_ATTR =
    "data-mpulse-asset-col";

  const WKO_TYPE_ATTR =
    "data-mpulse-wko-type-column";

  const WKO_TYPE_COL_ATTR =
    "data-mpulse-wko-type-col";

  /* =====================================================================
     STATE ATTRIBUTES
     ===================================================================== */

  const HISTORY_ENRICHED_ATTR =
    "data-mpulse-history-enriched";

  const HISTORY_ENRICHING_ATTR =
    "data-mpulse-history-enriching";

  const OPEN_ENRICHED_ATTR =
    "data-mpulse-open-enriched";

  const OPEN_ENRICHING_ATTR =
    "data-mpulse-open-enriching";

  const POPUP_LAYOUT_ATTR =
    "data-mpulse-report-layout";

  const DETAIL_CONCURRENCY = 3;

  /* =====================================================================
     GLOBAL STATE
     ===================================================================== */

  window.__MPULSE_WKO_DETAIL_CACHE__ =
    window.__MPULSE_WKO_DETAIL_CACHE__ ||
    {};

  window.__MPULSE_EXPORT_COLUMN_SELECTIONS__ =
    window.__MPULSE_EXPORT_COLUMN_SELECTIONS__ ||
    {};

  window.__MPULSE_FORMVIEW_TEMPLATE__ =
    window.__MPULSE_FORMVIEW_TEMPLATE__ ||
    null;

  window.__MPULSE_LOCATION_FILTER_VALUE__ =
    window.__MPULSE_LOCATION_FILTER_VALUE__ ||
    "";

  const detailCache =
    window.__MPULSE_WKO_DETAIL_CACHE__;

  const columnSelections =
    window.__MPULSE_EXPORT_COLUMN_SELECTIONS__;

  /* =====================================================================
     BASE COLUMN CONFIGURATION
     ===================================================================== */

  const COLUMN_CONFIG = {

    open_work_orders: [
      {
        key: "Due",
        header: "Due",
        formatter: formatDateOnly,
        pdfClass: "date",
        width: 10
      },

      {
        key: "WKOCode",
        header: "ID#",
        pdfClass: "id",
        width: 11
      },

      {
        key: "WKODescription",
        header: "Description",
        pdfClass: "description",
        width: 24
      },

      {
        key: "WKOStatus",
        header: "Status",
        pdfClass: "status",
        width: 12
      },

      {
        key: "WKOPriority",
        header: "Work Order Priority",
        pdfClass: "priority",
        width: 17
      }
    ],

    work_order_history: [
      {
        key: "WKODDONE",
        header: "Date Done",
        formatter: formatDateOnly,
        pdfClass: "date",
        width: 10
      },

      {
        key: "HSTCODE",
        header: "ID#",
        pdfClass: "id",
        width: 11
      },

      {
        key: "HSTDESC",
        header: "Description",
        pdfClass: "description",
        width: 22
      },

      {
        key: "WKOTYPE",
        header: "Work Order Type",
        pdfClass: "type",
        width: 13
      },

      {
        key: "__Location",
        header: "Location",
        pdfClass: "location",
        width: 8
      },

      {
        key: "WKOCOST",
        header: "Total Cost",
        formatter: formatCurrency,
        pdfFormatter: formatPdfCurrency,
        pdfClass: "cost",
        width: 9
      },

      {
        key: "HSTCM",
        header: "Work Order Comments",
        formatter: stripHtml,
        pdfFormatter: formatPdfComments,
        pdfClass: "comments",
        width: 27
      }
    ]
  };

  /* =====================================================================
     MOREVIEWCLICK CAPTURE
     ===================================================================== */

  if (
    !window.__MPULSE_MOREVIEW_HOOKED__
  ) {
    window.__MPULSE_MOREVIEW_HOOKED__ =
      true;

    window.__MPULSE_MOREVIEW_DATA__ =
      null;

    const originalFetch =
      window.fetch;

    window.fetch =
      async function (...args) {

        const response =
          await originalFetch.apply(
            this,
            args
          );

        try {

          const url =
            args[0]?.url ||
            args[0];

          if (
            typeof url === "string" &&
            /MoreViewClick/i.test(
              url
            )
          ) {

            const clone =
              response.clone();

            const data =
              await clone.json();

            if (
              data &&
              Array.isArray(
                data.DataObject
              )
            ) {

              window.__MPULSE_MOREVIEW_DATA__ = {
                url,

                capturedAt:
                  new Date()
                    .toISOString(),

                payload:
                  data
              };

              console.log(
                "Captured MoreViewClick data:",
                window.__MPULSE_MOREVIEW_DATA__
              );

              initializeSelectionsForCurrentDataset();

              setTimeout(
                () => {

                  const modal =
                    getOpenModal();

                  if (
                    modal
                  ) {
                    optimizeMoreViewPopupLayout(
                      modal
                    );

                    attachMoreViewResizeObserver(
                      modal
                    );
                  }

                  updateColumnButtonLabel();

                  tryEnrichCurrentWorkOrderPopup();

                },
                0
              );
            }
          }

        } catch (err) {

          console.warn(
            "MoreViewClick fetch capture failed:",
            err
          );

        }

        return response;
      };

    const originalOpen =
      XMLHttpRequest
        .prototype
        .open;

    const originalSend =
      XMLHttpRequest
        .prototype
        .send;

    XMLHttpRequest.prototype.open =
      function (
        method,
        url
      ) {

        this.__mpulse_moreview_url__ =
          url;

        return originalOpen.apply(
          this,
          arguments
        );
      };

    XMLHttpRequest.prototype.send =
      function () {

        this.addEventListener(
          "load",
          function () {

            try {

              const url =
                this.__mpulse_moreview_url__ ||
                "";

              if (
                !/MoreViewClick/i.test(
                  url
                )
              ) {
                return;
              }

              if (
                !this.responseText
              ) {
                return;
              }

              const data =
                JSON.parse(
                  this.responseText
                );

              if (
                data &&
                Array.isArray(
                  data.DataObject
                )
              ) {

                window.__MPULSE_MOREVIEW_DATA__ = {
                  url,

                  capturedAt:
                    new Date()
                      .toISOString(),

                  payload:
                    data
                };

                console.log(
                  "Captured MoreViewClick data:",
                  window.__MPULSE_MOREVIEW_DATA__
                );

                initializeSelectionsForCurrentDataset();

                setTimeout(
                  () => {

                    const modal =
                      getOpenModal();

                    if (
                      modal
                    ) {
                      optimizeMoreViewPopupLayout(
                        modal
                      );

                      attachMoreViewResizeObserver(
                        modal
                      );
                    }

                    updateColumnButtonLabel();

                    tryEnrichCurrentWorkOrderPopup();

                  },
                  0
                );
              }

            } catch (err) {

              console.warn(
                "MoreViewClick XHR capture failed:",
                err
              );

            }

          }
        );

        return originalSend.apply(
          this,
          arguments
        );
      };
  }

  /* =====================================================================
     CAPTURE GetFormViewData TEMPLATE
     ===================================================================== */

  if (
    !window.__MPULSE_FORMVIEW_TEMPLATE_HOOKED__
  ) {

    window.__MPULSE_FORMVIEW_TEMPLATE_HOOKED__ =
      true;

    const originalOpen =
      XMLHttpRequest
        .prototype
        .open;

    const originalSend =
      XMLHttpRequest
        .prototype
        .send;

    const originalSetRequestHeader =
      XMLHttpRequest
        .prototype
        .setRequestHeader;

    XMLHttpRequest.prototype.open =
      function (
        method,
        url
      ) {

        this.__mpulse_fv_method__ =
          method;

        this.__mpulse_fv_url__ =
          url;

        this.__mpulse_fv_headers__ =
          {};

        return originalOpen.apply(
          this,
          arguments
        );
      };

    XMLHttpRequest.prototype.setRequestHeader =
      function (
        name,
        value
      ) {

        if (
          this.__mpulse_fv_headers__
        ) {
          this.__mpulse_fv_headers__[
            name
          ] = value;
        }

        return originalSetRequestHeader.apply(
          this,
          arguments
        );
      };

    XMLHttpRequest.prototype.send =
      function (
        body
      ) {

        const xhr =
          this;

        const url =
          xhr.__mpulse_fv_url__ ||
          "";

        if (
          /GetFormViewData/i.test(
            url
          ) &&
          !xhr.__mpulse_enrichment_request__
        ) {

          xhr.addEventListener(
            "load",
            function () {

              try {

                let parsedBody =
                  null;

                try {

                  parsedBody =
                    typeof body ===
                      "string"
                      ? JSON.parse(
                          body
                        )
                      : body;

                } catch (_) {}

                if (
                  parsedBody
                    ?.SubModuleName !==
                  "WorkOrderRecords"
                ) {
                  return;
                }

                window.__MPULSE_FORMVIEW_TEMPLATE__ = {

                  method:
                    xhr.__mpulse_fv_method__,

                  url,

                  headers: {
                    ...xhr.__mpulse_fv_headers__
                  },

                  requestBody:
                    parsedBody
                };

                console.log(
                  "Captured WorkOrderRecords GetFormViewData template."
                );

                setTimeout(
                  tryEnrichCurrentWorkOrderPopup,
                  0
                );

              } catch (err) {

                console.warn(
                  "GetFormViewData template capture failed:",
                  err
                );

              }

            }
          );
        }

        return originalSend.apply(
          this,
          arguments
        );
      };
  }

  /* =====================================================================
     BASIC HELPERS
     ===================================================================== */

  function getOpenModal() {

    return document.querySelector(
      "body > div.modal.fade.ng-isolate-scope.in"
    );
  }

  function normalizeText(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /\u00A0/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function getRecordLabel(
    modal
  ) {

    if (
      !modal
    ) {
      return "Export";
    }

    const el =
      modal.querySelector(
        "div.modal-body.view-popup-body.customize.ng-scope > div > div:nth-child(1) > div:nth-child(1) > div > div > span"
      );

    return normalizeText(
      el?.innerText ||
      "Export"
    );
  }

  function getRecordDescription(
    modal
  ) {

    if (
      !modal
    ) {
      return "";
    }

    const containers =
      [
        ...modal.querySelectorAll(
          ".popup-id-desc-container"
        )
      ];

    for (
      const container of containers
    ) {

      const label =
        normalizeText(
          container.querySelector(
            "label"
          )?.innerText
        );

      if (
        label.toLowerCase() !==
        "description"
      ) {
        continue;
      }

      const value =
        normalizeText(
          container.querySelector(
            "span"
          )?.innerText
        );

      if (
        value
      ) {
        return value;
      }
    }

    return "";
  }

  function isInventoryContext(
    modal =
      getOpenModal()
  ) {

    const id =
      normalizeText(
        getRecordLabel(
          modal
        )
      );

    return /^INV-\d+/i.test(
      id
    );
  }

  function getCurrentInventoryId(
    modal =
      getOpenModal()
  ) {

    const id =
      normalizeText(
        getRecordLabel(
          modal
        )
      );

    return /^INV-\d+/i.test(
      id
    )
      ? id
      : "";
  }

  function csvEscape(
    value
  ) {

    return `"${String(
      value ?? ""
    ).replace(
      /"/g,
      '""'
    )}"`;
  }

  function stripHtml(
    html
  ) {

    const div =
      document.createElement(
        "div"
      );

    div.innerHTML =
      html ||
      "";

    return normalizeText(
      div.textContent ||
      div.innerText ||
      ""
    );
  }

  function formatPdfComments(
    html
  ) {

    const div =
      document.createElement(
        "div"
      );

    div.innerHTML =
      html ||
      "";

    /*
      Preserve line breaks already stored
      in the MPulse comment HTML.
    */

    div.querySelectorAll(
      "br"
    ).forEach(
      br =>
        br.replaceWith(
          "\n"
        )
    );

    let text =
      String(
        div.textContent ||
        div.innerText ||
        ""
      )
        .replace(
          /\r\n?/g,
          "\n"
        )
        .replace(
          /[ \t]+/g,
          " "
        )
        .replace(
          / *\n */g,
          "\n"
        )
        .trim();

    if (
      !text
    ) {
      return "";
    }

    /*
      Separate requester metadata.
    */

    text =
      text
        .replace(
          /\s+(Requester Name:)/gi,
          "\n$1"
        )
        .replace(
          /\s+(Requester email:)/gi,
          "\n$1"
        );

    /*
      Start each timestamped maintenance
      comment as a separate paragraph.

      Example:
        1/9/2024 12:14:20 PM Name - comment
    */

    text =
      text.replace(
        /\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\b/gi,
        "\n\n$1"
      );

    /*
      The original request timestamp follows
      "Date:" and should remain on that line.
    */

    text =
      text.replace(
        /Date:\s*\n\n/gi,
        "Date: "
      );

    return text
      .replace(
        /\n{3,}/g,
        "\n\n"
      )
      .trim();
  }

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function formatDateOnly(
    value
  ) {

    if (
      !value
    ) {
      return "";
    }

    const str =
      String(
        value
      ).trim();

    const match =
      str.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (
      match
    ) {

      return (
        `${match[1]}-` +
        `${match[2]}-` +
        `${match[3]}`
      );
    }

    return str;
  }

  function formatCurrency(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "";
    }

    const num =
      Number(
        value
      );

    if (
      Number.isNaN(
        num
      )
    ) {
      return String(
        value
      );
    }

    return num.toFixed(
      2
    );
  }

  function formatPdfCurrency(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "";
    }

    const num =
      Number(
        value
      );

    if (
      Number.isNaN(
        num
      )
    ) {
      return normalizeText(
        value
      );
    }

    return (
      "$" +
      num.toLocaleString(
        undefined,
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2
        }
      )
    );
  }

  function getRows() {

    const payload =
      window
        .__MPULSE_MOREVIEW_DATA__
        ?.payload;

    return Array.isArray(
      payload?.DataObject
    )
      ? payload.DataObject
      : [];
  }

    /* =====================================================================
     DATASET DETECTION
     ===================================================================== */

  function getDatasetType(
    rows
  ) {

    const first =
      rows[0] ||
      {};

    if (
      "WKOCode" in first ||
      "WKOStatus" in first ||
      "WKOPriority" in first
    ) {
      return "open_work_orders";
    }

    if (
      "HSTCODE" in first ||
      "HSTDESC" in first ||
      "WKODDONE" in first
    ) {
      return "work_order_history";
    }

    return "unknown";
  }

  function detectFileLabel(
    rows
  ) {

    const type =
      getDatasetType(
        rows
      );

    if (
      type ===
      "open_work_orders"
    ) {
      return "Open Work Orders";
    }

    if (
      type ===
      "work_order_history"
    ) {
      return "Work Order History";
    }

    return "Report";
  }

  /* =====================================================================
     PDF SORT HELPERS
     ===================================================================== */

  function parseReportDate(
    value
  ) {

    if (
      !value
    ) {
      return null;
    }

    const text =
      String(
        value
      ).trim();

    /*
      ISO-style date:
        2026-08-30
        2026-08-30T...
    */

    let match =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (
      match
    ) {

      const date =
        new Date(
          Number(
            match[1]
          ),
          Number(
            match[2]
          ) - 1,
          Number(
            match[3]
          )
        );

      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date;
    }

    /*
      US-style date:
        8/30/2026
        08/30/2026
    */

    match =
      text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
      );

    if (
      match
    ) {

      const date =
        new Date(
          Number(
            match[3]
          ),
          Number(
            match[1]
          ) - 1,
          Number(
            match[2]
          )
        );

      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date;
    }

    /*
      Final fallback for any MPulse date
      representation JavaScript recognizes.
    */

    const timestamp =
      Date.parse(
        text
      );

    if (
      Number.isNaN(
        timestamp
      )
    ) {
      return null;
    }

    return new Date(
      timestamp
    );
  }

  function compareReportDates(
    valueA,
    valueB,
    direction
  ) {

    const dateA =
      parseReportDate(
        valueA
      );

    const dateB =
      parseReportDate(
        valueB
      );

    /*
      Blank / invalid dates go to the end
      regardless of sort direction.
    */

    if (
      !dateA &&
      !dateB
    ) {
      return 0;
    }

    if (
      !dateA
    ) {
      return 1;
    }

    if (
      !dateB
    ) {
      return -1;
    }

    const difference =
      dateA.getTime() -
      dateB.getTime();

    return direction ===
      "desc"
      ? -difference
      : difference;
  }

  function getPdfSortedRows(
    rows
  ) {

    const type =
      getDatasetType(
        rows
      );

    /*
      Never mutate the captured MoreView data.
      PDF sorting is performed on a copy only.
    */

    const sorted =
      [
        ...rows
      ];

    /*
      Work Order History:
      newest Date Done first.
    */

    if (
      type ===
      "work_order_history"
    ) {

      sorted.sort(
        (
          a,
          b
        ) =>
          compareReportDates(
            a?.WKODDONE,
            b?.WKODDONE,
            "desc"
          )
      );

      return sorted;
    }

    /*
      Open Work Orders:
      earliest Due date first.
    */

    if (
      type ===
      "open_work_orders"
    ) {

      sorted.sort(
        (
          a,
          b
        ) =>
          compareReportDates(
            a?.Due,
            b?.Due,
            "asc"
          )
      );

      return sorted;
    }

    return sorted;
  }

  /* =====================================================================
     DYNAMIC COLUMN CONFIGURATION
     ===================================================================== */

  function getColumns(
    rows
  ) {

    const type =
      getDatasetType(
        rows
      );

    /*
      INVENTORY OPEN WORK ORDERS

      Add:
        Work Order Type
        Location
        Asset

      Location and Asset both come from the
      asset whose ListOfInventory contains the
      current INV record.
    */

    if (
      type ===
      "open_work_orders"
    ) {

      const columns =
        COLUMN_CONFIG
          .open_work_orders
          .map(
            col => ({
              ...col
            })
          );

      if (
        isInventoryContext()
      ) {

        const descriptionIndex =
          columns.findIndex(
            col =>
              col.key ===
              "WKODescription"
          );

        columns.splice(
          descriptionIndex + 1,
          0,

          {
            key:
              "__WorkOrderType",

            header:
              "Work Order Type",

            pdfClass:
              "type",

            width:
              14
          },

          {
            key:
              "__Location",

            header:
              "Location",

            pdfClass:
              "location",

            width:
              8
          },

          {
            key:
              "__AssetDisplay",

            header:
              "Asset",

            pdfClass:
              "asset",

            width:
              24
          }
        );
      }

      return columns;
    }

    /*
      WORK ORDER HISTORY
    */

    if (
      type ===
      "work_order_history"
    ) {

      const columns =
        COLUMN_CONFIG
          .work_order_history
          .map(
            col => ({
              ...col
            })
          );

      /*
        Inventory Work Order History gets
        relationship-aware Asset context.
      */

      if (
        isInventoryContext()
      ) {

        const locationIndex =
          columns.findIndex(
            col =>
              col.key ===
              "__Location"
          );

        columns.splice(
          locationIndex + 1,
          0,
          {
            key:
              "__AssetDisplay",

            header:
              "Asset",

            pdfClass:
              "asset",

            width:
              22
          }
        );
      }

      return columns;
    }

    if (
      COLUMN_CONFIG[
        type
      ]
    ) {

      return COLUMN_CONFIG[
        type
      ];
    }

    if (
      !rows.length
    ) {
      return [];
    }

    /*
      Generic support for other MoreView
      datasets.
    */

    return Object.keys(
      rows[0]
    )
      .filter(
        key =>
          !key.startsWith(
            "__"
          )
      )
      .map(
        key => ({
          key,

          header:
            key,

          width:
            1
        })
      );
  }

  function getSelectionKey(
    rows
  ) {

    const type =
      getDatasetType(
        rows
      );

    if (
      type ===
        "open_work_orders" &&
      isInventoryContext()
    ) {
      return "open_work_orders_inventory";
    }

    if (
      type ===
        "work_order_history" &&
      isInventoryContext()
    ) {
      return "work_order_history_inventory";
    }

    if (
      type ===
        "unknown" &&
      rows.length
    ) {

      return (
        "generic_" +
        Object.keys(
          rows[0]
        )
          .sort()
          .join(
            "|"
          )
      );
    }

    return type;
  }

  function ensureColumnSelections(
    rows
  ) {

    const selectionKey =
      getSelectionKey(
        rows
      );

    const columns =
      getColumns(
        rows
      );

    if (
      !columnSelections[
        selectionKey
      ]
    ) {

      columnSelections[
        selectionKey
      ] = {};
    }

    const selections =
      columnSelections[
        selectionKey
      ];

    columns.forEach(
      col => {

        if (
          typeof selections[
            col.key
          ] !==
          "boolean"
        ) {

          selections[
            col.key
          ] = true;
        }
      }
    );

    return selections;
  }

  function initializeSelectionsForCurrentDataset() {

    const rows =
      getRows();

    if (
      !rows.length
    ) {
      return;
    }

    ensureColumnSelections(
      rows
    );
  }

  function getSelectedColumns(
    rows
  ) {

    const columns =
      getColumns(
        rows
      );

    const selections =
      ensureColumnSelections(
        rows
      );

    return columns.filter(
      col =>
        selections[
          col.key
        ] !== false
    );
  }

  /* =====================================================================
     POPUP RECORD COUNT
     ===================================================================== */

  function ensurePopupRecordCount(
    modal
  ) {

    if (
      !modal
    ) {
      return null;
    }

    let countRow =
      modal.querySelector(
        `[${RECORD_COUNT_ATTR}]`
      );

    if (
      countRow
    ) {
      return countRow;
    }

    const containers =
      [
        ...modal.querySelectorAll(
          ".popup-id-desc-container"
        )
      ];

    if (
      !containers.length
    ) {
      return null;
    }

    const host =
      containers[0]
        .parentElement;

    if (
      !host
    ) {
      return null;
    }

    countRow =
      document.createElement(
        "div"
      );

    countRow.setAttribute(
      RECORD_COUNT_ATTR,
      "true"
    );

    countRow.className =
      "popup-id-desc-container";

    countRow.style.cssText = [
      "display:flex",
      "align-items:center",
      "width:100%",
      "margin-top:4px",
      "margin-bottom:4px",
      "float:none",
      "clear:both"
    ].join(
      ";"
    );

    const label =
      document.createElement(
        "label"
      );

    label.textContent =
      "Records";

    label.style.cssText = [
      "margin:0",
      "min-width:75px",
      "font-weight:600"
    ].join(
      ";"
    );

    const value =
      document.createElement(
        "span"
      );

    value.setAttribute(
      RECORD_COUNT_VALUE_ATTR,
      "true"
    );

    countRow.appendChild(
      label
    );

    countRow.appendChild(
      value
    );

    host.appendChild(
      countRow
    );

    return countRow;
  }

  function updatePopupRecordCount(
    modal =
      getOpenModal()
  ) {

    if (
      !modal
    ) {
      return;
    }

    const countRow =
      ensurePopupRecordCount(
        modal
      );

    if (
      !countRow
    ) {
      return;
    }

    const valueEl =
      countRow.querySelector(
        `[${RECORD_COUNT_VALUE_ATTR}]`
      );

    if (
      !valueEl
    ) {
      return;
    }

    const total =
      getRows().length;

    valueEl.textContent =
      String(
        total
      );
  }

  /* =====================================================================
     GRID HELPERS
     ===================================================================== */

  function getWorkOrderGrid(
    modal
  ) {

    if (
      !modal
    ) {
      return null;
    }

    return modal.querySelector(
      ".dx-datagrid.dx-gridbase-container"
    );
  }

  function getWorkOrderGridParts(
    modal
  ) {

    const grid =
      getWorkOrderGrid(
        modal
      );

    if (
      !grid
    ) {

      return {
        grid:
          null,

        headerTable:
          null,

        dataTable:
          null,

        footerTable:
          null
      };
    }

    return {
      grid,

      headerTable:
        grid.querySelector(
          ".dx-datagrid-headers table.dx-datagrid-table"
        ),

      dataTable:
        grid.querySelector(
          ".dx-datagrid-rowsview table.dx-datagrid-table"
        ),

      footerTable:
        grid.querySelector(
          ".dx-datagrid-total-footer table.dx-datagrid-table"
        )
    };
  }

  function getHistoryGrid(
    modal
  ) {

    return getWorkOrderGrid(
      modal
    );
  }

  function getHistoryGridParts(
    modal
  ) {

    return getWorkOrderGridParts(
      modal
    );
  }

    /* =====================================================================
     CUSTOM COLGROUP HELPERS
     ===================================================================== */

  function ensureCustomColAfterIndex(
    table,
    attrName,
    afterIndex
  ) {

    if (
      !table
    ) {
      return;
    }

    const colgroup =
      table.querySelector(
        "colgroup"
      );

    if (
      !colgroup
    ) {
      return;
    }

    if (
      colgroup.querySelector(
        `[${attrName}]`
      )
    ) {
      return;
    }

    const cols =
      [
        ...colgroup.children
      ];

    const newCol =
      document.createElement(
        "col"
      );

    newCol.setAttribute(
      attrName,
      "true"
    );

    const reference =
      cols[
        afterIndex + 1
      ] ||
      null;

    if (
      reference
    ) {

      colgroup.insertBefore(
        newCol,
        reference
      );

    } else {

      colgroup.appendChild(
        newCol
      );
    }
  }

  function ensureLocationColgroup(
    table
  ) {

    ensureCustomColAfterIndex(
      table,
      LOCATION_COL_ATTR,
      3
    );
  }

  function ensureAssetColgroup(
    table,
    modal
  ) {

    if (
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    const colgroup =
      table?.querySelector(
        "colgroup"
      );

    if (
      !colgroup
    ) {
      return;
    }

    if (
      colgroup.querySelector(
        `[${ASSET_COL_ATTR}]`
      )
    ) {
      return;
    }

    const assetCol =
      document.createElement(
        "col"
      );

    assetCol.setAttribute(
      ASSET_COL_ATTR,
      "true"
    );

    const locationCol =
      colgroup.querySelector(
        `[${LOCATION_COL_ATTR}]`
      );

    if (
      locationCol
    ) {

      locationCol.insertAdjacentElement(
        "afterend",
        assetCol
      );

    } else {

      colgroup.appendChild(
        assetCol
      );
    }
  }

  function ensureWorkOrderTypeColgroup(
    table,
    modal
  ) {

    if (
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    const colgroup =
      table?.querySelector(
        "colgroup"
      );

    if (
      !colgroup
    ) {
      return;
    }

    if (
      colgroup.querySelector(
        `[${WKO_TYPE_COL_ATTR}]`
      )
    ) {
      return;
    }

    const typeCol =
      document.createElement(
        "col"
      );

    typeCol.setAttribute(
      WKO_TYPE_COL_ATTR,
      "true"
    );

    /*
      Open Work Orders native columns:

        0 Due
        1 ID#
        2 Description
        3 Status
        4 Priority

      Insert Type after Description.
    */

    const cols =
      [
        ...colgroup.children
      ];

    const reference =
      cols[3] ||
      null;

    if (
      reference
    ) {

      colgroup.insertBefore(
        typeCol,
        reference
      );

    } else {

      colgroup.appendChild(
        typeCol
      );
    }
  }

  /* =====================================================================
     WORK ORDER GRID ROW DETECTION
     ===================================================================== */

  function getWorkOrderDataRows(
    modal
  ) {

    const {
      dataTable
    } =
      getWorkOrderGridParts(
        modal
      );

    if (
      !dataTable
    ) {
      return [];
    }

    const dataRows =
      [
        ...dataTable.querySelectorAll(
          "tr.dx-data-row"
        )
      ];

    return dataRows
      .map(
        tr => {

          const link =
            [
              ...tr.querySelectorAll(
                "a"
              )
            ].find(
              a =>
                /WKO-\d+/i.test(
                  normalizeText(
                    a.innerText
                  )
                )
            );

          if (
            !link
          ) {
            return null;
          }

          const href =
            link.getAttribute(
              "href"
            ) ||
            "";

          const match =
            href.match(
              /WorkOrderRecords\/(\d+)/i
            );

          if (
            !match
          ) {
            return null;
          }

          const flagMatch =
            href.match(
              /[?&]Flag=([^&#]+)/i
            );

          return {
            tr,

            link,

            recordKey:
              Number(
                match[1]
              ),

            recordFlag:
              flagMatch
                ? decodeURIComponent(
                    flagMatch[1]
                  )
                : "",

            wkoCode:
              normalizeText(
                link.innerText
              )
          };
        }
      )
      .filter(
        Boolean
      );
  }

  function getHistoryDataRows(
    modal
  ) {

    return getWorkOrderDataRows(
      modal
    );
  }

  /* =====================================================================
     REPORT ROW LOOKUP
     ===================================================================== */

  function findHistoryRowByCode(
    wkoCode
  ) {

    return getRows().find(
      row =>
        normalizeText(
          row.HSTCODE
        ) ===
        normalizeText(
          wkoCode
        )
    );
  }

  function findOpenWorkOrderRowByCode(
    wkoCode
  ) {

    return getRows().find(
      row =>
        normalizeText(
          row.WKOCode
        ) ===
        normalizeText(
          wkoCode
        )
    );
  }

  /* =====================================================================
     GENERIC WORK ORDER DETAIL VALUES
     ===================================================================== */

  function getWorkOrderTypeFromDetail(
    data
  ) {

    const candidates = [
      data?.WorkOrderType?.Desc,
      data?.WorkOrderType?.Value,
      data?.HstWorkOrderType?.Desc,
      data?.HstWorkOrderType?.Value,
      data?.WKOTYPE
    ];

    for (
      const candidate of candidates
    ) {

      if (
        candidate === null ||
        candidate === undefined
      ) {
        continue;
      }

      /*
        Avoid rendering:
          [object Object]
      */

      if (
        typeof candidate ===
        "object"
      ) {
        continue;
      }

      const text =
        normalizeText(
          candidate
        );

      if (
        text &&
        text !==
        "[object Object]"
      ) {
        return text;
      }
    }

    return "";
  }

  function getLocationFromDetail(
    data
  ) {

    const direct =
      normalizeText(
        data?.Locations
      );

    if (
      direct
    ) {
      return direct;
    }

    const locations =
      [];

    function addLocation(
      value
    ) {

      const text =
        normalizeText(
          value
        );

      if (
        text &&
        !locations.includes(
          text
        )
      ) {

        locations.push(
          text
        );
      }
    }

    const currentAssets =
      data
        ?.ObjCurrentTask
        ?.AssetList;

    if (
      Array.isArray(
        currentAssets
      )
    ) {

      currentAssets.forEach(
        asset => {

          addLocation(
            asset
              ?.Location
              ?.Desc
          );

          addLocation(
            asset
              ?.Location
              ?.Value
          );

          addLocation(
            asset
              ?.HstLocation
              ?.Desc
          );
        }
      );
    }

    /*
      Historical fallback.
    */

    if (
      !locations.length
    ) {

      const tasks =
        data
          ?.ObjTaskList;

      if (
        Array.isArray(
          tasks
        )
      ) {

        tasks.forEach(
          task => {

            const assets =
              task
                ?.AssetList;

            if (
              !Array.isArray(
                assets
              )
            ) {
              return;
            }

            assets.forEach(
              asset => {

                addLocation(
                  asset
                    ?.Location
                    ?.Desc
                );

                addLocation(
                  asset
                    ?.Location
                    ?.Value
                );

                addLocation(
                  asset
                    ?.HstLocation
                    ?.Desc
                );
              }
            );
          }
        );
      }
    }

    return locations.join(
      ", "
    );
  }

  function saveLocationToReportRow(
    wkoCode,
    location
  ) {

    const type =
      getDatasetType(
        getRows()
      );

    const row =
      type ===
        "open_work_orders"
        ? findOpenWorkOrderRowByCode(
            wkoCode
          )
        : findHistoryRowByCode(
            wkoCode
          );

    if (
      row
    ) {

      row.__Location =
        location ||
        "";
    }
  }

  function saveWorkOrderTypeToReportRow(
    wkoCode,
    workOrderType
  ) {

    const row =
      findOpenWorkOrderRowByCode(
        wkoCode
      );

    if (
      row
    ) {

      row.__WorkOrderType =
        workOrderType ||
        "";
    }
  }

  /* =====================================================================
     INVENTORY -> SPECIFIC ASSET RELATIONSHIP
     ===================================================================== */

  function getInventoryAssetContext(
    data,
    inventoryId
  ) {

    if (
      !data ||
      !inventoryId
    ) {
      return null;
    }

    const inventoryUpper =
      String(
        inventoryId
      )
        .toUpperCase();

    const matches =
      [];

    function inventoryListContainsId(
      list
    ) {

      if (
        !Array.isArray(
          list
        )
      ) {
        return false;
      }

      try {

        return JSON.stringify(
          list
        )
          .toUpperCase()
          .includes(
            inventoryUpper
          );

      } catch (_) {

        return false;
      }
    }

    function inspectAsset(
      asset
    ) {

      if (
        !asset
      ) {
        return;
      }

      /*
        Only return the asset whose own
        ListOfInventory contains the current
        inventory record.
      */

      if (
        !inventoryListContainsId(
          asset.ListOfInventory
        )
      ) {
        return;
      }

      const assetId =
        normalizeText(
          asset.RecordId
        );

      const assetDescription =
        normalizeText(
          asset.RecordDescription
        );

      const location =
        normalizeText(
          asset
            ?.Location
            ?.Desc ||

          asset
            ?.Location
            ?.Value ||

          asset
            ?.HstLocation
            ?.Desc
        );

      const assetDisplay =
        [
          assetId,
          assetDescription
        ]
          .filter(
            Boolean
          )
          .join(
            " — "
          );

      if (
        !assetDisplay
      ) {
        return;
      }

      if (
        !matches.some(
          item =>
            item.assetDisplay ===
            assetDisplay
        )
      ) {

        matches.push({
          assetId,
          assetDescription,
          assetDisplay,
          location
        });
      }
    }

    /*
      Preferred source.
    */

    const currentAssets =
      data
        ?.ObjCurrentTask
        ?.AssetList;

    if (
      Array.isArray(
        currentAssets
      )
    ) {

      currentAssets.forEach(
        inspectAsset
      );
    }

    /*
      Historical fallback.
    */

    if (
      !matches.length
    ) {

      const tasks =
        data
          ?.ObjTaskList;

      if (
        Array.isArray(
          tasks
        )
      ) {

        tasks.forEach(
          task => {

            const assets =
              task
                ?.AssetList;

            if (
              Array.isArray(
                assets
              )
            ) {

              assets.forEach(
                inspectAsset
              );
            }
          }
        );
      }
    }

    if (
      !matches.length
    ) {
      return null;
    }

    return {
      matches,

      assetId:
        matches
          .map(
            item =>
              item.assetId
          )
          .filter(
            Boolean
          )
          .join(
            "; "
          ),

      assetDescription:
        matches
          .map(
            item =>
              item.assetDescription
          )
          .filter(
            Boolean
          )
          .join(
            "; "
          ),

      assetDisplay:
        matches
          .map(
            item =>
              item.assetDisplay
          )
          .filter(
            Boolean
          )
          .join(
            "; "
          ),

      location:
        matches
          .map(
            item =>
              item.location
          )
          .filter(
            Boolean
          )
          .filter(
            (
              value,
              index,
              array
            ) =>
              array.indexOf(
                value
              ) ===
              index
          )
          .join(
            ", "
          )
    };
  }

  function saveInventoryAssetContextToReportRow(
    wkoCode,
    data,
    modal
  ) {

    if (
      !isInventoryContext(
        modal
      )
    ) {
      return null;
    }

    const inventoryId =
      getCurrentInventoryId(
        modal
      );

    if (
      !inventoryId
    ) {
      return null;
    }

    const context =
      getInventoryAssetContext(
        data,
        inventoryId
      );

    const datasetType =
      getDatasetType(
        getRows()
      );

    const row =
      datasetType ===
        "open_work_orders"
        ? findOpenWorkOrderRowByCode(
            wkoCode
          )
        : findHistoryRowByCode(
            wkoCode
          );

    if (
      row
    ) {

      row.__AssetId =
        context
          ?.assetId ||
        "";

      row.__AssetDescription =
        context
          ?.assetDescription ||
        "";

      row.__AssetDisplay =
        context
          ?.assetDisplay ||
        "";

      /*
        For Inventory context the location
        belongs to the inventory-associated
        asset, not another asset on the WKO.
      */

      row.__Location =
        context
          ?.location ||
        "";
    }

    return context;
  }

    /* =====================================================================
     GENERIC MOREVIEW POPUP LAYOUT
     ===================================================================== */

  function optimizeMoreViewPopupLayout(
    modal
  ) {

    if (
      !modal
    ) {
      return;
    }

    const modalContent =
      modal.querySelector(
        ".modal-content"
      );

    const modalDialog =
      modalContent
        ?.parentElement;

    const modalBody =
      modal.querySelector(
        ".modal-body"
      );

    if (
      !modalContent ||
      !modalBody
    ) {
      return;
    }

    /*
      Leave the outer Bootstrap modal alone.
    */

    modal.style.width =
      "";

    modal.style.maxWidth =
      "";

    modal.style.left =
      "";

    modal.style.right =
      "";

    modal.style.transform =
      "";

    modal.style.marginLeft =
      "";

    modal.style.marginRight =
      "";

    /*
      Size and center the actual dialog.
    */

    if (
      modalDialog
    ) {

      modalDialog.style.width =
        "95vw";

      modalDialog.style.maxWidth =
        "1700px";

      modalDialog.style.marginLeft =
        "auto";

      modalDialog.style.marginRight =
        "auto";
    }

    modalContent.setAttribute(
      POPUP_LAYOUT_ATTR,
      "true"
    );

    modalContent.style.width =
      "100%";

    modalContent.style.maxWidth =
      "100%";

    modalContent.style.height =
      "min(88vh, 900px)";

    modalContent.style.maxHeight =
      "92vh";

    modalContent.style.marginLeft =
      "0";

    modalContent.style.marginRight =
      "0";

    modalContent.style.display =
      "flex";

    modalContent.style.flexDirection =
      "column";

    const modalHeader =
      modal.querySelector(
        ".modal-header"
      );

    if (
      modalHeader
    ) {

      modalHeader.style.flex =
        "0 0 auto";
    }

    modalBody.style.flex =
      "1 1 auto";

    modalBody.style.minHeight =
      "0";

    modalBody.style.width =
      "100%";

    modalBody.style.maxWidth =
      "100%";

    modalBody.style.overflow =
      "hidden";

    modalBody.style.display =
      "flex";

    modalBody.style.flexDirection =
      "column";

    const exportWrapper =
      modalBody.querySelector(
        "#" +
        WRAPPER_ID
      );

    if (
      exportWrapper
    ) {

      exportWrapper.style.flex =
        "0 0 auto";
    }

    const mainRow =
      [
        ...modalBody.children
      ].find(
        child =>
          child.classList
            ?.contains(
              "row"
            )
      ) ||
      modalBody.querySelector(
        ".row"
      );

    if (
      mainRow
    ) {

      mainRow.style.display =
        "flex";

      mainRow.style.flexDirection =
        "column";

      mainRow.style.flex =
        "1 1 auto";

      mainRow.style.minHeight =
        "0";

      mainRow.style.height =
        "auto";

      mainRow.style.width =
        "100%";

      mainRow.style.maxWidth =
        "100%";

      mainRow.style.marginLeft =
        "0";

      mainRow.style.marginRight =
        "0";
    }

    const idDesc =
      modalBody.querySelector(
        ".popup-id-desc-container"
      )
        ?.closest(
          ".col-md-12"
        );

    if (
      idDesc
    ) {

      idDesc.style.height =
        "auto";

      idDesc.style.flex =
        "0 0 auto";

      idDesc.style.minHeight =
        "0";

      idDesc.style.width =
        "100%";

      idDesc.style.maxWidth =
        "100%";
    }

    const dxRoot =
      modalBody.querySelector(
        '[dx-data-grid="items.controls.GridData"]'
      ) ||
      modalBody.querySelector(
        ".dx-datagrid"
      );

    const gridWrapper =
      dxRoot
        ?.closest(
          ".col-md-12"
        );

    if (
      gridWrapper
    ) {

      gridWrapper.style.height =
        "auto";

      gridWrapper.style.flex =
        "1 1 auto";

      gridWrapper.style.minHeight =
        "0";

      gridWrapper.style.width =
        "100%";

      gridWrapper.style.maxWidth =
        "100%";

      gridWrapper.style.display =
        "flex";

      gridWrapper.style.flexDirection =
        "column";
    }

    if (
      dxRoot
    ) {

      dxRoot.style.height =
        "100%";

      dxRoot.style.width =
        "100%";

      dxRoot.style.maxWidth =
        "100%";

      dxRoot.style.flex =
        "1 1 auto";

      dxRoot.style.minHeight =
        "250px";
    }

    const grid =
      getWorkOrderGrid(
        modal
      );

    if (
      grid
    ) {

      grid.style.width =
        "100%";

      grid.style.maxWidth =
        "100%";

      grid.style.height =
        "100%";

      grid.style.minHeight =
        "250px";
    }

    const rowsView =
      grid?.querySelector(
        ".dx-datagrid-rowsview"
      );

    if (
      rowsView
    ) {

      rowsView.style.flex =
        "1 1 auto";

      rowsView.style.minHeight =
        "0";
    }
  }

  /* =====================================================================
     GENERIC MOREVIEW RESIZE OBSERVER
     ===================================================================== */

  function attachMoreViewResizeObserver(
    modal
  ) {

    if (
      !modal ||
      typeof ResizeObserver ===
        "undefined"
    ) {
      return;
    }

    const modalContent =
      modal.querySelector(
        ".modal-content"
      );

    if (
      !modalContent
    ) {
      return;
    }

    if (
      modalContent
        .__mpulseMoreViewResizeObserver
    ) {
      return;
    }

    let scheduled =
      false;

    const resizeObserver =
      new ResizeObserver(
        function () {

          if (
            scheduled
          ) {
            return;
          }

          scheduled =
            true;

          requestAnimationFrame(
            function () {

              scheduled =
                false;

              optimizeMoreViewPopupLayout(
                modal
              );

              const rows =
                getRows();

              const datasetType =
                getDatasetType(
                  rows
                );

              const grid =
                getWorkOrderGrid(
                  modal
                );

              /*
                Repair Work Order History custom
                columns after DevExtreme redraw.
              */

              if (
                datasetType ===
                  "work_order_history" &&
                grid?.getAttribute(
                  HISTORY_ENRICHED_ATTR
                ) ===
                  "true"
              ) {

                repairHistoryLocationGrid(
                  modal
                );

                formatHistoryCostSummary(
                  modal
                );
              }

              /*
                Repair Inventory Open Work Order
                custom columns after redraw.
              */

              if (
                datasetType ===
                  "open_work_orders" &&
                isInventoryContext(
                  modal
                ) &&
                grid?.getAttribute(
                  OPEN_ENRICHED_ATTR
                ) ===
                  "true"
              ) {

                repairInventoryOpenWorkOrderGrid(
                  modal
                );
              }
            }
          );
        }
      );

    resizeObserver.observe(
      modalContent
    );

    modalContent
      .__mpulseMoreViewResizeObserver =
      resizeObserver;
  }

  /* =====================================================================
     TOTAL COST SUMMARY FORMAT
     ===================================================================== */

  function formatHistoryCostSummary(
    modal
  ) {

    if (
      !modal
    ) {
      return;
    }

    const rows =
      getRows();

    if (
      getDatasetType(
        rows
      ) !==
      "work_order_history"
    ) {
      return;
    }

    const {
      footerTable
    } =
      getHistoryGridParts(
        modal
      );

    if (
      !footerTable
    ) {
      return;
    }

    const summaries =
      [
        ...footerTable.querySelectorAll(
          ".dx-datagrid-summary-item"
        )
      ];

    summaries.forEach(
      el => {

        const text =
          normalizeText(
            el.textContent
          );

        const match =
          text.match(
            /^Sum:\s*\$?\s*(-?[\d,]+(?:\.\d+)?)/i
          );

        if (
          !match
        ) {
          return;
        }

        const value =
          Number(
            match[1]
              .replace(
                /,/g,
                ""
              )
          );

        if (
          Number.isNaN(
            value
          )
        ) {
          return;
        }

        el.textContent =
          "Sum: " +
          value.toLocaleString(
            undefined,
            {
              style:
                "currency",

              currency:
                "USD",

              minimumFractionDigits:
                2,

              maximumFractionDigits:
                2
            }
          );
      }
    );
  }

  /* =====================================================================
     LOAD FULL WORK ORDER
     ===================================================================== */

  function loadWorkOrderDetail(
    recordKey,
    recordFlag
  ) {

    if (
      detailCache[
        recordKey
      ]
    ) {

      return Promise.resolve(
        detailCache[
          recordKey
        ]
      );
    }

    const template =
      window.__MPULSE_FORMVIEW_TEMPLATE__;

    if (
      !template?.requestBody ||
      !template?.headers
    ) {

      return Promise.reject(
        new Error(
          "No WorkOrderRecords GetFormViewData template captured yet."
        )
      );
    }

    const body =
      JSON.parse(
        JSON.stringify(
          template.requestBody
        )
      );

    body.DataObject =
      body.DataObject ||
      {};

    body.DataObject.RecordKey =
      recordKey;

    /*
      History uses HST.

      Open Work Orders use the actual record
      flag from the WKO hyperlink whenever
      available.
    */

    const datasetType =
      getDatasetType(
        getRows()
      );

    body.DataObject.RecordFlag =
      datasetType ===
        "work_order_history"
        ? "HST"
        : (
            recordFlag ||
            template.requestBody
              ?.DataObject
              ?.RecordFlag ||
            ""
          );

    const now =
      new Date()
        .toISOString();

    body.DataObject.CurrentTime =
      now;

    body.CurrentClientDateTime =
      now;

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const xhr =
          new XMLHttpRequest();

        xhr.__mpulse_enrichment_request__ =
          true;

        xhr.open(
          template.method ||
            "POST",

          template.url ||
            "/Common/GetFormViewData",

          true
        );

        Object.entries(
          template.headers ||
          {}
        ).forEach(
          (
            [
              name,
              value
            ]
          ) => {

            try {

              xhr.setRequestHeader(
                name,
                value
              );

            } catch (err) {

              console.warn(
                "Could not set enrichment header:",
                name,
                err
              );
            }
          }
        );

        xhr.addEventListener(
          "load",
          function () {

            if (
              xhr.status < 200 ||
              xhr.status >= 300
            ) {

              reject(
                new Error(
                  `HTTP ${xhr.status}`
                )
              );

              return;
            }

            let data;

            try {

              data =
                JSON.parse(
                  xhr.responseText
                );

            } catch (_) {

              reject(
                new Error(
                  "Invalid JSON response"
                )
              );

              return;
            }

            detailCache[
              recordKey
            ] =
              data;

            resolve(
              data
            );
          }
        );

        xhr.addEventListener(
          "error",
          function () {

            reject(
              new Error(
                "XHR request failed"
              )
            );
          }
        );

        xhr.send(
          JSON.stringify(
            body
          )
        );
      }
    );
  }

  /* =====================================================================
     CONCURRENCY QUEUE
     ===================================================================== */

  async function runQueue(
    jobs,
    concurrency
  ) {

    let index = 0;

    async function worker() {

      while (
        index <
        jobs.length
      ) {

        const current =
          index++;

        try {

          await jobs[
            current
          ]();

        } catch (err) {

          console.warn(
            "Enrichment job failed:",
            err
          );
        }
      }
    }

    const workers =
      [];

    const count =
      Math.min(
        concurrency,
        jobs.length
      );

    for (
      let i = 0;
      i < count;
      i++
    ) {

      workers.push(
        worker()
      );
    }

    await Promise.all(
      workers
    );
  }

  /* =====================================================================
     LOCATION FILTER
     ===================================================================== */

  function applyLocationFilter(
    modal,
    value
  ) {

    const filterValue =
      normalizeText(
        value
      ).toLowerCase();

    const {
      grid,
      dataTable
    } =
      getWorkOrderGridParts(
        modal
      );

    if (
      !grid ||
      !dataTable
    ) {
      return;
    }

    grid.dataset.mpulseLocationFilter =
      filterValue;

    window.__MPULSE_LOCATION_FILTER_VALUE__ =
      filterValue;

    const rows =
      [
        ...dataTable.querySelectorAll(
          "tr.dx-data-row"
        )
      ];

    rows.forEach(
      tr => {

        const cell =
          tr.querySelector(
            `[${LOCATION_ATTR}]`
          );

        const location =
          normalizeText(
            cell?.innerText
          ).toLowerCase();

        const show =
          !filterValue ||
          location.includes(
            filterValue
          );

        tr.style.display =
          show
            ? ""
            : "none";
      }
    );
  }

  function getCurrentLocationFilter(
    modal
  ) {

    const grid =
      getWorkOrderGrid(
        modal
      );

    return (
      grid
        ?.dataset
        ?.mpulseLocationFilter ||
      window
        .__MPULSE_LOCATION_FILTER_VALUE__ ||
      ""
    );
  }

  /* =====================================================================
     CUSTOM CELL INSERTION HELPERS
     ===================================================================== */

  function insertCellAfter(
    tr,
    referenceCell,
    attrName
  ) {

    const cell =
      document.createElement(
        "td"
      );

    cell.setAttribute(
      attrName,
      "true"
    );

    cell.setAttribute(
      "role",
      "gridcell"
    );

    cell.style.textAlign =
      "left";

    if (
      referenceCell
    ) {

      referenceCell
        .insertAdjacentElement(
          "afterend",
          cell
        );

    } else {

      tr.appendChild(
        cell
      );
    }

    return cell;
  }

    /* =====================================================================
     INVENTORY OPEN WORK ORDER HEADER
     ===================================================================== */

  function addInventoryOpenColumnsToHeader(
    modal,
    headerTable
  ) {

    if (
      !headerTable ||
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    ensureWorkOrderTypeColgroup(
      headerTable,
      modal
    );

    ensureLocationColgroup(
      headerTable
    );

    ensureAssetColgroup(
      headerTable,
      modal
    );

    const headerRow =
      headerTable.querySelector(
        "tr.dx-header-row"
      );

    if (
      !headerRow
    ) {
      return;
    }

    /*
      Work Order Type after Description.
    */

    let typeHeader =
      headerRow.querySelector(
        `[${WKO_TYPE_ATTR}]`
      );

    if (
      !typeHeader
    ) {

      const nativeCells =
        [
          ...headerRow.children
        ];

      const descriptionCell =
        nativeCells[2] ||
        null;

      typeHeader =
        document.createElement(
          "td"
        );

      typeHeader.setAttribute(
        WKO_TYPE_ATTR,
        "true"
      );

      typeHeader.setAttribute(
        "role",
        "columnheader"
      );

      typeHeader.className =
        "dx-datagrid-action dx-cell-focus-disabled ui-resizable dx-datagrid-drag-action";

      typeHeader.innerHTML = `
        <div
          class="dx-column-indicators"
          role="presentation"
          style="float:right;"
        >
          <span class="dx-sort dx-sort-none"></span>
        </div>

        <div
          class="dx-datagrid-text-content dx-text-content-alignment-left"
          role="presentation"
        >
          Work Order Type
        </div>
      `;

      if (
        descriptionCell
      ) {

        descriptionCell
          .insertAdjacentElement(
            "afterend",
            typeHeader
          );

      } else {

        headerRow.appendChild(
          typeHeader
        );
      }
    }

    /*
      Location after Work Order Type.
    */

    let locationHeader =
      headerRow.querySelector(
        `[${LOCATION_ATTR}]`
      );

    if (
      !locationHeader
    ) {

      locationHeader =
        document.createElement(
          "td"
        );

      locationHeader.setAttribute(
        LOCATION_ATTR,
        "true"
      );

      locationHeader.setAttribute(
        "role",
        "columnheader"
      );

      locationHeader.className =
        "dx-datagrid-action dx-cell-focus-disabled ui-resizable dx-datagrid-drag-action";

      locationHeader.innerHTML = `
        <div
          class="dx-column-indicators"
          role="presentation"
          style="float:right;"
        >
          <span class="dx-sort dx-sort-none"></span>
        </div>

        <div
          class="dx-datagrid-text-content dx-text-content-alignment-left"
          role="presentation"
        >
          Location
        </div>
      `;

      typeHeader
        .insertAdjacentElement(
          "afterend",
          locationHeader
        );
    }

    /*
      Asset after Location.
    */

    if (
      !headerRow.querySelector(
        `[${ASSET_ATTR}]`
      )
    ) {

      const assetHeader =
        document.createElement(
          "td"
        );

      assetHeader.setAttribute(
        ASSET_ATTR,
        "true"
      );

      assetHeader.setAttribute(
        "role",
        "columnheader"
      );

      assetHeader.className =
        "dx-datagrid-action dx-cell-focus-disabled ui-resizable dx-datagrid-drag-action";

      assetHeader.innerHTML = `
        <div
          class="dx-column-indicators"
          role="presentation"
          style="float:right;"
        >
          <span class="dx-sort dx-sort-none"></span>
        </div>

        <div
          class="dx-datagrid-text-content dx-text-content-alignment-left"
          role="presentation"
        >
          Asset
        </div>
      `;

      locationHeader
        .insertAdjacentElement(
          "afterend",
          assetHeader
        );
    }

    /*
      Filter row structural cells.
    */

    const filterRow =
      headerTable.querySelector(
        "tr.dx-datagrid-filter-row"
      );

    if (
      !filterRow
    ) {
      return;
    }

    let typeFilter =
      filterRow.querySelector(
        `[${WKO_TYPE_ATTR}]`
      );

    if (
      !typeFilter
    ) {

      const cells =
        [
          ...filterRow.children
        ];

      const descriptionFilter =
        cells[2] ||
        null;

      typeFilter =
        document.createElement(
          "td"
        );

      typeFilter.setAttribute(
        WKO_TYPE_ATTR,
        "true"
      );

      typeFilter.className =
        "dx-editor-cell ui-resizable";

      typeFilter.setAttribute(
        "role",
        "gridcell"
      );

      if (
        descriptionFilter
      ) {

        descriptionFilter
          .insertAdjacentElement(
            "afterend",
            typeFilter
          );

      } else {

        filterRow.appendChild(
          typeFilter
        );
      }
    }

    let locationFilter =
      filterRow.querySelector(
        `[${LOCATION_ATTR}]`
      );

    if (
      !locationFilter
    ) {

      locationFilter =
        document.createElement(
          "td"
        );

      locationFilter.setAttribute(
        LOCATION_ATTR,
        "true"
      );

      locationFilter.className =
        "dx-editor-cell ui-resizable";

      locationFilter.setAttribute(
        "role",
        "gridcell"
      );

      locationFilter.innerHTML = `
        <div class="dx-editor-with-menu">

          <div class="dx-editor-container">

            <div
              class="dx-textbox dx-texteditor dx-editor-outlined dx-widget"
            >

              <div class="dx-texteditor-container">

                <input
                  ${LOCATION_FILTER_ATTR}="true"
                  autocomplete="off"
                  class="dx-texteditor-input"
                  type="text"
                  spellcheck="false"
                  tabindex="0"
                  role="textbox"
                >

                <div
                  class="dx-texteditor-buttons-container"
                ></div>

              </div>

            </div>

          </div>

        </div>
      `;

      typeFilter
        .insertAdjacentElement(
          "afterend",
          locationFilter
        );

      const input =
        locationFilter.querySelector(
          `[${LOCATION_FILTER_ATTR}]`
        );

      if (
        input
      ) {

        input.value =
          getCurrentLocationFilter(
            modal
          );

        input.addEventListener(
          "input",
          function () {

            applyLocationFilter(
              modal,
              input.value
            );
          }
        );

        input.addEventListener(
          "click",
          event =>
            event.stopPropagation()
        );
      }
    }

    if (
      !filterRow.querySelector(
        `[${ASSET_ATTR}]`
      )
    ) {

      const assetFilter =
        document.createElement(
          "td"
        );

      assetFilter.setAttribute(
        ASSET_ATTR,
        "true"
      );

      assetFilter.className =
        "dx-editor-cell ui-resizable";

      assetFilter.setAttribute(
        "role",
        "gridcell"
      );

      locationFilter
        .insertAdjacentElement(
          "afterend",
          assetFilter
        );
    }
  }

  /* =====================================================================
     INVENTORY OPEN WORK ORDER ROW CELLS
     ===================================================================== */

  function ensureInventoryOpenCellsOnDataRow(
    tr,
    modal
  ) {

    if (
      !tr ||
      !isInventoryContext(
        modal
      )
    ) {

      return {
        typeCell:
          null,

        locationCell:
          null,

        assetCell:
          null
      };
    }

    let typeCell =
      tr.querySelector(
        `[${WKO_TYPE_ATTR}]`
      );

    let locationCell =
      tr.querySelector(
        `[${LOCATION_ATTR}]`
      );

    let assetCell =
      tr.querySelector(
        `[${ASSET_ATTR}]`
      );

    /*
      Native Open WKO order:

        0 Due
        1 ID#
        2 Description
        3 Status
        4 Priority

      Custom columns are inserted after
      Description.
    */

    if (
      !typeCell
    ) {

      const cells =
        [
          ...tr.children
        ];

      const descriptionCell =
        cells[2] ||
        null;

      typeCell =
        insertCellAfter(
          tr,
          descriptionCell,
          WKO_TYPE_ATTR
        );
    }

    if (
      !locationCell
    ) {

      locationCell =
        insertCellAfter(
          tr,
          typeCell,
          LOCATION_ATTR
        );
    }

    if (
      !assetCell
    ) {

      assetCell =
        insertCellAfter(
          tr,
          locationCell,
          ASSET_ATTR
        );
    }

    return {
      typeCell,
      locationCell,
      assetCell
    };
  }

  /* =====================================================================
     INVENTORY OPEN WORK ORDER FREESPACE / FOOTER
     ===================================================================== */

  function addInventoryOpenColumnsToFreeSpace(
    dataTable,
    modal
  ) {

    if (
      !dataTable ||
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    ensureWorkOrderTypeColgroup(
      dataTable,
      modal
    );

    ensureLocationColgroup(
      dataTable
    );

    ensureAssetColgroup(
      dataTable,
      modal
    );

    const freeRows =
      [
        ...dataTable.querySelectorAll(
          "tr.dx-freespace-row"
        )
      ];

    freeRows.forEach(
      tr => {

        let typeCell =
          tr.querySelector(
            `[${WKO_TYPE_ATTR}]`
          );

        let locationCell =
          tr.querySelector(
            `[${LOCATION_ATTR}]`
          );

        let assetCell =
          tr.querySelector(
            `[${ASSET_ATTR}]`
          );

        if (
          !typeCell
        ) {

          const cells =
            [
              ...tr.children
            ];

          const descriptionCell =
            cells[2] ||
            null;

          typeCell =
            insertCellAfter(
              tr,
              descriptionCell,
              WKO_TYPE_ATTR
            );
        }

        if (
          !locationCell
        ) {

          locationCell =
            insertCellAfter(
              tr,
              typeCell,
              LOCATION_ATTR
            );
        }

        if (
          !assetCell
        ) {

          assetCell =
            insertCellAfter(
              tr,
              locationCell,
              ASSET_ATTR
            );
        }
      }
    );
  }

  function addInventoryOpenColumnsToFooter(
    footerTable,
    modal
  ) {

    if (
      !footerTable ||
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    ensureWorkOrderTypeColgroup(
      footerTable,
      modal
    );

    ensureLocationColgroup(
      footerTable
    );

    ensureAssetColgroup(
      footerTable,
      modal
    );

    const footerRow =
      footerTable.querySelector(
        "tr"
      );

    if (
      !footerRow
    ) {
      return;
    }

    let typeCell =
      footerRow.querySelector(
        `[${WKO_TYPE_ATTR}]`
      );

    let locationCell =
      footerRow.querySelector(
        `[${LOCATION_ATTR}]`
      );

    let assetCell =
      footerRow.querySelector(
        `[${ASSET_ATTR}]`
      );

    if (
      !typeCell
    ) {

      const cells =
        [
          ...footerRow.children
        ];

      const descriptionCell =
        cells[2] ||
        null;

      typeCell =
        insertCellAfter(
          footerRow,
          descriptionCell,
          WKO_TYPE_ATTR
        );
    }

    if (
      !locationCell
    ) {

      locationCell =
        insertCellAfter(
          footerRow,
          typeCell,
          LOCATION_ATTR
        );
    }

    if (
      !assetCell
    ) {

      assetCell =
        insertCellAfter(
          footerRow,
          locationCell,
          ASSET_ATTR
        );
    }
  }

  function addInventoryOpenColumnsToGrid(
    modal
  ) {

    const {
      headerTable,
      dataTable,
      footerTable
    } =
      getWorkOrderGridParts(
        modal
      );

    addInventoryOpenColumnsToHeader(
      modal,
      headerTable
    );

    addInventoryOpenColumnsToFreeSpace(
      dataTable,
      modal
    );

    addInventoryOpenColumnsToFooter(
      footerTable,
      modal
    );
  }

  /* =====================================================================
     INVENTORY OPEN WORK ORDER ENRICHMENT
     ===================================================================== */

  async function enrichInventoryOpenWorkOrders(
    modal
  ) {

    const rows =
      getRows();

    if (
      getDatasetType(
        rows
      ) !==
        "open_work_orders" ||
      !isInventoryContext(
        modal
      )
    ) {
      return false;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    attachMoreViewResizeObserver(
      modal
    );

    const {
      grid,
      dataTable
    } =
      getWorkOrderGridParts(
        modal
      );

    if (
      !grid ||
      !dataTable
    ) {
      return false;
    }

    addInventoryOpenColumnsToGrid(
      modal
    );

    const workOrderRows =
      getWorkOrderDataRows(
        modal
      );

    if (
      !workOrderRows.length
    ) {
      return false;
    }

    console.log(
      `Enriching ${workOrderRows.length} Inventory Open Work Order rows.`
    );

    const jobs =
      [];

    workOrderRows.forEach(
      info => {

        const {
          typeCell,
          locationCell,
          assetCell
        } =
          ensureInventoryOpenCellsOnDataRow(
            info.tr,
            modal
          );

        const cached =
          detailCache[
            info.recordKey
          ];

        if (
          cached
        ) {

          const workOrderType =
            getWorkOrderTypeFromDetail(
              cached
            );

          const context =
            saveInventoryAssetContextToReportRow(
              info.wkoCode,
              cached,
              modal
            );

          saveWorkOrderTypeToReportRow(
            info.wkoCode,
            workOrderType
          );

          typeCell.textContent =
            workOrderType ||
            "—";

          locationCell.textContent =
            context?.location ||
            "—";

          assetCell.textContent =
            context?.assetDisplay ||
            "—";

          return;
        }

        if (
          typeCell
            .dataset
            .mpulseLoading ===
          "true"
        ) {
          return;
        }

        typeCell
          .dataset
          .mpulseLoading =
          "true";

        typeCell.textContent =
          "Loading...";

        locationCell.textContent =
          "Loading...";

        assetCell.textContent =
          "Loading...";

        jobs.push(
          async function () {

            try {

              const data =
                await loadWorkOrderDetail(
                  info.recordKey,
                  info.recordFlag
                );

              const workOrderType =
                getWorkOrderTypeFromDetail(
                  data
                );

              const context =
                saveInventoryAssetContextToReportRow(
                  info.wkoCode,
                  data,
                  modal
                );

              saveWorkOrderTypeToReportRow(
                info.wkoCode,
                workOrderType
              );

              typeCell.textContent =
                workOrderType ||
                "—";

              locationCell.textContent =
                context?.location ||
                "—";

              assetCell.textContent =
                context?.assetDisplay ||
                "—";

            } catch (err) {

              typeCell.textContent =
                "—";

              locationCell.textContent =
                "—";

              assetCell.textContent =
                "—";

              console.warn(
                `Could not enrich open WKO ${info.wkoCode}:`,
                err
              );

            } finally {

              delete typeCell
                .dataset
                .mpulseLoading;
            }
          }
        );
      }
    );

    if (
      jobs.length
    ) {

      console.log(
        `Loading details for ${jobs.length} Inventory Open Work Orders...`
      );

      await runQueue(
        jobs,
        DETAIL_CONCURRENCY
      );
    }

    applyLocationFilter(
      modal,
      getCurrentLocationFilter(
        modal
      )
    );

    updateColumnButtonLabel();

    console.log(
      "Inventory Open Work Order enrichment complete."
    );

    return true;
  }

  /* =====================================================================
     REPAIR INVENTORY OPEN WORK ORDERS AFTER REDRAW
     ===================================================================== */

  function repairInventoryOpenWorkOrderGrid(
    modal
  ) {

    const rows =
      getRows();

    if (
      getDatasetType(
        rows
      ) !==
        "open_work_orders" ||
      !isInventoryContext(
        modal
      )
    ) {
      return;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    const {
      grid,
      headerTable,
      dataTable,
      footerTable
    } =
      getWorkOrderGridParts(
        modal
      );

    if (
      !grid ||
      !headerTable ||
      !dataTable
    ) {
      return;
    }

    addInventoryOpenColumnsToHeader(
      modal,
      headerTable
    );

    addInventoryOpenColumnsToFreeSpace(
      dataTable,
      modal
    );

    addInventoryOpenColumnsToFooter(
      footerTable,
      modal
    );

    const workOrderRows =
      getWorkOrderDataRows(
        modal
      );

    const missingJobs =
      [];

    workOrderRows.forEach(
      info => {

        const {
          typeCell,
          locationCell,
          assetCell
        } =
          ensureInventoryOpenCellsOnDataRow(
            info.tr,
            modal
          );

        const cached =
          detailCache[
            info.recordKey
          ];

        if (
          cached
        ) {

          const workOrderType =
            getWorkOrderTypeFromDetail(
              cached
            );

          const context =
            saveInventoryAssetContextToReportRow(
              info.wkoCode,
              cached,
              modal
            );

          saveWorkOrderTypeToReportRow(
            info.wkoCode,
            workOrderType
          );

          typeCell.textContent =
            workOrderType ||
            "—";

          locationCell.textContent =
            context?.location ||
            "—";

          assetCell.textContent =
            context?.assetDisplay ||
            "—";

          return;
        }

        const reportRow =
          findOpenWorkOrderRowByCode(
            info.wkoCode
          );

        const savedType =
          normalizeText(
            reportRow
              ?.__WorkOrderType
          );

        const savedLocation =
          normalizeText(
            reportRow
              ?.__Location
          );

        const savedAsset =
          normalizeText(
            reportRow
              ?.__AssetDisplay
          );

        if (
          savedType
        ) {

          typeCell.textContent =
            savedType;
        }

        if (
          savedLocation
        ) {

          locationCell.textContent =
            savedLocation;
        }

        if (
          savedAsset
        ) {

          assetCell.textContent =
            savedAsset;
        }

                const needsType =
          !savedType;

        const needsLocation =
          !savedLocation;

        const needsAsset =
          !savedAsset;

        if (
          !needsType &&
          !needsLocation &&
          !needsAsset
        ) {
          return;
        }

        if (
          typeCell
            .dataset
            .mpulseLoading ===
          "true"
        ) {
          return;
        }

        typeCell
          .dataset
          .mpulseLoading =
          "true";

        if (
          needsType
        ) {

          typeCell.textContent =
            "Loading...";
        }

        if (
          needsLocation
        ) {

          locationCell.textContent =
            "Loading...";
        }

        if (
          needsAsset
        ) {

          assetCell.textContent =
            "Loading...";
        }

        missingJobs.push(
          async function () {

            try {

              const data =
                await loadWorkOrderDetail(
                  info.recordKey,
                  info.recordFlag
                );

              const workOrderType =
                getWorkOrderTypeFromDetail(
                  data
                );

              const context =
                saveInventoryAssetContextToReportRow(
                  info.wkoCode,
                  data,
                  modal
                );

              saveWorkOrderTypeToReportRow(
                info.wkoCode,
                workOrderType
              );

              typeCell.textContent =
                workOrderType ||
                "—";

              locationCell.textContent =
                context?.location ||
                "—";

              assetCell.textContent =
                context?.assetDisplay ||
                "—";

              console.log(
                "Late-rendered Inventory Open WKO enriched:",
                info.wkoCode
              );

            } catch (err) {

              if (
                needsType
              ) {

                typeCell.textContent =
                  "—";
              }

              if (
                needsLocation
              ) {

                locationCell.textContent =
                  "—";
              }

              if (
                needsAsset
              ) {

                assetCell.textContent =
                  "—";
              }

              console.warn(
                `Could not enrich late-rendered open WKO ${info.wkoCode}:`,
                err
              );

            } finally {

              delete typeCell
                .dataset
                .mpulseLoading;
            }
          }
        );
      }
    );

    if (
      missingJobs.length
    ) {

      runQueue(
        missingJobs,
        DETAIL_CONCURRENCY
      )
        .then(
          () => {

            applyLocationFilter(
              modal,
              getCurrentLocationFilter(
                modal
              )
            );

            console.log(
              `Loaded ${missingJobs.length} late-rendered Inventory Open Work Orders.`
            );
          }
        )
        .catch(
          err => {

            console.warn(
              "Inventory Open WKO repair queue failed:",
              err
            );
          }
        );

    } else {

      applyLocationFilter(
        modal,
        getCurrentLocationFilter(
          modal
        )
      );
    }
  }

  /* =====================================================================
     WORK ORDER HISTORY HEADER
     ===================================================================== */

  function addLocationColumnToHeader(
    modal,
    headerTable
  ) {

    if (
      !headerTable
    ) {
      return;
    }

    ensureLocationColgroup(
      headerTable
    );

    ensureAssetColgroup(
      headerTable,
      modal
    );

    const headerRow =
      headerTable.querySelector(
        "tr.dx-header-row"
      );

    if (
      headerRow &&
      !headerRow.querySelector(
        `[${LOCATION_ATTR}]`
      )
    ) {

      const cells =
        [
          ...headerRow.children
        ];

      const referenceCell =
        cells[4] ||
        null;

      const locationHeader =
        document.createElement(
          "td"
        );

      locationHeader.setAttribute(
        LOCATION_ATTR,
        "true"
      );

      locationHeader.setAttribute(
        "role",
        "columnheader"
      );

      locationHeader.className =
        "dx-datagrid-action dx-cell-focus-disabled ui-resizable dx-datagrid-drag-action";

      locationHeader.style.textAlign =
        "left";

      locationHeader.innerHTML = `
        <div
          class="dx-column-indicators"
          role="presentation"
          style="float:right;"
        >
          <span class="dx-sort dx-sort-none"></span>
        </div>

        <div
          class="dx-datagrid-text-content dx-text-content-alignment-left"
          role="presentation"
        >
          Location
        </div>
      `;

      if (
        referenceCell
      ) {

        headerRow.insertBefore(
          locationHeader,
          referenceCell
        );

      } else {

        headerRow.appendChild(
          locationHeader
        );
      }
    }

    /*
      Inventory Work Order History:
      Asset after Location.
    */

    if (
      headerRow &&
      isInventoryContext(
        modal
      ) &&
      !headerRow.querySelector(
        `[${ASSET_ATTR}]`
      )
    ) {

      const assetHeader =
        document.createElement(
          "td"
        );

      assetHeader.setAttribute(
        ASSET_ATTR,
        "true"
      );

      assetHeader.setAttribute(
        "role",
        "columnheader"
      );

      assetHeader.className =
        "dx-datagrid-action dx-cell-focus-disabled ui-resizable dx-datagrid-drag-action";

      assetHeader.style.textAlign =
        "left";

      assetHeader.innerHTML = `
        <div
          class="dx-column-indicators"
          role="presentation"
          style="float:right;"
        >
          <span class="dx-sort dx-sort-none"></span>
        </div>

        <div
          class="dx-datagrid-text-content dx-text-content-alignment-left"
          role="presentation"
        >
          Asset
        </div>
      `;

      const locationHeader =
        headerRow.querySelector(
          `[${LOCATION_ATTR}]`
        );

      if (
        locationHeader
      ) {

        locationHeader
          .insertAdjacentElement(
            "afterend",
            assetHeader
          );

      } else {

        headerRow.appendChild(
          assetHeader
        );
      }
    }

    /* =================================================================
       HISTORY FILTER ROW
       ================================================================= */

    const filterRow =
      headerTable.querySelector(
        "tr.dx-datagrid-filter-row"
      );

    if (
      filterRow &&
      !filterRow.querySelector(
        `[${LOCATION_FILTER_ATTR}]`
      )
    ) {

      const cells =
        [
          ...filterRow.children
        ];

      const referenceCell =
        cells[4] ||
        null;

      const locationFilterCell =
        document.createElement(
          "td"
        );

      locationFilterCell.setAttribute(
        LOCATION_ATTR,
        "true"
      );

      locationFilterCell.className =
        "dx-editor-cell ui-resizable";

      locationFilterCell.setAttribute(
        "role",
        "gridcell"
      );

      locationFilterCell.innerHTML = `
        <div class="dx-editor-with-menu">

          <div class="dx-editor-container">

            <div
              class="dx-textbox dx-texteditor dx-editor-outlined dx-widget"
            >

              <div class="dx-texteditor-container">

                <input
                  ${LOCATION_FILTER_ATTR}="true"
                  autocomplete="off"
                  class="dx-texteditor-input"
                  type="text"
                  spellcheck="false"
                  tabindex="0"
                  role="textbox"
                >

                <div
                  class="dx-texteditor-buttons-container"
                ></div>

              </div>

            </div>

          </div>

        </div>
      `;

      const input =
        locationFilterCell.querySelector(
          `[${LOCATION_FILTER_ATTR}]`
        );

      if (
        input
      ) {

        input.value =
          getCurrentLocationFilter(
            modal
          );

        input.addEventListener(
          "input",
          function () {

            applyLocationFilter(
              modal,
              input.value
            );
          }
        );

        input.addEventListener(
          "click",
          event =>
            event.stopPropagation()
        );
      }

      if (
        referenceCell
      ) {

        filterRow.insertBefore(
          locationFilterCell,
          referenceCell
        );

      } else {

        filterRow.appendChild(
          locationFilterCell
        );
      }
    }

    /*
      Inventory history Asset filter spacer.
    */

    if (
      filterRow &&
      isInventoryContext(
        modal
      ) &&
      !filterRow.querySelector(
        `[${ASSET_ATTR}]`
      )
    ) {

      const assetFilterCell =
        document.createElement(
          "td"
        );

      assetFilterCell.setAttribute(
        ASSET_ATTR,
        "true"
      );

      assetFilterCell.className =
        "dx-editor-cell ui-resizable";

      assetFilterCell.setAttribute(
        "role",
        "gridcell"
      );

      const locationFilter =
        filterRow.querySelector(
          `[${LOCATION_ATTR}]`
        );

      if (
        locationFilter
      ) {

        locationFilter
          .insertAdjacentElement(
            "afterend",
            assetFilterCell
          );

      } else {

        filterRow.appendChild(
          assetFilterCell
        );
      }
    }
  }

  /* =====================================================================
     HISTORY DATA ROW CELLS
     ===================================================================== */

  function ensureLocationCellOnDataRow(
    tr
  ) {

    let locationCell =
      tr.querySelector(
        `[${LOCATION_ATTR}]`
      );

    if (
      locationCell
    ) {
      return locationCell;
    }

    const cells =
      [
        ...tr.children
      ];

    const referenceCell =
      cells[4] ||
      null;

    locationCell =
      document.createElement(
        "td"
      );

    locationCell.setAttribute(
      LOCATION_ATTR,
      "true"
    );

    locationCell.setAttribute(
      "role",
      "gridcell"
    );

    locationCell.style.textAlign =
      "left";

    if (
      referenceCell
    ) {

      tr.insertBefore(
        locationCell,
        referenceCell
      );

    } else {

      tr.appendChild(
        locationCell
      );
    }

    return locationCell;
  }

  function ensureAssetCellOnDataRow(
    tr,
    modal
  ) {

    if (
      !isInventoryContext(
        modal
      )
    ) {
      return null;
    }

    let assetCell =
      tr.querySelector(
        `[${ASSET_ATTR}]`
      );

    if (
      assetCell
    ) {
      return assetCell;
    }

    assetCell =
      document.createElement(
        "td"
      );

    assetCell.setAttribute(
      ASSET_ATTR,
      "true"
    );

    assetCell.setAttribute(
      "role",
      "gridcell"
    );

    assetCell.style.textAlign =
      "left";

    const locationCell =
      tr.querySelector(
        `[${LOCATION_ATTR}]`
      );

    if (
      locationCell
    ) {

      locationCell
        .insertAdjacentElement(
          "afterend",
          assetCell
        );

    } else {

      tr.appendChild(
        assetCell
      );
    }

    return assetCell;
  }

  /* =====================================================================
     HISTORY FREESPACE / FOOTER
     ===================================================================== */

  function addLocationCellToFreeSpace(
    dataTable,
    modal
  ) {

    if (
      !dataTable
    ) {
      return;
    }

    ensureLocationColgroup(
      dataTable
    );

    ensureAssetColgroup(
      dataTable,
      modal
    );

    const freeRows =
      [
        ...dataTable.querySelectorAll(
          "tr.dx-freespace-row"
        )
      ];

    freeRows.forEach(
      tr => {

        let locationCell =
          tr.querySelector(
            `[${LOCATION_ATTR}]`
          );

        if (
          !locationCell
        ) {

          const cells =
            [
              ...tr.children
            ];

          const referenceCell =
            cells[4] ||
            null;

          locationCell =
            document.createElement(
              "td"
            );

          locationCell.setAttribute(
            LOCATION_ATTR,
            "true"
          );

          if (
            referenceCell
          ) {

            tr.insertBefore(
              locationCell,
              referenceCell
            );

          } else {

            tr.appendChild(
              locationCell
            );
          }
        }

        if (
          isInventoryContext(
            modal
          ) &&
          !tr.querySelector(
            `[${ASSET_ATTR}]`
          )
        ) {

          const assetCell =
            document.createElement(
              "td"
            );

          assetCell.setAttribute(
            ASSET_ATTR,
            "true"
          );

          locationCell
            .insertAdjacentElement(
              "afterend",
              assetCell
            );
        }
      }
    );
  }

  function addLocationColumnToFooter(
    footerTable,
    modal
  ) {

    if (
      !footerTable
    ) {
      return;
    }

    ensureLocationColgroup(
      footerTable
    );

    ensureAssetColgroup(
      footerTable,
      modal
    );

    const footerRow =
      footerTable.querySelector(
        "tr"
      );

    if (
      !footerRow
    ) {
      return;
    }

    let locationCell =
      footerRow.querySelector(
        `[${LOCATION_ATTR}]`
      );

    if (
      !locationCell
    ) {

      const cells =
        [
          ...footerRow.children
        ];

      const referenceCell =
        cells[4] ||
        null;

      locationCell =
        document.createElement(
          "td"
        );

      locationCell.setAttribute(
        LOCATION_ATTR,
        "true"
      );

      locationCell.setAttribute(
        "role",
        "gridcell"
      );

      if (
        referenceCell
      ) {

        footerRow.insertBefore(
          locationCell,
          referenceCell
        );

      } else {

        footerRow.appendChild(
          locationCell
        );
      }
    }

    if (
      isInventoryContext(
        modal
      ) &&
      !footerRow.querySelector(
        `[${ASSET_ATTR}]`
      )
    ) {

      const assetCell =
        document.createElement(
          "td"
        );

      assetCell.setAttribute(
        ASSET_ATTR,
        "true"
      );

      assetCell.setAttribute(
        "role",
        "gridcell"
      );

      locationCell
        .insertAdjacentElement(
          "afterend",
          assetCell
        );
    }
  }

  function addLocationColumnToGrid(
    modal
  ) {

    const {
      headerTable,
      dataTable,
      footerTable
    } =
      getHistoryGridParts(
        modal
      );

    addLocationColumnToHeader(
      modal,
      headerTable
    );

    addLocationCellToFreeSpace(
      dataTable,
      modal
    );

    addLocationColumnToFooter(
      footerTable,
      modal
    );
  }

  /* =====================================================================
     HISTORY ENRICHMENT
     ===================================================================== */

  async function enrichHistoryPopup(
    modal
  ) {

    const rows =
      getRows();

    if (
      getDatasetType(
        rows
      ) !==
      "work_order_history"
    ) {
      return false;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    attachMoreViewResizeObserver(
      modal
    );

    const {
      grid,
      dataTable
    } =
      getHistoryGridParts(
        modal
      );

    if (
      !grid ||
      !dataTable
    ) {
      return false;
    }

    addLocationColumnToGrid(
      modal
    );

    const historyRows =
      getHistoryDataRows(
        modal
      );

    if (
      !historyRows.length
    ) {
      return false;
    }

    console.log(
      `Enriching ${historyRows.length} rendered Work Order History rows.`
    );

    const jobs =
      [];

    historyRows.forEach(
      info => {

        const locationCell =
          ensureLocationCellOnDataRow(
            info.tr
          );

        const assetCell =
          ensureAssetCellOnDataRow(
            info.tr,
            modal
          );

        const cached =
          detailCache[
            info.recordKey
          ];

        if (
          cached
        ) {

          let location =
            getLocationFromDetail(
              cached
            );

          if (
            isInventoryContext(
              modal
            )
          ) {

            const context =
              saveInventoryAssetContextToReportRow(
                info.wkoCode,
                cached,
                modal
              );

            location =
              context?.location ||
              "";

            if (
              assetCell
            ) {

              assetCell.textContent =
                context?.assetDisplay ||
                "—";
            }

          } else {

            saveLocationToReportRow(
              info.wkoCode,
              location
            );
          }

          locationCell.textContent =
            location ||
            "—";

          return;
        }

        if (
          locationCell
            .dataset
            .mpulseLoading ===
          "true"
        ) {
          return;
        }

        locationCell
          .dataset
          .mpulseLoading =
          "true";

        locationCell.textContent =
          "Loading...";

        if (
          assetCell
        ) {

          assetCell.textContent =
            "Loading...";
        }

        jobs.push(
          async function () {

            try {

              const data =
                await loadWorkOrderDetail(
                  info.recordKey
                );

              let location =
                getLocationFromDetail(
                  data
                );

              if (
                isInventoryContext(
                  modal
                )
              ) {

                const context =
                  saveInventoryAssetContextToReportRow(
                    info.wkoCode,
                    data,
                    modal
                  );

                location =
                  context?.location ||
                  "";

                if (
                  assetCell
                ) {

                  assetCell.textContent =
                    context?.assetDisplay ||
                    "—";
                }

              } else {

                saveLocationToReportRow(
                  info.wkoCode,
                  location
                );
              }

              locationCell.textContent =
                location ||
                "—";

            } catch (err) {

              locationCell.textContent =
                "—";

              if (
                assetCell
              ) {

                assetCell.textContent =
                  "—";
              }

              console.warn(
                `Could not enrich ${info.wkoCode}:`,
                err
              );

            } finally {

              delete locationCell
                .dataset
                .mpulseLoading;
            }
          }
        );
      }
    );

    if (
      jobs.length
    ) {

      await runQueue(
        jobs,
        DETAIL_CONCURRENCY
      );
    }

    applyLocationFilter(
      modal,
      getCurrentLocationFilter(
        modal
      )
    );

    formatHistoryCostSummary(
      modal
    );

    updateColumnButtonLabel();

    console.log(
      "Work Order History enrichment complete."
    );

    return true;
  }

  /* =====================================================================
     HISTORY REPAIR AFTER DEVEXTREME REDRAW
     ===================================================================== */

  function repairHistoryLocationGrid(
    modal
  ) {

    const rows =
      getRows();

    if (
      getDatasetType(
        rows
      ) !==
      "work_order_history"
    ) {
      return;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    const {
      grid,
      headerTable,
      dataTable,
      footerTable
    } =
      getHistoryGridParts(
        modal
      );

    if (
      !grid ||
      !headerTable ||
      !dataTable
    ) {
      return;
    }

    addLocationColumnToHeader(
      modal,
      headerTable
    );

    addLocationCellToFreeSpace(
      dataTable,
      modal
    );

    addLocationColumnToFooter(
      footerTable,
      modal
    );

    const historyRows =
      getHistoryDataRows(
        modal
      );

    const missingJobs =
      [];

    historyRows.forEach(
      info => {

        const locationCell =
          ensureLocationCellOnDataRow(
            info.tr
          );

        const assetCell =
          ensureAssetCellOnDataRow(
            info.tr,
            modal
          );

        const cached =
          detailCache[
            info.recordKey
          ];

        if (
          cached
        ) {

          let location =
            getLocationFromDetail(
              cached
            );

          if (
            isInventoryContext(
              modal
            )
          ) {

            const context =
              saveInventoryAssetContextToReportRow(
                info.wkoCode,
                cached,
                modal
              );

            location =
              context?.location ||
              "";

            if (
              assetCell
            ) {

              assetCell.textContent =
                context?.assetDisplay ||
                "—";
            }

          } else {

            saveLocationToReportRow(
              info.wkoCode,
              location
            );
          }

          locationCell.textContent =
            location ||
            "—";

          return;
        }

        const reportRow =
          findHistoryRowByCode(
            info.wkoCode
          );

        const savedLocation =
          normalizeText(
            reportRow
              ?.__Location
          );

        const savedAsset =
          normalizeText(
            reportRow
              ?.__AssetDisplay
          );

        if (
          savedLocation
        ) {

          locationCell.textContent =
            savedLocation;
        }

        if (
          assetCell &&
          savedAsset
        ) {

          assetCell.textContent =
            savedAsset;
        }

        const needsLocation =
          !savedLocation;

        const needsAsset =
          !!assetCell &&
          !savedAsset;

        if (
          !needsLocation &&
          !needsAsset
        ) {
          return;
        }

        if (
          locationCell
            .dataset
            .mpulseLoading ===
          "true"
        ) {
          return;
        }

        locationCell
          .dataset
          .mpulseLoading =
          "true";

        if (
          needsLocation
        ) {

          locationCell.textContent =
            "Loading...";
        }

        if (
          assetCell &&
          needsAsset
        ) {

          assetCell.textContent =
            "Loading...";
        }

        missingJobs.push(
          async function () {

            try {

              const data =
                await loadWorkOrderDetail(
                  info.recordKey
                );

              let location =
                getLocationFromDetail(
                  data
                );

              if (
                isInventoryContext(
                  modal
                )
              ) {

                const context =
                  saveInventoryAssetContextToReportRow(
                    info.wkoCode,
                    data,
                    modal
                  );

                location =
                  context?.location ||
                  "";

                if (
                  assetCell
                ) {

                  assetCell.textContent =
                    context?.assetDisplay ||
                    "—";
                }

              } else {

                saveLocationToReportRow(
                  info.wkoCode,
                  location
                );
              }

              locationCell.textContent =
                location ||
                "—";

            } catch (err) {

              if (
                needsLocation
              ) {

                locationCell.textContent =
                  "—";
              }

              if (
                assetCell &&
                needsAsset
              ) {

                assetCell.textContent =
                  "—";
              }

              console.warn(
                `Could not enrich late-rendered ${info.wkoCode}:`,
                err
              );

            } finally {

              delete locationCell
                .dataset
                .mpulseLoading;
            }
          }
        );
      }
    );

    if (
      missingJobs.length
    ) {

      runQueue(
        missingJobs,
        DETAIL_CONCURRENCY
      )
        .then(
          () => {

            applyLocationFilter(
              modal,
              getCurrentLocationFilter(
                modal
              )
            );

            formatHistoryCostSummary(
              modal
            );
          }
        )
        .catch(
          err => {

            console.warn(
              "History repair queue failed:",
              err
            );
          }
        );

    } else {

      applyLocationFilter(
        modal,
        getCurrentLocationFilter(
          modal
        )
      );

      formatHistoryCostSummary(
        modal
      );
    }
  }

  /* =====================================================================
     UNIFIED WORK ORDER ENRICHMENT CONTROLLER
     ===================================================================== */

  function tryEnrichCurrentWorkOrderPopup() {

    const modal =
      getOpenModal();

    if (
      !modal
    ) {
      return;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    attachMoreViewResizeObserver(
      modal
    );

    const rows =
      getRows();

    const datasetType =
      getDatasetType(
        rows
      );

    const grid =
      getWorkOrderGrid(
        modal
      );

    if (
      !grid
    ) {
      return;
    }

    /*
      INVENTORY -> OPEN WORK ORDERS
    */

    if (
      datasetType ===
        "open_work_orders" &&
      isInventoryContext(
        modal
      )
    ) {

      if (
        grid.getAttribute(
          OPEN_ENRICHED_ATTR
        ) ===
        "true"
      ) {

        repairInventoryOpenWorkOrderGrid(
          modal
        );

        return;
      }

      if (
        grid.getAttribute(
          OPEN_ENRICHING_ATTR
        ) ===
        "true"
      ) {
        return;
      }

      grid.setAttribute(
        OPEN_ENRICHING_ATTR,
        "true"
      );

      enrichInventoryOpenWorkOrders(
        modal
      )
        .then(
          success => {

            if (
              success
            ) {

              grid.setAttribute(
                OPEN_ENRICHED_ATTR,
                "true"
              );
            }
          }
        )
        .catch(
          err => {

            console.warn(
              "Inventory Open Work Order enrichment failed:",
              err
            );
          }
        )
        .finally(
          () => {

            grid.removeAttribute(
              OPEN_ENRICHING_ATTR
            );
          }
        );

      return;
    }

    /*
      WORK ORDER HISTORY
    */

    if (
      datasetType !==
      "work_order_history"
    ) {
      return;
    }

    if (
      grid.getAttribute(
        HISTORY_ENRICHED_ATTR
      ) ===
      "true"
    ) {

      repairHistoryLocationGrid(
        modal
      );

      return;
    }

    if (
      grid.getAttribute(
        HISTORY_ENRICHING_ATTR
      ) ===
      "true"
    ) {
      return;
    }

    grid.setAttribute(
      HISTORY_ENRICHING_ATTR,
      "true"
    );

    enrichHistoryPopup(
      modal
    )
      .then(
        success => {

          if (
            success
          ) {

            grid.setAttribute(
              HISTORY_ENRICHED_ATTR,
              "true"
            );
          }
        }
      )
      .catch(
        err => {

          console.warn(
            "History popup enrichment failed:",
            err
          );
        }
      )
      .finally(
        () => {

          grid.removeAttribute(
            HISTORY_ENRICHING_ATTR
          );
        }
      );
  }

  /*
    Compatibility alias for older calls.
  */

  function tryEnrichCurrentHistoryPopup() {

    tryEnrichCurrentWorkOrderPopup();
  }

  /* =====================================================================
     COLUMN PANEL
     ===================================================================== */

  function getColumnPanel() {

    return document.getElementById(
      COL_PANEL_ID
    );
  }

  function isColumnPanelOpen() {

    const panel =
      getColumnPanel();

    return (
      panel &&
      panel.style.display ===
        "block"
    );
  }

  function closeColumnPanel() {

    const panel =
      getColumnPanel();

    if (
      panel
    ) {

      panel.style.display =
        "none";
    }
  }

  function createSmallPanelButton(
    text
  ) {

    const btn =
      document.createElement(
        "button"
      );

    btn.type =
      "button";

    btn.textContent =
      text;

    btn.style.cssText = [
      "padding:4px 8px",
      "background:#fff",
      "border:1px solid #bbb",
      "border-radius:3px",
      "cursor:pointer",
      "font-size:11px",
      "color:#333"
    ].join(
      ";"
    );

    return btn;
  }

  function refreshColumnPanel() {

    const panel =
      getColumnPanel();

    if (
      !panel
    ) {
      return;
    }

    const rows =
      getRows();

    panel.replaceChildren();

    if (
      !rows.length
    ) {

      const empty =
        document.createElement(
          "div"
        );

      empty.textContent =
        "Open a report first.";

      empty.style.cssText =
        "padding:10px;font-size:12px;color:#666";

      panel.appendChild(
        empty
      );

      return;
    }

    const selectionKey =
      getSelectionKey(
        rows
      );

    const columns =
      getColumns(
        rows
      );

    const selections =
      ensureColumnSelections(
        rows
      );

    const header =
      document.createElement(
        "div"
      );

    header.textContent =
      "Include columns";

    header.style.cssText =
      "padding:8px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #ddd;background:#f8f8f8";

    panel.appendChild(
      header
    );

    const list =
      document.createElement(
        "div"
      );

    list.style.cssText =
      "padding:5px 10px";

    columns.forEach(
      col => {

        const label =
          document.createElement(
            "label"
          );

        label.style.cssText =
          "display:flex;align-items:center;gap:7px;padding:5px 0;font-size:12px;font-weight:400;cursor:pointer;margin:0";

        const checkbox =
          document.createElement(
            "input"
          );

        checkbox.type =
          "checkbox";

        checkbox.checked =
          selections[
            col.key
          ] !== false;

        checkbox.style.margin =
          "0";

        checkbox.addEventListener(
          "change",
          function () {

            selections[
              col.key
            ] =
              checkbox.checked;

            updateColumnButtonLabel();
          }
        );

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          col.header;

        label.appendChild(
          checkbox
        );

        label.appendChild(
          text
        );

        list.appendChild(
          label
        );
      }
    );

    panel.appendChild(
      list
    );

    const footer =
      document.createElement(
        "div"
      );

    footer.style.cssText =
      "display:flex;gap:5px;padding:8px 10px;border-top:1px solid #ddd;background:#f8f8f8";

    const allBtn =
      createSmallPanelButton(
        "All"
      );

    const clearBtn =
      createSmallPanelButton(
        "Clear"
      );

    const resetBtn =
      createSmallPanelButton(
        "Reset"
      );

    allBtn.onclick =
      function (
        event
      ) {

        event.preventDefault();
        event.stopPropagation();

        columns.forEach(
          col => {

            selections[
              col.key
            ] = true;
          }
        );

        refreshColumnPanel();

        updateColumnButtonLabel();
      };

    clearBtn.onclick =
      function (
        event
      ) {

        event.preventDefault();
        event.stopPropagation();

        columns.forEach(
          col => {

            selections[
              col.key
            ] = false;
          }
        );

        refreshColumnPanel();

        updateColumnButtonLabel();
      };

    resetBtn.onclick =
      function (
        event
      ) {

        event.preventDefault();
        event.stopPropagation();

        delete columnSelections[
          selectionKey
        ];

        ensureColumnSelections(
          rows
        );

        refreshColumnPanel();

        updateColumnButtonLabel();
      };

    footer.append(
      allBtn,
      clearBtn,
      resetBtn
    );

    panel.appendChild(
      footer
    );
  }

  function toggleColumnPanel(
    event
  ) {

    event?.preventDefault();
    event?.stopPropagation();

    const panel =
      getColumnPanel();

    if (
      !panel
    ) {
      return;
    }

    if (
      isColumnPanelOpen()
    ) {

      closeColumnPanel();

      return;
    }

    refreshColumnPanel();

    panel.style.display =
      "block";
  }

  function updateColumnButtonLabel() {

    const btn =
      document.getElementById(
        COL_BTN_ID
      );

    if (
      !btn
    ) {
      return;
    }

    const rows =
      getRows();

    if (
      !rows.length
    ) {

      btn.innerHTML =
        '<i class="fa fa-columns"></i> Columns';

      return;
    }

    const total =
      getColumns(
        rows
      ).length;

    const selected =
      getSelectedColumns(
        rows
      ).length;

    btn.innerHTML =
      `<i class="fa fa-columns"></i> Columns (${selected}/${total})`;
  }

  /* =====================================================================
     CSV
     ===================================================================== */

  function buildCsv(
    rows
  ) {

    const columns =
      getSelectedColumns(
        rows
      );

    if (
      !columns.length
    ) {
      return "";
    }

    const csv =
      [];

    csv.push(
      columns
        .map(
          col =>
            csvEscape(
              col.header
            )
        )
        .join(
          ","
        )
    );

    rows.forEach(
      row => {

        csv.push(
          columns
            .map(
              col => {

                const raw =
                  row[
                    col.key
                  ];

                const value =
                  typeof col.formatter ===
                    "function"
                    ? col.formatter(
                        raw
                      )
                    : normalizeText(
                        raw
                      );

                return csvEscape(
                  value
                );
              }
            )
            .join(
              ","
            )
        );
      }
    );

    return csv.join(
      "\n"
    );
  }

  function downloadCsv() {

    const rows =
      getRows();

    if (
      !rows.length
    ) {

      alert(
        "No captured MoreViewClick data found yet."
      );

      return;
    }

    if (
      !getSelectedColumns(
        rows
      ).length
    ) {

      alert(
        "Select at least one column before exporting."
      );

      return;
    }

    const modal =
      getOpenModal();

    const fileName =
      `${getRecordLabel(
        modal
      )} ${detectFileLabel(
        rows
      )}.csv`;

    const blob =
      new Blob(
        [
          buildCsv(
            rows
          )
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      fileName;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );
  }

  /* =====================================================================
     PDF
     ===================================================================== */

  function calculatePdfWidths(
    columns
  ) {

    const weights =
      columns.map(
        col =>
          Number(
            col.width
          ) > 0
            ? Number(
                col.width
              )
            : 1
      );

    const total =
      weights.reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );

    return weights.map(
      value =>
        (
          value /
          total *
          100
        ).toFixed(
          2
        ) +
        "%"
    );
  }

  function getPdfCellValue(
    row,
    col
  ) {

    const raw =
      row[
        col.key
      ];

    if (
      typeof col.pdfFormatter ===
      "function"
    ) {

      return col.pdfFormatter(
        raw
      );
    }

    if (
      typeof col.formatter ===
      "function"
    ) {

      return col.formatter(
        raw
      );
    }

    return normalizeText(
      raw
    );
  }

  function formatPdfCellHtml(
    row,
    col
  ) {

    const value =
      getPdfCellValue(
        row,
        col
      );

    const escaped =
      escapeHtml(
        value
      );

    /*
      Work Order Comments may contain deliberate
      paragraph/newline formatting from
      formatPdfComments().

      Convert those newlines to <br> only for
      PDF rendering.
    */

    if (
      col.key ===
      "HSTCM"
    ) {

      return escaped.replace(
        /\n/g,
        "<br>"
      );
    }

    return escaped;
  }

  function buildPdfTable(
    rows
  ) {

    const columns =
      getSelectedColumns(
        rows
      );

    const widths =
      calculatePdfWidths(
        columns
      );

    const colgroup =
      columns
        .map(
          (
            col,
            index
          ) =>
            `<col style="width:${widths[index]}">`
        )
        .join(
          ""
        );

    const headers =
      columns
        .map(
          col =>
            `<th>${escapeHtml(
              col.header
            )}</th>`
        )
        .join(
          ""
        );

    const body =
      rows
        .map(
          row => `
            <tr>
              ${
                columns
                  .map(
                    col => `
                      <td class="${escapeHtml(
                        col.pdfClass ||
                        ""
                      )}">
                        ${formatPdfCellHtml(
                          row,
                          col
                        )}
                      </td>
                    `
                  )
                  .join(
                    ""
                  )
              }
            </tr>
          `
        )
        .join(
          ""
        );

    return `
      <table>

        <colgroup>
          ${colgroup}
        </colgroup>

        <thead>
          <tr>
            ${headers}
          </tr>
        </thead>

        <tbody>
          ${body}
        </tbody>

      </table>
    `;
  }

  function printPdf() {

    const rows =
      getRows();

    if (
      !rows.length
    ) {

      alert(
        "No captured MoreViewClick data found yet."
      );

      return;
    }

    if (
      !getSelectedColumns(
        rows
      ).length
    ) {

      alert(
        "Select at least one column before printing."
      );

      return;
    }

    /*
      Sort a copy only.

      Work Order History:
        Date Done newest -> oldest

      Open Work Orders:
        Due earliest -> latest

      The live MPulse popup remains unchanged.
    */

    const pdfRows =
      getPdfSortedRows(
        rows
      );

    const modal =
      getOpenModal();

    const recordLabel =
      getRecordLabel(
        modal
      );

    const description =
      getRecordDescription(
        modal
      );

    const reportLabel =
      detectFileLabel(
        rows
      );

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1400,height=900"
      );

    if (
      !printWindow
    ) {

      alert(
        "The print window was blocked."
      );

      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>

<html>

<head>

<meta charset="utf-8">

<title>
${escapeHtml(recordLabel)} ${escapeHtml(reportLabel)}
</title>

<style>

@page {
  size: landscape;
  margin: 0.45in;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color: #222;

  background: #fff;

  font-size: 10px;
}

.report {
  width: 100%;
}

.report-header {
  margin-bottom: 16px;

  padding-bottom: 10px;

  border-bottom: 2px solid #333;
}

.record-title {
  font-size: 20px;

  font-weight: 700;
}

.record-description {
  margin-top: 3px;

  font-size: 11px;
}

.report-title {
  margin-top: 6px;

  font-size: 14px;

  font-weight: 600;

  color: #555;
}

.report-meta {
  display: flex;

  justify-content: space-between;

  gap: 20px;

  margin-top: 8px;

  font-size: 9px;

  color: #666;
}

table {
  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;
}

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;

  break-inside: avoid;
}

th {
  padding: 7px 6px;

  border: 1px solid #777;

  background: #e9ecef;

  color: #222;

  font-size: 9px;

  font-weight: 700;

  text-align: left;

  vertical-align: middle;
}

td {
  padding: 6px;

  border: 1px solid #bbb;

  font-size: 9px;

  vertical-align: top;

  overflow-wrap: anywhere;

  word-wrap: break-word;

  line-height: 1.3;
}

tbody tr:nth-child(even) {
  background: #f8f8f8;
}

.date,
.id,
.type,
.location,
.status,
.priority,
.cost {
  white-space: nowrap;
}

.asset,
.description {
  white-space: normal;
}

.comments {
  white-space: normal;

  line-height: 1.4;
}

.comments br {
  display: block;

  content: "";

  margin-top: 3px;
}

.cost {
  text-align: right;
}

.footer {
  margin-top: 10px;

  padding-top: 6px;

  border-top: 1px solid #bbb;

  font-size: 8px;

  color: #777;
}

@media print {

  body {
    -webkit-print-color-adjust:
      exact;

    print-color-adjust:
      exact;
  }

  thead {
    display:
      table-header-group;
  }

  tr {
    break-inside:
      avoid;
  }
}

</style>

</head>

<body>

<div class="report">

  <div class="report-header">

    <div class="record-title">
      ${escapeHtml(recordLabel)}
    </div>

    ${
      description
        ? `
          <div class="record-description">
            ${escapeHtml(description)}
          </div>
        `
        : ""
    }

    <div class="report-title">
      ${escapeHtml(reportLabel)}
    </div>

    <div class="report-meta">

      <span>
        Records: ${pdfRows.length}
      </span>

      <span>
        Generated:
        ${escapeHtml(
          new Date()
            .toLocaleString()
        )}
      </span>

    </div>

  </div>

  ${buildPdfTable(
    pdfRows
  )}

  <div class="footer">
    Generated from MPulse
  </div>

</div>

<script>

window.addEventListener(
  "load",
  function () {

    setTimeout(
      function () {

        window.focus();

        window.print();

      },
      250
    );
  }
);

<\/script>

</body>

</html>
    `);

    printWindow.document.close();
  }

  /* =====================================================================
     TOOLBAR
     ===================================================================== */

  function makeButton({
    id,
    html,
    background,
    click
  }) {

    const btn =
      document.createElement(
        "button"
      );

    btn.id =
      id;

    btn.type =
      "button";

    btn.innerHTML =
      html;

    btn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "gap:6px",
      "padding:6px 10px",
      `background:${background}`,
      "color:#fff",
      "border:none",
      "border-radius:4px",
      "cursor:pointer",
      "font-size:13px",
      "font-weight:600"
    ].join(
      ";"
    );

    btn.addEventListener(
      "click",
      click
    );

    return btn;
  }

  function addButtons() {

    const modal =
      getOpenModal();

    if (
      !modal
    ) {
      return;
    }

    optimizeMoreViewPopupLayout(
      modal
    );

    attachMoreViewResizeObserver(
      modal
    );

    ensurePopupRecordCount(
      modal
    );

    updatePopupRecordCount(
      modal
    );

    if (
      modal.querySelector(
        "#" +
        TOOLBAR_ID
      )
    ) {

      updatePopupRecordCount(
        modal
      );

      tryEnrichCurrentWorkOrderPopup();

      return;
    }

    const modalBody =
      modal.querySelector(
        ".modal-body"
      );

    if (
      !modalBody
    ) {
      return;
    }

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.id =
      WRAPPER_ID;

    wrapper.style.cssText =
      "position:relative;flex:0 0 auto;margin:0 0 10px 0";

    const toolbar =
      document.createElement(
        "div"
      );

    toolbar.id =
      TOOLBAR_ID;

    toolbar.style.cssText =
      "display:flex;align-items:center;gap:6px;flex-wrap:wrap";

    toolbar.appendChild(
      makeButton({
        id:
          CSV_BTN_ID,

        html:
          '<i class="fa fa-file-excel-o"></i> CSV',

        background:
          "#1976d2",

        click:
          downloadCsv
      })
    );

    toolbar.appendChild(
      makeButton({
        id:
          PDF_BTN_ID,

        html:
          '<i class="fa fa-file-pdf-o"></i> PDF',

        background:
          "#c62828",

        click:
          printPdf
      })
    );

    toolbar.appendChild(
      makeButton({
        id:
          COL_BTN_ID,

        html:
          '<i class="fa fa-columns"></i> Columns',

        background:
          "#555",

        click:
          toggleColumnPanel
      })
    );

    wrapper.appendChild(
      toolbar
    );

    const panel =
      document.createElement(
        "div"
      );

    panel.id =
      COL_PANEL_ID;

    panel.style.cssText =
      "display:none;position:absolute;top:38px;left:145px;z-index:99999;min-width:210px;max-width:300px;background:#fff;color:#222;border:1px solid #bbb;border-radius:4px;box-shadow:0 3px 12px rgba(0,0,0,.25)";

    panel.addEventListener(
      "click",
      event =>
        event.stopPropagation()
    );

    wrapper.appendChild(
      panel
    );

    modalBody.insertBefore(
      wrapper,
      modalBody.firstChild
    );

    initializeSelectionsForCurrentDataset();

    updateColumnButtonLabel();

    ensurePopupRecordCount(
      modal
    );

    updatePopupRecordCount(
      modal
    );

    setTimeout(
      tryEnrichCurrentWorkOrderPopup,
      0
    );
  }

  /* =====================================================================
     OUTSIDE CLICK
     ===================================================================== */

  if (
    !window.__MPULSE_EXPORT_DOCUMENT_CLICK_HOOKED__
  ) {

    window.__MPULSE_EXPORT_DOCUMENT_CLICK_HOOKED__ =
      true;

    document.addEventListener(
      "click",
      function (
        event
      ) {

        const panel =
          getColumnPanel();

        const btn =
          document.getElementById(
            COL_BTN_ID
          );

        if (
          !panel ||
          !btn ||
          !isColumnPanelOpen()
        ) {
          return;
        }

        if (
          panel.contains(
            event.target
          ) ||
          btn.contains(
            event.target
          )
        ) {
          return;
        }

        closeColumnPanel();
      }
    );
  }

  /* =====================================================================
     MUTATION OBSERVER
     ===================================================================== */

  function startObserver() {

    if (
      window.__MPULSE_EXPORT_OBSERVER__
    ) {
      return;
    }

    let scheduled =
      false;

    const observer =
      new MutationObserver(
        function () {

          if (
            scheduled
          ) {
            return;
          }

          scheduled =
            true;

          requestAnimationFrame(
            function () {

              scheduled =
                false;

              const modal =
                getOpenModal();

              if (
                !modal
              ) {
                return;
              }

              optimizeMoreViewPopupLayout(
                modal
              );

              attachMoreViewResizeObserver(
                modal
              );

              updatePopupRecordCount(
                modal
              );

              if (
                !modal.querySelector(
                  "#" +
                  TOOLBAR_ID
                )
              ) {

                addButtons();

                return;
              }

              const rows =
                getRows();

              const datasetType =
                getDatasetType(
                  rows
                );

              const grid =
                getWorkOrderGrid(
                  modal
                );

              if (
                !grid
              ) {
                return;
              }

              /*
                Inventory Open Work Orders
              */

              if (
                datasetType ===
                  "open_work_orders" &&
                isInventoryContext(
                  modal
                )
              ) {

                if (
                  grid.getAttribute(
                    OPEN_ENRICHED_ATTR
                  ) ===
                  "true"
                ) {

                  repairInventoryOpenWorkOrderGrid(
                    modal
                  );

                } else if (
                  grid.getAttribute(
                    OPEN_ENRICHING_ATTR
                  ) !==
                  "true"
                ) {

                  tryEnrichCurrentWorkOrderPopup();
                }

                return;
              }

              /*
                Work Order History
              */

              if (
                datasetType ===
                "work_order_history"
              ) {

                formatHistoryCostSummary(
                  modal
                );

                if (
                  grid.getAttribute(
                    HISTORY_ENRICHED_ATTR
                  ) ===
                  "true"
                ) {

                  repairHistoryLocationGrid(
                    modal
                  );

                } else if (
                  grid.getAttribute(
                    HISTORY_ENRICHING_ATTR
                  ) !==
                  "true"
                ) {

                  tryEnrichCurrentWorkOrderPopup();
                }
              }
            }
          );
        }
      );

    observer.observe(
      document.body,
      {
        childList:
          true,

        subtree:
          true
      }
    );

    window.__MPULSE_EXPORT_OBSERVER__ =
      observer;
  }

  /* =====================================================================
     INIT
     ===================================================================== */

  function init() {

    addButtons();

    startObserver();

    initializeSelectionsForCurrentDataset();

    const modal =
      getOpenModal();

    if (
      modal
    ) {

      optimizeMoreViewPopupLayout(
        modal
      );

      attachMoreViewResizeObserver(
        modal
      );

      ensurePopupRecordCount(
        modal
      );

      updatePopupRecordCount(
        modal
      );
    }

    setTimeout(
      tryEnrichCurrentWorkOrderPopup,
      500
    );

    console.log(
      `MPulse MoreView report tool ${SCRIPT_VERSION} initialized.`
    );
  }

  init();

})();
