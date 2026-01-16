(function () {
  console.log("🧾 Injecting Other Cost Line Item Table (v1.4 modal-safe)");

  /* ======================================================================
     1️⃣ GUARD / ENTRY CONDITIONS
     ====================================================================== */

  // Prevent double injection (MPulse modals re-render)
  if (document.getElementById("otherCostTableWrap")) {
    console.warn("otherCostTableWrap already exists — skipping inject.");
    return;
  }

  // Anchor field
  const desc = document.querySelector("#OtherCostDescription");
  if (!desc) {
    console.warn("Other Cost Description not found");
    return;
  }

  /* ======================================================================
     2️⃣ UI INJECTION
     ====================================================================== */

  const wrap = document.createElement("div");
  wrap.id = "otherCostTableWrap";
  Object.assign(wrap.style, {
    border: "1px solid #ccc",
    padding: "8px",
    marginBottom: "10px",
    background: "#fafafa"
  });

  wrap.innerHTML = `
    <h4 style="margin-top:0">Other Cost – Line Items</h4>

    <table id="octTable" style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          <th>Type</th>
          <th>Vendor</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <div style="margin-top:6px">
      <button id="octAdd" type="button">+ Add Line</button>
      <button id="octPDF" type="button">Generate PDF Snapshot</button>
    </div>

    <div style="margin-top:6px;font-weight:bold">
      Total: $<span id="octTotal">0.00</span>
    </div>
  `;

  desc.closest(".form-group").prepend(wrap);

  /* ======================================================================
     3️⃣ CONSTANTS / CONFIG
     ====================================================================== */

  const costTypes = [
    "Vendor Service",
    "Contractor Labor",
    "Freight",
    "Materials (Non-Inventory)",
    "Calibration",
    "Waste / Disposal",
    "Travel",
    "Regulatory",
    "Miscellaneous"
  ];

  /* ======================================================================
     4️⃣ MPULSE FIELD BINDINGS
     ====================================================================== */

  function setOtherCostDX(value) {
    const boxEl = document.querySelector(
      "#OtherCost.dx-numberbox, [fieldname='OtherCost'].dx-numberbox"
    );
    if (!boxEl || !window.DevExpress?.ui?.dxNumberBox) return;

    const instance = DevExpress.ui.dxNumberBox.getInstance(boxEl);
    if (!instance) return;

    instance.option("value", value);

    const scope =
      angular.element(boxEl).scope() ||
      angular.element(boxEl).isolateScope();

    scope?.$applyAsync(() => {
      scope.$root?.numberValues?.OtherCost &&
        (scope.$root.numberValues.OtherCost.value = value);
    });
  }

  function writeOtherCostJSON(payload) {
    const container =
      document.querySelector("#OtherCostDescription") ||
      document.querySelector('[fieldname="OtherCostDesc"]');
  
    if (!container || !window.angular) {
      console.warn("❌ OtherCostDesc container not found");
      return false;
    }
  
    const scope =
      angular.element(container).scope() ||
      angular.element(container).isolateScope();
  
    if (!scope?.selectedRecord) {
      console.warn("❌ selectedRecord not found");
      return false;
    }
  
    const jsonBlock =
  `<!-- OTHER_COST_JSON_START -->
  ${JSON.stringify(payload, null, 2)}
  <!-- OTHER_COST_JSON_END -->`;
  
    scope.$applyAsync(() => {
      scope.selectedRecord.OtherCostDesc = jsonBlock;
    });
  
    console.log("✅ OtherCostDesc written to Angular model");
    return true;
  }

  function updateOtherCostModel(payload) {
    const container =
      document.querySelector("#OtherCostDescription") ||
      document.querySelector('[fieldname="OtherCostDesc"]');
  
    if (!container || !window.angular) return;
  
    const scope =
      angular.element(container).scope() ||
      angular.element(container).isolateScope();
  
    if (!scope?.selectedRecord) return;
  
    const jsonBlock =
  `<!-- OTHER_COST_JSON_START -->
  ${JSON.stringify(payload, null, 2)}
  <!-- OTHER_COST_JSON_END -->`;
  
    scope.$applyAsync(() => {
      scope.selectedRecord.OtherCostDesc = jsonBlock;
    });
  
    console.log("💾 OtherCostDesc updated (live)");
  }

  function buildOtherCostPayload() {
    const rows = [];
    let grand = 0;
  
    document.querySelectorAll("#octTable tbody tr").forEach(tr => {
      const qty = +tr.querySelector('[data-col="qty"]').value || 0;
      const unit = +tr.querySelector('[data-col="unit"]').value || 0;
      const total = qty * unit;
      grand += total;
  
      rows.push({
        type: tr.querySelector("select").value,
        vendor: tr.querySelector('[data-col="vendor"]').value,
        description: tr.querySelector('[data-col="desc"]').value,
        quantity: qty,
        unitCost: unit,
        total: +total.toFixed(2)
      });
    });
  
    return {
      schema: "other-cost.v1",
      currency: "USD",
      grandTotal: +grand.toFixed(2),
      lineItems: rows,
      updatedAt: new Date().toISOString()
    };
  }


  function readOtherCostJSON() {
    // CKEditor may or may not be active yet — read from Angular model instead
    const container =
      document.querySelector("#OtherCostDescription") ||
      document.querySelector('[fieldname="OtherCostDesc"]');
  
    if (!container || !window.angular) return null;
  
    const scope =
      angular.element(container).scope() ||
      angular.element(container).isolateScope();
  
    const raw = scope?.selectedRecord?.OtherCostDesc;
    if (!raw || typeof raw !== "string") return null;
  
    const match = raw.match(
      /<!-- OTHER_COST_JSON_START -->\s*([\s\S]*?)\s*<!-- OTHER_COST_JSON_END -->/
    );
  
    if (!match) return null;
  
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn("❌ Failed to parse Other Cost JSON", e);
      return null;
    }
  }

  function restoreTableFromJSON(payload) {
    if (!payload?.lineItems || !Array.isArray(payload.lineItems)) return;
  
    const tbody = document.querySelector("#octTable tbody");
    if (!tbody) return;
  
    // Clear existing rows
    tbody.innerHTML = "";
  
    payload.lineItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <select>
            ${costTypes.map(t =>
              `<option ${t === item.type ? "selected" : ""}>${t}</option>`
            ).join("")}
          </select>
        </td>
        <td><input data-col="vendor" value="${item.vendor || ""}" style="width:100%"></td>
        <td><input data-col="desc" value="${item.description || ""}" style="width:100%"></td>
        <td><input data-col="qty" type="number" value="${item.quantity || 0}" min="0" style="width:60px"></td>
        <td><input data-col="unit" type="number" value="${item.unitCost || 0}" step="0.01" style="width:80px"></td>
        <td class="lineTotal">$0.00</td>
        <td><button data-action="del" type="button">✕</button></td>
      `;
      tbody.appendChild(tr);
    });
  
    // Recalculate totals + bind Other Cost field
    recalc();
  }


  function autoRestoreOtherCostTable() {
    const payload = readOtherCostJSON();
  
    if (!payload) {
      console.log("ℹ No existing Other Cost JSON — starting fresh");
      return false;
    }
  
    restoreTableFromJSON(payload);
    console.log("✅ Other Cost table restored from JSON");
    return true;
  }

  function waitForOtherCostData(cb, timeout = 5000) {
    const start = Date.now();
  
    const check = () => {
      const container =
        document.querySelector("#OtherCostDescription") ||
        document.querySelector('[fieldname="OtherCostDesc"]');
  
      if (container && window.angular) {
        const scope =
          angular.element(container).scope() ||
          angular.element(container).isolateScope();
  
        const data = scope?.selectedRecord?.OtherCostDesc;
  
        if (typeof data === "string") {
          cb(data);
          return;
        }
      }
  
      if (Date.now() - start > timeout) {
        console.warn("⏱ OtherCostDesc not available for restore");
        cb(null);
        return;
      }
  
      requestAnimationFrame(check);
    };
  
    check();
  }

  function parseOtherCostJSON(raw) {
    if (!raw) return null;
  
    const match = raw.match(
      /<!-- OTHER_COST_JSON_START -->\s*([\s\S]*?)\s*<!-- OTHER_COST_JSON_END -->/
    );
  
    if (!match) return null;
  
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn("❌ Invalid Other Cost JSON", e);
      return null;
    }
  }

  function restoreOtherCostTableOnce() {
    if (restoreOtherCostTableOnce.done) return;
    restoreOtherCostTableOnce.done = true;
  
    waitForOtherCostData(raw => {
      const payload = parseOtherCostJSON(raw);
  
      if (payload?.lineItems?.length) {
        restoreTableFromJSON(payload);
        console.log("✅ Other Cost table restored from JSON");
      } else {
        addRow(); // first-time use
        recalc();
        console.log("ℹ No saved JSON — starting fresh");
      }
    });
  }












  /* ======================================================================
     5️⃣ TABLE LOGIC (ROWS + TOTALS)
     ====================================================================== */

  function addRow() {
    const tbody = document.querySelector("#octTable tbody");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <select>
          ${costTypes.map(t => `<option>${t}</option>`).join("")}
        </select>
      </td>
      <td><input data-col="vendor" style="width:100%"></td>
      <td><input data-col="desc" style="width:100%"></td>
      <td><input data-col="qty" type="number" value="1" min="0" style="width:60px"></td>
      <td><input data-col="unit" type="number" value="0" step="0.01" style="width:80px"></td>
      <td class="lineTotal">$0.00</td>
      <td><button data-action="del" type="button">✕</button></td>
    `;

    tbody.appendChild(tr);
    recalc();
  }

  function recalc() {
    let total = 0;
  
    document.querySelectorAll("#octTable tbody tr").forEach(tr => {
      const qty = +tr.querySelector('[data-col="qty"]').value || 0;
      const unit = +tr.querySelector('[data-col="unit"]').value || 0;
      const line = qty * unit;
  
      tr.querySelector(".lineTotal").innerText = `$${line.toFixed(2)}`;
      total += line;
    });
  
    document.getElementById("octTotal").innerText = total.toFixed(2);
    setOtherCostDX(total);
  
    // ✅ LIVE JSON WRITE
    updateOtherCostModel(buildOtherCostPayload());
  }


  /* ======================================================================
     6️⃣ PDF EXPORT
     ====================================================================== */

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

    pdf.text("Other Cost Breakdown", 14, y);
    y += 10;

    document.querySelectorAll("#octTable tbody tr").forEach(tr => {
      const desc = tr.querySelector('[data-col="desc"]').value || "";
      const line = tr.querySelector(".lineTotal").innerText;
      pdf.text(`${desc} — ${line}`, 14, y);
      y += 6;
    });

    pdf.save("Other_Cost_Breakdown.pdf");
  }

  /* ======================================================================
     7️⃣ EVENT DELEGATION
     ====================================================================== */

  wrap.addEventListener("click", e => {
    if (e.target.id === "octAdd") return addRow();
    if (e.target.id === "octPDF") return generateOtherCostPDF();
    if (e.target.dataset.action === "del") {
      e.target.closest("tr")?.remove();
      recalc();
    }
  });

  wrap.addEventListener("input", e => {
    if (e.target.closest("#octTable")) recalc();
  });

  /* ======================================================================
     8️⃣ SAVE HOOK (MPULSE)
     ====================================================================== */

  (function bindSave() {
    const btnEl = document.querySelector(
      '.dx-button[actiontag="Save"], .dx-button[actionTag="Save"]'
    );
    if (!btnEl || !window.DevExpress?.ui?.dxButton) return;

    const btn = DevExpress.ui.dxButton.getInstance(btnEl);
    if (btn.__otherCostWrapped) return;
    btn.__otherCostWrapped = true;

    const original = btn.option("onClick");

    btn.option("onClick", function () {
      const rows = [];
      let grand = 0;

      document.querySelectorAll("#octTable tbody tr").forEach(tr => {
        const qty = +tr.querySelector('[data-col="qty"]').value || 0;
        const unit = +tr.querySelector('[data-col="unit"]').value || 0;
        const total = qty * unit;
        grand += total;

        rows.push({
          type: tr.querySelector("select").value,
          vendor: tr.querySelector('[data-col="vendor"]').value,
          description: tr.querySelector('[data-col="desc"]').value,
          quantity: qty,
          unitCost: unit,
          total: +total.toFixed(2)
        });
      });

      writeOtherCostJSON({
        schema: "other-cost.v1",
        currency: "USD",
        grandTotal: +grand.toFixed(2),
        lineItems: rows,
        savedAt: new Date().toISOString()
      });

      return original?.apply(this, arguments);
    });
  })();

  /* ======================================================================
     9️⃣ INITIALIZATION
     ====================================================================== */

  restoreOtherCostTableOnce();


  console.log("✅ Other Cost Table injected");
})();
