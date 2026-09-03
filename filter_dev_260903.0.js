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
    }
  };


  /* =====================================================================
     AVAILABLE FILTER VALUES
     ===================================================================== */

  const SITE_OPTIONS = [
    "AZ1",
    "CA1",
    "FL1",
    "FL2",
    "IL1",
    "IL2",
    "MA1",
    "MO1",
    "NJ2",
    "NJ3",
    "NJ5",
    "NY1",
    "OH1",
    "TX3",
    "TX4",
    "VA1",
    "WV2"
  ];

  const DEPT_OPTIONS = [
    "TSG",
    "FAC",
    "RCM",
    "PRD"
  ];


  /* =====================================================================
     SETTINGS
     ===================================================================== */
  function getCurrentUserId() {
    return localStorage.getItem("userId") || null;
  }
  
  function getSettingsKey() {
    const userId = getCurrentUserId();
  
    if (!userId) {
      console.warn("⚠️ MPulse userId not found.");
      return null;
    }
  
    return `mpulseAutoFilter:${userId}`;
  }
  

  const FILTER_COOKIE_NAME = "mpulseAutoFilterPrefs";
  const FILTER_COOKIE_MAX_AGE = 31536000; // 1 year
  
  
  function getCurrentUserId() {
    return localStorage.getItem("userId") || null;
  }
  
  
  function getCookie(name) {
    const prefix = `${encodeURIComponent(name)}=`;
  
    const parts = document.cookie
      .split(";")
      .map(part => part.trim());
  
    const match = parts.find(
      part => part.startsWith(prefix)
    );
  
    if (!match) {
      return null;
    }
  
    return decodeURIComponent(
      match.substring(prefix.length)
    );
  }
  
  
  function setCookie(name, value) {
    document.cookie =
      `${encodeURIComponent(name)}=` +
      `${encodeURIComponent(value)}; ` +
      `max-age=${FILTER_COOKIE_MAX_AGE}; ` +
      `path=/; SameSite=Lax`;
  }
  
  
  function getAllFilterPreferences() {
    try {
      const raw =
        getCookie(FILTER_COOKIE_NAME);
  
      if (!raw) {
        return {};
      }
  
      const parsed =
        JSON.parse(raw);
  
      return (
        parsed &&
        typeof parsed === "object"
      )
        ? parsed
        : {};
  
    } catch (e) {
      console.warn(
        "⚠️ Could not read saved filter preferences",
        e
      );
  
      return {};
    }
  }
  
  
  function getSettings() {
    const userId =
      getCurrentUserId();
  
    if (!userId) {
      console.warn(
        "⚠️ MPulse userId not found."
      );
  
      return {
        sites: [],
        depts: []
      };
    }
  
    const allPreferences =
      getAllFilterPreferences();
  
    const saved =
      allPreferences[userId] || {};
  
    return {
      sites:
        Array.isArray(saved.sites)
          ? saved.sites
          : [],
  
      depts:
        Array.isArray(saved.depts)
          ? saved.depts
          : []
    };
  }
  
  
  function saveSettings(settings) {
    const userId =
      getCurrentUserId();
  
    if (!userId) {
      console.warn(
        "⚠️ Filter settings not saved because MPulse userId could not be determined."
      );
  
      return;
    }
  
    const allPreferences =
      getAllFilterPreferences();
  
    allPreferences[userId] = {
      sites:
        Array.isArray(settings.sites)
          ? settings.sites
          : [],
  
      depts:
        Array.isArray(settings.depts)
          ? settings.depts
          : []
    };
  
    setCookie(
      FILTER_COOKIE_NAME,
      JSON.stringify(allPreferences)
    );
  
    console.log(
      "💾 Persistent user filter settings saved:",
      userId,
      allPreferences[userId]
    );
  }

  /* =====================================================================
     FILTER BUILDING
     ===================================================================== */

  function makeValueFilter(field, values) {

    if (
        !field ||
        !Array.isArray(values) ||
        !values.length
    ) {
        return null;
    }

    const cleanValues = [
        ...new Set(
            values
                .map(v => String(v || "").trim())
                .filter(v => v && v !== "ALL")
        )
    ];

    if (!cleanValues.length) {
        return null;
    }

    if (cleanValues.length === 1) {
        return [
            field,
            "=",
            cleanValues[0]
        ];
    }

    // Build a flat OR expression:
    //
    // [
    //   ["Departments", "=", "TSG"],
    //   "or",
    //   ["Departments", "=", "FAC"],
    //   "or",
    //   ["Departments", "=", "PRD"],
    //   "or",
    //   ["Departments", "=", "RCM"]
    // ]

    const filter = [];

    cleanValues.forEach((value, index) => {

        if (index > 0) {
            filter.push("or");
        }

        filter.push([
            field,
            "=",
            value
        ]);
    });

    return filter;
}


  function makeFilter(settings, cfg) {

    let sites = Array.isArray(settings.sites)
        ? settings.sites
            .map(v => String(v || "").trim())
            .filter(v => v && v !== "ALL")
        : [];

    let depts = Array.isArray(settings.depts)
        ? settings.depts
            .map(v => String(v || "").trim())
            .filter(v => v && v !== "ALL")
        : [];


    // ---------------------------------------------------------
    // ALL SELECTED = NO FILTER FOR THAT CATEGORY
    //
    // If every available location or department is selected,
    // don't send an unnecessary OR expression to MPulse.
    // ---------------------------------------------------------

    const allSitesSelected =
        sites.length === SITE_OPTIONS.length &&
        SITE_OPTIONS.every(site =>
            sites.includes(site)
        );

    const allDeptsSelected =
        depts.length === DEPT_OPTIONS.length &&
        DEPT_OPTIONS.every(dept =>
            depts.includes(dept)
        );


    if (allSitesSelected) {
        sites = [];
    }

    if (allDeptsSelected) {
        depts = [];
    }


    // ---------------------------------------------------------
    // LOCATION + DEPARTMENT
    // ---------------------------------------------------------

    if (
        cfg.siteField &&
        cfg.deptField &&
        sites.length &&
        depts.length
    ) {

        const combinations = [];

        sites.forEach(site => {

            depts.forEach(dept => {

                combinations.push([
                    [
                        cfg.siteField,
                        "=",
                        site
                    ],
                    "and",
                    [
                        cfg.deptField,
                        "=",
                        dept
                    ]
                ]);

            });

        });


        if (combinations.length === 1) {
            return combinations[0];
        }


        const filter = [];

        combinations.forEach(
            (condition, index) => {

                if (index > 0) {
                    filter.push("or");
                }

                filter.push(condition);
            }
        );

        return filter;
    }


    // ---------------------------------------------------------
    // LOCATION ONLY
    // ---------------------------------------------------------

    if (
        cfg.siteField &&
        sites.length
    ) {

        return makeValueFilter(
            cfg.siteField,
            sites
        );
    }


    // ---------------------------------------------------------
    // DEPARTMENT ONLY
    // ---------------------------------------------------------

    if (
        cfg.deptField &&
        depts.length
    ) {

        return makeValueFilter(
            cfg.deptField,
            depts
        );
    }


    // ---------------------------------------------------------
    // NOTHING TO FILTER
    // ---------------------------------------------------------

    return null;
}

  /* =====================================================================
     REMOVE PREVIOUS AUTO FILTER CONDITIONS
     ===================================================================== */

  function isAutoFilterNode(node, cfg) {

    return (
      Array.isArray(node) &&
      node.length === 3 &&
      [cfg.siteField, cfg.deptField].includes(node[0]) &&
      node[1] === "="
    );
  }


  function stripAutoFilters(filter, cfg) {

    if (!Array.isArray(filter)) {
      return filter;
    }


    if (isAutoFilterNode(filter, cfg)) {
      return null;
    }


    if (
      filter.length === 3 &&
      typeof filter[1] === "string" &&
      ["and", "or"].includes(
        filter[1].toLowerCase()
      )
    ) {

      const left =
        stripAutoFilters(
          filter[0],
          cfg
        );

      const op =
        filter[1].toLowerCase();

      const right =
        stripAutoFilters(
          filter[2],
          cfg
        );


      if (!left && !right) {
        return null;
      }

      if (!left) {
        return right;
      }

      if (!right) {
        return left;
      }


      return [
        left,
        op,
        right
      ];
    }


    const cleaned = [];


    for (const item of filter) {

      if (
        typeof item === "string" &&
        ["and", "or"].includes(
          item.toLowerCase()
        )
      ) {

        cleaned.push(
          item.toLowerCase()
        );

      } else {

        const cleanedItem =
          stripAutoFilters(
            item,
            cfg
          );


        if (cleanedItem) {
          cleaned.push(cleanedItem);
        }
      }
    }


    while (
      cleaned[0] === "and" ||
      cleaned[0] === "or"
    ) {
      cleaned.shift();
    }


    while (
      cleaned[cleaned.length - 1] === "and" ||
      cleaned[cleaned.length - 1] === "or"
    ) {
      cleaned.pop();
    }


    if (!cleaned.length) {
      return null;
    }


    if (cleaned.length === 1) {
      return cleaned[0];
    }


    return cleaned;
  }


  /* =====================================================================
     GRID HELPERS
     ===================================================================== */

  function getVisibleGrids() {

    const grids = [];


    for (
      const el of
      document.querySelectorAll("*")
    ) {

      try {

        const inst =
          DevExpress.ui.dxDataGrid
            .getInstance(el);


        if (
          !inst ||
          !inst.getDataSource
        ) {
          continue;
        }


        const rect =
          el.getBoundingClientRect();

        const style =
          window.getComputedStyle(el);


        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden";


        if (visible) {
          grids.push({
            el,
            inst
          });
        }

      } catch {}
    }


    return grids;
  }


  function isPopupVisible() {

    return Array.from(
      document.querySelectorAll(
        ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
      )
    ).some(el => {

      const r =
        el.getBoundingClientRect();

      return (
        r.width > 0 &&
        r.height > 0
      );
    });
  }


  function refreshList() {

    const grids =
      getVisibleGrids();


    const mainGrid =
      grids.find(({ el }) =>

        el.classList.contains(
          "gridContainer"
        ) ||

        el.getAttribute(
          "dx-data-grid"
        ) === "listviewgrid"

      );


    if (!mainGrid) {

      console.log(
        "⚠️ No main list grid found."
      );

      return;
    }


    try {

      const ds =
        mainGrid.inst
          .getDataSource?.();


      if (
        ds &&
        typeof ds.reload === "function"
      ) {

        ds.reload();

        console.log(
          "🔄 Reloaded main list grid",
          mainGrid.el
        );

      } else {

        console.log(
          "⏭️ Main grid has no reloadable data source",
          mainGrid.el
        );
      }

    } catch (e) {

      console.warn(
        "Main grid reload failed",
        e,
        mainGrid.el
      );
    }
  }


  /* =====================================================================
     FILTER MERGE
     ===================================================================== */

  function mergeFilter(
    existing,
    injected,
    cfg
  ) {

    const cleanedExisting =
      stripAutoFilters(
        existing,
        cfg
      );


    if (!cleanedExisting) {
      return injected;
    }


    if (!injected) {
      return cleanedExisting;
    }


    return [
      cleanedExisting,
      "and",
      injected
    ];
  }


  /* =====================================================================
     PATCH MPULSE REQUEST
     ===================================================================== */

  function patchPayload(
    payload,
    context = {}
  ) {

    if (!payload) {
      return payload;
    }


    const cfg =
      MODULE_CONFIG[
        payload.SubModuleKey
      ];


    if (!cfg) {
      return payload;
    }


    if (
      payload.RequestType === "Customize"
    ) {

      console.log(
        `⏭️ Skipping ${cfg.name} Customize request`
      );

      return payload;
    }


    const settings =
      getSettings();


    payload.loadOptions =
      payload.loadOptions || {};


    const existing =
      payload.loadOptions.filter || null;


    const injected =
      makeFilter(
        settings,
        cfg
      );


    payload.loadOptions.filter =
      mergeFilter(
        existing,
        injected,
        cfg
      );


    console.log(
      `✅ Auto filter applied to ${cfg.name}:`,
      {
        popup:
          !!context.isLinkPopup,

        url:
          context.url,

        RequestType:
          payload.RequestType,

        filter:
          payload.loadOptions.filter,

        settings
      }
    );


    return payload;
  }


  /* =====================================================================
     LINK ADDITIONAL ASSET POPUP NORMALIZATION
     ===================================================================== */

  function normalizeVisibleLinkPopupGrid() {

    const popup =
      Array.from(
        document.querySelectorAll(
          ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
        )
      ).find(el => {

        const r =
          el.getBoundingClientRect();

        return (
          r.width > 0 &&
          r.height > 0
        );
      });


    if (!popup) {
      return;
    }


    const popupText =
      popup.innerText || "";


    if (
      !/link\s+additional\s+asset/i
        .test(popupText)
    ) {

      console.log(
        "⏭️ Skipping popup normalization:",
        popupText.slice(0, 80)
      );

      return;
    }


    let grid = null;


    popup
      .querySelectorAll("*")
      .forEach(el => {

        if (grid) {
          return;
        }


        try {

          const inst =
            DevExpress.ui.dxDataGrid
              .getInstance(el);


          if (inst?.columnOption) {
            grid = inst;
          }

        } catch {}
      });


    if (!grid) {

      console.log(
        "No Link Additional Asset popup grid found"
      );

      return;
    }


    const cols =
      grid.option("columns") || [];


    cols.forEach(
      (col, i) => {

        const field = [
          col.dataField,
          col.name,
          col.caption
        ]
          .filter(Boolean)
          .join(" ");


        const keep =
          /id/i.test(field) ||
          /code/i.test(field) ||
          /desc/i.test(field) ||
          /description/i.test(field);


        grid.columnOption(
          i,
          "visible",
          keep
        );
      }
    );


    cols.forEach(
      (col, i) => {

        const field = [
          col.dataField,
          col.name,
          col.caption
        ]
          .filter(Boolean)
          .join(" ");


        if (/id|code/i.test(field)) {

          grid.columnOption(
            i,
            "width",
            140
          );
        }


        if (/desc|description/i.test(field)) {

          grid.columnOption(
            i,
            "width",
            520
          );
        }
      }
    );


    grid.updateDimensions();


    console.log(
      "✅ Normalized Link Additional Asset popup only"
    );
  }


  let popupNormalizeTimer = null;


  function schedulePopupNormalize(reason) {

    clearTimeout(
      popupNormalizeTimer
    );


    popupNormalizeTimer =
      setTimeout(() => {

        console.log(
          "🧱 Normalizing popup grid:",
          reason
        );

        normalizeVisibleLinkPopupGrid();

      }, 400);
  }


  /* =====================================================================
     XHR INTERCEPTOR
     ===================================================================== */

  const originalOpen =
    XMLHttpRequest.prototype.open;

  const originalSend =
    XMLHttpRequest.prototype.send;


  XMLHttpRequest.prototype.open =
    function (
      method,
      url
    ) {

      this.__url =
        typeof url === "string"
          ? url
          : "";


      return originalOpen.apply(
        this,
        arguments
      );
    };


  XMLHttpRequest.prototype.send =
    function (body) {

      if (
        typeof body === "string"
      ) {

        try {

          const payload =
            JSON.parse(body);


          const isLinkPopup =
            this.__url?.includes(
              "LoadLinkPopUp"
            ) ||

            payload.RequestType ===
              "LoadLinkPopUp";


          const isPopupRequest =
            isPopupVisible() &&

            [
              "Load",
              "Filter",
              "TemplateChange"
            ].includes(
              payload.RequestType
            );


          const shouldNormalizePopup =
            isLinkPopup ||
            isPopupRequest;


          if (
            payload &&
            payload.SubModuleKey
          ) {

            patchPayload(
              payload,
              {
                isLinkPopup:
                  shouldNormalizePopup,

                url:
                  this.__url
              }
            );
          }


          if (shouldNormalizePopup) {

            this.addEventListener(
              "loadend",
              () => {

                schedulePopupNormalize(

                  isLinkPopup
                    ? "LoadLinkPopUp completed"
                    : "popup Load completed"

                );
              }
            );
          }


          body =
            JSON.stringify(payload);

        } catch {
          // Non-JSON request; leave unchanged.
        }
      }


      return originalSend.call(
        this,
        body
      );
    };


  console.log(
    "🧪 MPulse multi-select auto filter active"
  );


  /* =====================================================================
     UI HELPERS
     ===================================================================== */

  function checkboxListHtml(
    prefix,
    options,
    selectedValues
  ) {

    const selected =
      new Set(
        selectedValues || []
      );


    return options
      .map(value => `

        <label style="
          display:flex;
          align-items:center;
          gap:6px;
          padding:4px 3px;
          cursor:pointer;
          white-space:nowrap;
        ">

          <input
            type="checkbox"
            class="${prefix}Option"
            value="${value}"
            ${selected.has(value)
              ? "checked"
              : ""}
          >

          <span>${value}</span>

        </label>

      `)
      .join("");
  }


  function getCheckedValues(
    root,
    selector
  ) {

    return Array.from(
      root.querySelectorAll(selector)
    )
      .filter(el => el.checked)
      .map(el => el.value);
  }


  /* =====================================================================
     UI
     ===================================================================== */

  function injectUI() {

    if (
      document.querySelector(
        "#mpulseAutoFilterCompact"
      )
    ) {
      return;
    }


    const settings =
      getSettings();


    const nav =
      document.querySelector(
        ".mainNavigationLists"
      );


    if (!nav) {
      return;
    }


    const li =
      document.createElement("li");


    li.id =
      "mpulseAutoFilterCompact";


    li.style.cssText = `
      position:relative;
      display:flex;
      align-items:center;
      margin-top:8px;
      margin-right:8px;
    `;


    li.innerHTML = `

      <button
        type="button"
        id="afsIconBtn"
        title="List Filters"
        style="
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
        "
      >

        <i class="fa fa-filter"></i>

      </button>


      <span
        id="afsDot"
        style="
          position:absolute;
          top:2px;
          right:2px;
          width:9px;
          height:9px;
          border-radius:50%;
          background:#16a34a;
          border:1px solid #fff;
          display:none;
          pointer-events:none;
        "
      ></span>


      <div
        id="afsMenu"
        style="
          display:none;
          position:absolute;
          top:40px;
          right:0;
          width:310px;
          padding:12px;
          background:#fff;
          border:1px solid #cfd6df;
          border-radius:10px;
          box-shadow:0 8px 24px rgba(0,0,0,.18);
          z-index:99999;
          font-size:12px;
          color:#1f2933;
        "
      >


        <div style="
          font-size:13px;
          font-weight:600;
          margin-bottom:12px;
        ">
          List Filters
        </div>


        <!-- LOCATION -->

        <div style="
          margin-bottom:14px;
        ">

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            margin-bottom:5px;
          ">

            <span style="
              font-weight:600;
            ">
              Location
            </span>


            <span
              id="afsSiteCount"
              style="
                font-size:10px;
                color:#6b7280;
              "
            ></span>

          </div>


          <div
            id="afsSiteOptions"
            style="
              display:grid;
              grid-template-columns:repeat(2,1fr);
              gap:1px 8px;
              max-height:150px;
              overflow-y:auto;
              padding:6px;
              border:1px solid #d1d5db;
              border-radius:6px;
              background:#fafafa;
            "
          >

            ${checkboxListHtml(
              "afsSite",
              SITE_OPTIONS,
              settings.sites
            )}

          </div>


          <div style="
            display:flex;
            gap:10px;
            margin-top:5px;
          ">

            <button
              type="button"
              id="afsSiteAll"
              style="
                border:0;
                background:none;
                padding:0;
                color:#2563eb;
                cursor:pointer;
                font-size:10px;
              "
            >
              Select all
            </button>


            <button
              type="button"
              id="afsSiteClear"
              style="
                border:0;
                background:none;
                padding:0;
                color:#2563eb;
                cursor:pointer;
                font-size:10px;
              "
            >
              Clear
            </button>

          </div>

        </div>


        <!-- DEPARTMENT -->

        <div style="
          margin-bottom:14px;
        ">

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            margin-bottom:5px;
          ">

            <span style="
              font-weight:600;
            ">
              Department
            </span>


            <span
              id="afsDeptCount"
              style="
                font-size:10px;
                color:#6b7280;
              "
            ></span>

          </div>


          <div
            id="afsDeptOptions"
            style="
              display:grid;
              grid-template-columns:repeat(2,1fr);
              gap:1px 8px;
              padding:6px;
              border:1px solid #d1d5db;
              border-radius:6px;
              background:#fafafa;
            "
          >

            ${checkboxListHtml(
              "afsDept",
              DEPT_OPTIONS,
              settings.depts
            )}

          </div>


          <div style="
            display:flex;
            gap:10px;
            margin-top:5px;
          ">

            <button
              type="button"
              id="afsDeptAll"
              style="
                border:0;
                background:none;
                padding:0;
                color:#2563eb;
                cursor:pointer;
                font-size:10px;
              "
            >
              Select all
            </button>


            <button
              type="button"
              id="afsDeptClear"
              style="
                border:0;
                background:none;
                padding:0;
                color:#2563eb;
                cursor:pointer;
                font-size:10px;
              "
            >
              Clear
            </button>

          </div>

        </div>


        <!-- STATUS -->

        <div
          id="afsStatus"
          style="
            padding:7px 8px;
            border-radius:6px;
            background:#f3f4f6;
            color:#374151;
            margin-bottom:10px;
            font-size:11px;
            line-height:1.4;
          "
        ></div>


        <!-- ACTIONS -->

        <div style="
          display:flex;
          gap:8px;
          justify-content:flex-end;
        ">

          <button
            type="button"
            id="afsClearAll"
            style="
              border:1px solid #d1d5db;
              background:#f9fafb;
              border-radius:6px;
              padding:5px 9px;
              cursor:pointer;
            "
          >
            Clear All
          </button>


          <button
            type="button"
            id="afsApply"
            style="
              border:1px solid #2563eb;
              background:#2563eb;
              color:#fff;
              border-radius:6px;
              padding:5px 11px;
              cursor:pointer;
            "
          >
            Apply
          </button>

        </div>

      </div>
    `;


    /* =================================================================
       INSERT INTO MPULSE NAVIGATION
       ================================================================= */

    const userInfo =
      nav.querySelector(
        ".userInfoWrap"
      );


    if (
      userInfo &&
      userInfo.parentElement?.tagName === "LI"
    ) {

      nav.insertBefore(
        li,
        userInfo.parentElement
      );

    } else {

      nav.appendChild(li);
    }


    /* =================================================================
       REFERENCES
       ================================================================= */

    const iconBtn =
      li.querySelector("#afsIconBtn");

    const menu =
      li.querySelector("#afsMenu");

    const dot =
      li.querySelector("#afsDot");

    const siteCount =
      li.querySelector("#afsSiteCount");

    const deptCount =
      li.querySelector("#afsDeptCount");

    const siteAllBtn =
      li.querySelector("#afsSiteAll");

    const siteClearBtn =
      li.querySelector("#afsSiteClear");

    const deptAllBtn =
      li.querySelector("#afsDeptAll");

    const deptClearBtn =
      li.querySelector("#afsDeptClear");

    const clearAllBtn =
      li.querySelector("#afsClearAll");

    const applyBtn =
      li.querySelector("#afsApply");

    const status =
      li.querySelector("#afsStatus");


    /* =================================================================
       GET CURRENT UI SETTINGS
       ================================================================= */

    function getUISettings() {

      return {

        sites:
          getCheckedValues(
            li,
            ".afsSiteOption"
          ),

        depts:
          getCheckedValues(
            li,
            ".afsDeptOption"
          )

      };
    }


    /* =================================================================
       STATUS
       ================================================================= */

    function updateStatus(
      settings = getUISettings()
    ) {

      const parts = [];


      if (settings.sites.length) {

        if (settings.sites.length <= 2) {

          parts.push(
            `Location: ${settings.sites.join(", ")}`
          );

        } else {

          parts.push(
            `Location: ${settings.sites.length} selected`
          );
        }
      }


      if (settings.depts.length) {

        if (settings.depts.length <= 2) {

          parts.push(
            `Dept: ${settings.depts.join(", ")}`
          );

        } else {

          parts.push(
            `Dept: ${settings.depts.length} selected`
          );
        }
      }


      status.textContent =
        parts.length
          ? parts.join(" | ")
          : "No automatic filters";


      dot.style.display =
        parts.length
          ? "block"
          : "none";


      iconBtn.style.borderColor =
        parts.length
          ? "#16a34a"
          : "#cfd6df";


      siteCount.textContent =
        settings.sites.length
          ? `${settings.sites.length} selected`
          : "None";


      deptCount.textContent =
        settings.depts.length
          ? `${settings.depts.length} selected`
          : "None";
    }


    /* =================================================================
       SAVE WITHOUT REFRESHING GRID

       Checkbox selections are persisted immediately.
       Apply controls when the MPulse list reloads.
       ================================================================= */

    function saveCurrentSelections() {

      const settings =
        getUISettings();


      saveSettings(settings);

      updateStatus(settings);

      return settings;
    }


    /* =================================================================
       MENU
       ================================================================= */

    iconBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        menu.style.display =
          menu.style.display === "none"
            ? "block"
            : "none";


        return false;
      };


    menu.onclick = (e) => {
        e.stopPropagation();
      };


    document.addEventListener(
      "click",
      () => {

        menu.style.display =
          "none";

      }
    );


    /* =================================================================
       CHECKBOX CHANGES
       ================================================================= */

    li
      .querySelectorAll(
        ".afsSiteOption"
      )
      .forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        el.addEventListener(
          "change",
          saveCurrentSelections
        );

      });


    li
      .querySelectorAll(
        ".afsDeptOption"
      )
      .forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        el.addEventListener(
          "change",
          saveCurrentSelections
        );

      });


    /* =================================================================
       LOCATION SELECT ALL
       ================================================================= */

    siteAllBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        li
          .querySelectorAll(
            ".afsSiteOption"
          )
          .forEach(el => {

            el.checked = true;

          });


        saveCurrentSelections();

        return false;
      };


    /* =================================================================
       LOCATION CLEAR
       ================================================================= */

    siteClearBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        li
          .querySelectorAll(
            ".afsSiteOption"
          )
          .forEach(el => {

            el.checked = false;

          });


        saveCurrentSelections();

        return false;
      };


    /* =================================================================
       DEPARTMENT SELECT ALL
       ================================================================= */

    deptAllBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        li
          .querySelectorAll(
            ".afsDeptOption"
          )
          .forEach(el => {

            el.checked = true;

          });


        saveCurrentSelections();

        return false;
      };


    /* =================================================================
       DEPARTMENT CLEAR
       ================================================================= */

    deptClearBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        li
          .querySelectorAll(
            ".afsDeptOption"
          )
          .forEach(el => {

            el.checked = false;

          });


        saveCurrentSelections();

        return false;
      };


    /* =================================================================
       CLEAR ALL
       ================================================================= */

    clearAllBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        li
          .querySelectorAll(
            ".afsSiteOption, .afsDeptOption"
          )
          .forEach(el => {

            el.checked = false;

          });


        const settings =
          saveCurrentSelections();


        console.log(
          "🧹 Auto filters cleared:",
          settings
        );


        menu.style.display =
          "none";


        setTimeout(
          refreshList,
          100
        );

        setTimeout(
          refreshList,
          600
        );


        return false;
      };


    /* =================================================================
       APPLY
       ================================================================= */

    applyBtn.onclick =
      (e) => {

        e.preventDefault();
        e.stopPropagation();


        const settings =
          saveCurrentSelections();


        console.log(
          "💾 Auto filter settings applied:",
          settings
        );


        menu.style.display =
          "none";


        setTimeout(
          refreshList,
          100
        );

        setTimeout(
          refreshList,
          600
        );


        return false;
      };


    /* =================================================================
       INITIAL DISPLAY
       ================================================================= */

    updateStatus(settings);
  }


  /* =====================================================================
     UI OBSERVER
     ===================================================================== */

  const observer =
    new MutationObserver(
      () => injectUI()
    );


  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );


  injectUI();


  /* =====================================================================
     POPUP OBSERVER
     ===================================================================== */

  let lastPopupKey = null;
  let popupRefreshTimer = null;


  function getPopupKey() {

    const popup =
      Array.from(
        document.querySelectorAll(
          ".modal.in, .dx-popup-wrapper, .dx-overlay-wrapper"
        )
      ).find(el => {

        const r =
          el.getBoundingClientRect();

        return (
          r.width > 0 &&
          r.height > 0
        );
      });


    if (!popup) {
      return null;
    }


    return (
      popup.id ||
      popup.className ||
      popup.innerText?.slice(0, 80) ||
      "popup"
    );
  }


  const popupObserver =
    new MutationObserver(
      () => {

        const popupKey =
          getPopupKey();


        if (!popupKey) {

          lastPopupKey = null;

          return;
        }


        if (
          popupKey === lastPopupKey
        ) {
          return;
        }


        lastPopupKey =
          popupKey;


        clearTimeout(
          popupRefreshTimer
        );


        popupRefreshTimer =
          setTimeout(
            () => {

              console.log(
                "🔄 New popup detected; normalizing popup grids once"
              );

              normalizeVisibleLinkPopupGrid();

            },
            800
          );
      }
    );


  popupObserver.observe(
    document.body,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style"
      ]
    }
  );


})();
