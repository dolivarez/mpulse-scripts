(function () {
  "use strict";

  const BUTTON_ID = "mpulse-create-request-btn";

  const ALLOWED = {
    EquipmentRecords: "Equipment Records",
    RoomRecords: "Room Records",
    BuildingRecords: "Building Records"
  };

  function getCurrentRecordType() {
    try {
      const root = angular.element(document.body).scope()?.$root;
      const subModule = String(root?.SubModuleName || "");

      if (ALLOWED[subModule]) {
        return ALLOWED[subModule];
      }

      if (subModule) {
        return null;
      }
    } catch (e) {}

    // Narrow fallback only.
    const candidates = [
      ...document.querySelectorAll("h1, h2, h3, .page-title")
    ].filter(el => {
      const style = getComputedStyle(el);

      return (
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    for (const el of candidates) {
      const text = (el.textContent || "").trim();

      if (text === "Equipment Records") {
        return "Equipment Records";
      }

      if (text === "Room Records") {
        return "Room Records";
      }

      if (text === "Building Records") {
        return "Building Records";
      }
    }

    return null;
  }

  function getRecordScope() {
    const matches = [...document.querySelectorAll(".ng-scope")]
      .map(el => ({
        el,
        scope: angular.element(el).scope()
      }))
      .filter(x =>
        typeof x.scope?.moreProcedureClick === "function" &&
        x.scope?.selectedRecord
      );

    return (
      matches.find(x =>
        Object.prototype.hasOwnProperty.call(
          x.scope,
          "selectedRecord"
        )
      )?.scope ||
      matches[0]?.scope ||
      null
    );
  }

  function createRequest() {
    const recordType = getCurrentRecordType();

    if (!recordType) {
      console.warn(
        "[Create Request] Not on an allowed record type."
      );
      return;
    }

    const scope = getRecordScope();

    if (!scope) {
      console.warn(
        "[Create Request] Record scope not found."
      );
      return;
    }

    const link = document.createElement("a");

    link.setAttribute("viewtypes", "CreateMR");
    link.setAttribute("actiontag", "CreateMR");
    link.setAttribute("title", "Create Request");

    scope.moreProcedureClick({
      target: link,
      currentTarget: link,
      preventDefault() {},
      stopPropagation() {}
    });
  }

  function removeButton() {
    document.getElementById(BUTTON_ID)?.remove();
  }

  function findButtonTarget() {
    return document.querySelector("ul.itemDetailActionBtns");
  }
  
  function syncButton() {
    const recordType = getCurrentRecordType();
  
    if (!recordType) {
      removeButton();
      return;
    }
  
    if (!getRecordScope()) {
      removeButton();
      return;
    }
  
    if (document.getElementById(BUTTON_ID)) {
      return;
    }
  
    const target = findButtonTarget();
  
    if (!target) {
      removeButton();
      return;
    }
  
    // Create a native-style toolbar <li>
    const item = document.createElement("li");
  
    item.id = BUTTON_ID;
    item.title = "Create Request";
    item.style.listStyle = "none";
  
    const wrapper = document.createElement("div");
    wrapper.className = "icon_target";
  
    const link = document.createElement("a");
    link.className = "right";
    link.href = "";
    link.title = "Create Request";
    link.setAttribute("aria-label", "Create Request");
  
    const span = document.createElement("span");
  
    const icon = document.createElement("i");
    icon.className = "far fa-file-alt";
    icon.setAttribute("aria-hidden", "true");
  
    span.appendChild(icon);
    link.appendChild(span);
    wrapper.appendChild(link);
    item.appendChild(wrapper);
  
    link.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      createRequest();
    });
  
    /*
     * Put Create Request immediately before the
     * native More/Procedures dropdown.
     */
    const dropdown = target.querySelector(".scheduled_dropdown");
    const dropdownItem = dropdown?.closest("li");
  
    if (dropdownItem) {
      target.insertBefore(item, dropdownItem);
    } else {
      target.prepend(item);
    }
  
    console.log(
      `[Create Request] Added on ${recordType}`
    );
  }

  // Clean up anything left by an older test.
  removeButton();

  // Initial render.
  syncButton();

  // MPulse SPA navigation/render monitoring.
  let pending = false;

  const observer = new MutationObserver(() => {
    if (pending) return;

    pending = true;

    requestAnimationFrame(() => {
      pending = false;
      syncButton();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log(
    "[Create Request] Injector active for Equipment, Room, and Building Records."
  );
})();
