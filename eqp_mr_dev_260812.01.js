(function () {
  "use strict";

  const SCRIPT_VERSION = "0.2.0";

  const BUTTON_ID = "toolbarCreateRequestButton";
  const BUTTON_TITLE = "Create Request";

  const ACTION_MENU_SELECTOR =
    ".action-menu-items ul.itemDetailActionBtns";

  const ALLOWED = {
    EquipmentRecords: "Equipment Records",
    RoomRecords: "Room Records",
    BuildingRecords: "Building Records"
  };

  function log(...args) {
    console.log(
      `[${BUTTON_ID} v${SCRIPT_VERSION}]`,
      ...args
    );
  }

  function getCurrentRecordType() {
    try {
      const root =
        angular.element(document.body).scope()?.$root;

      const subModule =
        String(root?.SubModuleName || "");

      return ALLOWED[subModule] || null;

    } catch (err) {
      return null;
    }
  }

  function getRecordScope() {
    const matches = [
      ...document.querySelectorAll(".ng-scope")
    ]
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
        "[Create Request] Unsupported record type."
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

    link.setAttribute(
      "viewtypes",
      "CreateMR"
    );

    link.setAttribute(
      "actiontag",
      "CreateMR"
    );

    link.setAttribute(
      "title",
      "Create Request"
    );

    scope.moreProcedureClick({
      target: link,
      currentTarget: link,

      preventDefault() {},

      stopPropagation() {}
    });
  }

  function createButton() {
    const button =
      document.createElement("button");

    button.type = "button";
    button.id = BUTTON_ID;
    button.title = BUTTON_TITLE;

    button.setAttribute(
      "aria-label",
      BUTTON_TITLE
    );

    button.innerHTML =
      `<i class="far fa-file-alt"
          aria-hidden="true"></i>`;

    /*
     * Match the working Equipment Email button.
     */
    button.style.setProperty(
      "display",
      "inline-flex",
      "important"
    );

    button.style.setProperty(
      "align-items",
      "center",
      "important"
    );

    button.style.setProperty(
      "justify-content",
      "center",
      "important"
    );

    button.style.setProperty(
      "width",
      "24px",
      "important"
    );

    button.style.setProperty(
      "height",
      "24px",
      "important"
    );

    button.style.setProperty(
      "min-width",
      "24px",
      "important"
    );

    button.style.setProperty(
      "min-height",
      "24px",
      "important"
    );

    button.style.setProperty(
      "padding",
      "0",
      "important"
    );

    button.style.setProperty(
      "margin",
      "0",
      "important"
    );

    button.style.setProperty(
      "background",
      "transparent",
      "important"
    );

    button.style.setProperty(
      "background-color",
      "transparent",
      "important"
    );

    button.style.setProperty(
      "border",
      "none",
      "important"
    );

    button.style.setProperty(
      "border-radius",
      "0",
      "important"
    );

    button.style.setProperty(
      "box-shadow",
      "none",
      "important"
    );

    button.style.setProperty(
      "outline",
      "none",
      "important"
    );

    button.style.setProperty(
      "appearance",
      "none",
      "important"
    );

    button.style.setProperty(
      "-webkit-appearance",
      "none",
      "important"
    );

    button.style.setProperty(
      "cursor",
      "pointer",
      "important"
    );

    button.style.setProperty(
      "color",
      "#666",
      "important"
    );

    button.style.setProperty(
      "line-height",
      "1",
      "important"
    );

    button.style.setProperty(
      "font-size",
      "0",
      "important"
    );

    button.style.setProperty(
      "vertical-align",
      "middle",
      "important"
    );

    const icon =
      button.querySelector("i");

    icon.style.setProperty(
      "font-size",
      "15px",
      "important"
    );

    icon.style.setProperty(
      "line-height",
      "1",
      "important"
    );

    icon.style.setProperty(
      "display",
      "inline-block",
      "important"
    );

    icon.style.setProperty(
      "margin",
      "0",
      "important"
    );

    icon.style.setProperty(
      "padding",
      "0",
      "important"
    );

    icon.style.setProperty(
      "color",
      "#666",
      "important"
    );

    icon.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

    button.addEventListener(
      "mouseenter",
      () => {
        icon.style.setProperty(
          "color",
          "#0078d7",
          "important"
        );
      }
    );

    button.addEventListener(
      "mouseleave",
      () => {
        icon.style.setProperty(
          "color",
          "#666",
          "important"
        );
      }
    );

    button.addEventListener(
      "click",
      evt => {
        evt.preventDefault();
        evt.stopPropagation();

        createRequest();
      }
    );

    return button;
  }

  function removeButton() {
    document
      .querySelectorAll(
        `#${BUTTON_ID}`
      )
      .forEach(button => {
        button.closest("li")?.remove();
      });
  }

  function injectButton() {
    const recordType =
      getCurrentRecordType();

    /*
     * Remove it when leaving an allowed
     * record module.
     */
    if (!recordType) {
      removeButton();
      return false;
    }

    /*
     * Require an actual current record.
     */
    if (!getRecordScope()) {
      removeButton();
      return false;
    }

    const actionMenu =
      document.querySelector(
        ACTION_MENU_SELECTOR
      );

    if (!actionMenu) {
      return false;
    }

    /*
     * Already injected into current menu.
     */
    const existing =
      document.getElementById(
        BUTTON_ID
      );

    if (existing) {
      if (
        actionMenu.contains(existing)
      ) {
        return true;
      }

      existing.closest("li")?.remove();
    }

    const li =
      document.createElement("li");

    li.dataset.createRequestItem = "true";

    li.style.setProperty(
      "list-style",
      "none",
      "important"
    );

    li.style.setProperty(
      "margin",
      "0 6px 0 0",
      "important"
    );

    li.style.setProperty(
      "padding",
      "0",
      "important"
    );

    li.style.setProperty(
      "display",
      "inline-flex",
      "important"
    );

    li.style.setProperty(
      "align-items",
      "center",
      "important"
    );

    li.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    li.appendChild(
      createButton()
    );

    /*
     * Put Create Request immediately
     * before Email when available.
     */
    const emailButton =
      actionMenu.querySelector(
        "#toolbarEquipmentEmailButton"
      );

    const emailItem =
      emailButton?.closest("li");

    if (emailItem) {
      actionMenu.insertBefore(
        li,
        emailItem
      );
    } else {
      actionMenu.appendChild(li);
    }

    log(
      `Injected on ${recordType}`
    );

    return true;
  }

  function sync() {
    injectButton();
  }

  /*
   * Initial injection.
   */
  sync();

  /*
   * MPulse is an SPA, so continue checking as
   * the active record/module is re-rendered.
   */
  let pending = false;

  const observer =
    new MutationObserver(() => {
      if (pending) return;

      pending = true;

      requestAnimationFrame(() => {
        pending = false;
        sync();
      });
    });

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  log(
    "Injector active for Equipment, Room, and Building Records."
  );
})();
