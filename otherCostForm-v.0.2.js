/* =========================================================================
   MPulse Other Cost – Line Item Table (Production)
   - Injects editable line-item table above Other Cost Description
   - Live-updates OtherCost (dxNumberBox) total
   - Persists line items as JSON inside OtherCostDesc (Angular model)
   - Auto-restores table from saved JSON on load
   - Safe for MPulse modal re-renders (guarded)
   ========================================================================= */

(function OtherCostLineItems_BOOT() {
  console.log("🧾 Other Cost Line Items: boot");

  // Prevent double injection (MPulse modals can re-render)
  if (document.getElementById("otherCostTableWrap")) {
    console.warn("🟡 otherCostTableWrap already exists — skipping.");
    return;
  }

  // Wait for the "Other Cost Description" container to exist, then for Angular model,
  // then inject everything in one controlled sequence.
  waitForOtherCostDescription((descEl) => {
    waitForAngularSelectedRecord(descEl, (scope) => {
      try {
        injectOtherCostTable(descEl, scope);
      } catch (e) {
        console.error("❌ Other Cost Line Items: inject failed", e);
      }
    });
  });

  /* ============================== WAIT HELPERS ============================== */

  function waitForOtherCostDescription(cb, timeout = 12000) {
    const start = Date.now();

    (function check() {
      const el =
        document.querySelector("#OtherCostDescription") ||
        document.querySelector('[fieldname="OtherCostDesc"]') ||
        // Some MPulse layouts use controlkey on wrapper:
        document.querySelector('[controlkey="152"]');

      if (el) {
        console.log("✅ Found Other Cost Description container");
        cb(el);
        return;
      }

      if (Date.now() - start > timeout) {
        console.warn("⏱ Timed out waiting for Other Cost Description");
        return;
      }

      requestAnimationFrame(check);
    })();
  }

  function waitForAngularSelectedRecord(el, cb, timeout = 12000) {
    const start = Date.now();

    (function check() {
      if (!window.angular) {
        if (Date.now() - start > timeout) {
          console.warn("⏱ Timed out waiting for Angular");
          return;
        }
        requestAnimationFrame(check);
        return;
      }

      let scope = null;
      try {
        scope = angular.element(el).scope() || angular.element(el).isolateScope();
      } catch {}

      // selectedRecord is the key for MPulse form binding
      if (scope?.selectedRecord) {
        console.log("✅ Found Angular selectedRecord");
        cb(scope);
        return;
      }

      if (Date.now() - start > timeout) {
        console.warn("⏱ Timed out waiting for selectedRecord");
        return;
      }

      requestAnimationFrame(check);
    })();
  }

  /* ============================== MAIN INJECTOR ============================== */

  function injectOtherCostTable(descEl, scope) {
    // Guard again inside injector (extra safety)
    if (document.getElementById("otherCostTableWrap")) return;

    /* ------------------------------ CONFIG ------------------------------ */

    const COST_TYPES = [
      "Vendor Service",
      "Contractor Labor",
      "Freight",
      "Materials (Non-Inventory)",
      "Calibration",
      "Waste / Disposal",
      "Travel",
      "Regulatory",
      "Miscellaneous",
    ];

    const JSON_START = "<!-- OTHER_COST_JSON_START -->";
    const JSON_END = "<!-- OTHER_COST_JSON_END -->";

    // IMPORTANT: keep JSON compact-ish; it's stored in a text field.
    const SCHEMA = "other-cost.v1";
    const CURRENCY = "USD";

    /* ------------------------------ UI ------------------------------ */

    const wrap = document.createElement("div");
    wrap.id = "otherCostTableWrap";
    Object.assign(wrap.style, {
      border: "1px solid #ccc",
      padding: "8px",
      marginBottom: "10px",
      background: "#fafafa",
    });

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h4 style="margin:0">Other Cost – Line Items</h4>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="octAdd" type="button">+ Add Line</button>
          <button id="octPDF" type="button">Generate PDF Snapshot</button>
        </div>
      </div>

      <div style="margin-top:8px;overflow:auto;">
        <table id="octTable" style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;">Type</th>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;">Vendor</th>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;">Description</th>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;width:70px;">Qty</th>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;width:90px;">Unit</th>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:4px;width:110px;">Total</th>
              <th style="border-bottom:1px solid #ddd;padding:4px;width:40px;"></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div style="margin-top:8px;font-weight:bold">
        Total: $<span id="octTotal">0.00</span>
        <span id="octStatus" style="margin-left:10px;font-weight:normal;color:#666;"></span>
      </div>
    `;

    // Insert above the existing Other Cost Description field
    const fg = descEl.closest(".form-group") || descEl;
    fg.prepend(wrap);

    const tbody = wrap.querySelector("#octTable tbody");
    const totalEl = wrap.querySelector("#octTotal");
    const statusEl = wrap.querySelector("#octStatus");

    /* ------------------------------ MPULSE BINDINGS ------------------------------ */

    function setOtherCostDX(value) {
      const boxEl = document.querySelector(
        "#OtherCost.dx-numberbox, [fieldname='OtherCost'].dx-numberbox"
      );
      if (!boxEl || !window.DevExpress?.ui?.dxNumberBox) return;

      const instance = DevExpress.ui.dxNumberBox.getInstance(boxEl);
      if (!instance) return;

      instance.option("value", value);

      // Keep Angular model in sync (MPulse uses both)
      try {
        const s = angular.element(boxEl).scope() || angular.element(boxEl).isolateScope();
        s?.$applyAsync(() => {
          if (s.$root?.numberValues?.OtherCost) {
            s.$root.numberValues.OtherCost.value = value;
          }
        });
      } catch {}
    }

    // Writes JSON into selectedRecord.OtherCostDesc (this is what MPulse persists)
    function writeOtherCostDescJSON(payload) {
      const jsonText = JSON.stringify(payload, null, 2);
      const block = `${JSON_START}\n${jsonText}\n${JSON_END}`;

      scope.$applyAsync(() => {
        scope.selectedRecord.OtherCostDesc = block;
      });

      statusEl.textContent = "Saved (live)";
      return true;
    }

    function readOtherCostDescJSON() {
      const raw = scope?.selectedRecord?.OtherCostDesc;
      if (!raw || typeof raw !== "string") return null;

      const match = raw.match(
        /<!-- OTHER_COST_JSON_START -->\s*([\s\S]*?)\s*<!-- OTHER_COST_JSON_END -->/
      );
      if (!match) return null;

      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.warn("⚠️ Other Cost JSON parse failed", e);
        return null;
      }
    }

    /* ------------------------------ TABLE MODEL ------------------------------ */

    function getRowsFromTable() {
      const rows = [];
      let grand = 0;

      wrap.querySelectorAll("#octTable tbody tr").forEach((tr) => {
        const type = tr.querySelector("select")?.value || "";
        const vendor = tr.querySelector('[data-col="vendor"]')?.value || "";
        const desc = tr.querySelector('[data-col="desc"]')?.value || "";
        const qty = +tr.querySelector('[data-col="qty"]')?.value || 0;
        const unit = +tr.querySelector('[data-col="unit"]')?.value || 0;
        const total = qty * unit;

        grand += total;

        rows.push({
          type,
          vendor,
          description: desc,
          quantity: qty,
          unitCost: unit,
          total: +total.toFixed(2),
        });
      });

      return { rows, grand: +grand.toFixed(2) };
    }

    function buildPayload() {
      const { rows, grand } = getRowsFromTable();
      return {
        schema: SCHEMA,
        currency: CURRENCY,
        grandTotal: grand,
        lineItems: rows,
        updatedAt: new Date().toISOString(),
      };
    }

    function addRow(item) {
      const tr = document.createElement("tr");

      const safe = (s) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const typeVal = item?.type && COST_TYPES.includes(item.type) ? item.type : COST_TYPES[0];
      const vendorVal = safe(item?.vendor || "");
      const descVal = safe(item?.description || "");
      const qtyVal = Number.isFinite(+item?.quantity) ? +item.quantity : 1;
      const unitVal = Number.isFinite(+item?.unitCost) ? +item.unitCost : 0;

      tr.innerHTML = `
        <td style="padding:4px;border-bottom:1px solid #eee;">
          <select style="width:100%;">
            ${COST_TYPES.map((t) => `<option ${t === typeVal ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </td>
        <td style="padding:4px;border-bottom:1px solid #eee;">
          <input data-col="vendor" style="width:100%;" value="${vendorVal}" />
        </td>
        <td style="padding:4px;border-bottom:1px solid #eee;">
          <input data-col="desc" style="width:100%;" value="${descVal}" />
        </td>
        <td style="padding:4px;border-bottom:1px solid #eee;">
          <input data-col="qty" type="number" min="0" step="1" style="width:70px;" value="${qtyVal}" />
        </td>
        <td style="padding:4px;border-bottom:1px solid #eee;">
          <input data-col="unit" type="number" min="0" step="0.01" style="width:90px;" value="${unitVal}" />
        </td>
        <td class="lineTotal" style="padding:4px;border-bottom:1px solid #eee;width:110px;">$0.00</td>
        <td style="padding:4px;border-bottom:1px solid #eee;text-align:center;">
          <button type="button" data-action="del" title="Delete">✕</button>
        </td>
      `;

      tbody.appendChild(tr);
    }

    function recalcAndPersist() {
      let total = 0;

      wrap.querySelectorAll("#octTable tbody tr").forEach((tr) => {
        const qty = +tr.querySelector('[data-col="qty"]')?.value || 0;
        const unit = +tr.querySelector('[data-col="unit"]')?.value || 0;
        const line = qty * unit;

        const cell = tr.querySelector(".lineTotal");
        if (cell) cell.textContent = `$${line.toFixed(2)}`;

        total += line;
      });

      const grand = +total.toFixed(2);
      totalEl.textContent = grand.toFixed(2);

      // Update numeric "Other Cost" field on the form
      setOtherCostDX(grand);

      // Live persist JSON into OtherCostDesc
      const payload = buildPayload();
      writeOtherCostDescJSON(payload);
    }

    /* ------------------------------ AUTO RESTORE ------------------------------ */

    function restoreOnce() {
      const saved = readOtherCostDescJSON();

      tbody.innerHTML = "";

      if (saved?.lineItems?.length) {
        saved.lineItems.forEach((it) => addRow(it));
        statusEl.textContent = "Restored";
      } else {
        addRow();
        statusEl.textContent = "New";
      }

      // After rows exist, calc totals + persist once so model becomes consistent
      recalcAndPersist();
    }

    /* ------------------------------ EVENTS ------------------------------ */

    wrap.addEventListener("click", (e) => {
      const t = e.target;

      if (t?.id === "octAdd") {
        e.preventDefault();
        addRow();
        recalcAndPersist();
        return;
      }

      if (t?.dataset?.action === "del") {
        e.preventDefault();
        t.closest("tr")?.remove();
        if (!tbody.querySelector("tr")) addRow();
        recalcAndPersist();
        return;
      }

      if (t?.id === "octPDF") {
        e.preventDefault();
        generateOtherCostPDF();
        return;
      }
    });

    // Any edit in the table triggers recalc + live persist
    wrap.addEventListener("input", (e) => {
      if (e.target && e.target.closest("#octTable")) {
        recalcAndPersist();
      }
    });

    /* ------------------------------ OPTIONAL SAVE HOOK (SAFETY NET) ------------------------------ */
    // Even though we live-write into Angular, we keep the Save hook as a last line of defense.
    (function bindSaveSafetyNet() {
      const btnEl = document.querySelector('.dx-button[actiontag="Save"], .dx-button[actionTag="Save"]');
      if (!btnEl || !window.DevExpress?.ui?.dxButton) return;

      const btn = DevExpress.ui.dxButton.getInstance(btnEl);
      if (!btn || btn.__otherCostLineItemsWrapped) return;
      btn.__otherCostLineItemsWrapped = true;

      const original = btn.option("onClick");

      btn.option("onClick", function () {
        try {
          // Ensure model has the latest snapshot right before save
          writeOtherCostDescJSON(buildPayload());
          statusEl.textContent = "Saved (pre-save)";
        } catch (e) {
          console.warn("⚠️ Save safety net failed", e);
        }
        return typeof original === "function" ? original.apply(this, arguments) : undefined;
      });

      console.log("🔗 Save safety net bound");
    })();

    /* ------------------------------ PDF EXPORT ------------------------------ */

    function generateOtherCostPDF() {
      if (!window.jspdf) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = generateOtherCostPDF;
        document.head.appendChild(s);
        return;
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();
      let y = 15;

      pdf.setFontSize(14);
      pdf.text("Other Cost Breakdown", 14, y);
      y += 10;

      pdf.setFontSize(10);
      pdf.text("Type", 14, y);
      pdf.text("Vendor", 46, y);
      pdf.text("Description", 92, y);
      pdf.text("Qty", 160, y);
      pdf.text("Total", 176, y);
      y += 4;
      pdf.line(14, y, 196, y);
      y += 6;

      const { rows, grand } = getRowsFromTable();

      rows.forEach((r) => {
        if (y > 270) {
          pdf.addPage();
          y = 15;
        }
        pdf.text(String(r.type || "").slice(0, 18), 14, y);
        pdf.text(String(r.vendor || "").slice(0, 18), 46, y);
        pdf.text(String(r.description || "").slice(0, 35), 92, y);
        pdf.text(String(r.quantity ?? ""), 160, y);
        pdf.text(`$${(+r.total || 0).toFixed(2)}`, 176, y);
        y += 6;
      });

      y += 4;
      pdf.line(14, y, 196, y);
      y += 8;
      pdf.setFontSize(12);
      pdf.text(`TOTAL OTHER COST: $${(+grand || 0).toFixed(2)}`, 14, y);

      pdf.save("Other_Cost_Breakdown.pdf");
    }

    /* ------------------------------ INIT ------------------------------ */

    // Restore AFTER we are fully attached to DOM + Angular model
    restoreOnce();

    console.log("✅ Other Cost Line Items injected");
  }
})();
