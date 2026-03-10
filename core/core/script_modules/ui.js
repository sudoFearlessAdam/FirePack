FirePack.registerModule("ui", (function () {

    const { Services } = globalThis;
    const Ci = Components.interfaces;

    function resolveIcon(path) {
        if (!path) return null;

        if (path.startsWith("file:///") || path.startsWith("chrome://"))
            return path;

        let file = Services.dirsvc.get("UChrm", Ci.nsIFile);
        file.append(path);

        if (!file.exists())
            return null;

        return Services.io.newFileURI(file).spec;
    }

    function waitForAppMenuReady(callback) {
        const panel = document.getElementById("appMenu-popup");
        if (!panel) return;

        panel.addEventListener("popupshowing", function onShow() {
            panel.removeEventListener("popupshowing", onShow);
            callback();
        }, { once: true });
    }

    return {

        createButton(location, {
            id,
            icon,
            label = "",
            onClick,
            onCreate
        }) {

            if (document.getElementById(id)) return;

            const btn = document.createXULElement("toolbarbutton");

            btn.id = id;
            btn.className = "toolbarbutton-1 chromeclass-toolbar-additional";
            btn.setAttribute("label", label);
            btn.setAttribute("tooltiptext", label);
            btn.setAttribute("removable", "true");

            const iconURL = resolveIcon(icon);
            if (iconURL)
                btn.setAttribute("image", iconURL);

            btn.addEventListener("click", (event) => {
                if (event.button !== 0) return;
                if (typeof onClick === "function")
                    onClick(btn);
            });

            let container = null;

            if (location === "toolbar")
                container = document.getElementById("nav-bar");

            if (location === "sidebar")
                container = document.getElementById("sidebar-box");

            if (!container)
                return;

            container.appendChild(btn);

            if (typeof onCreate === "function")
                onCreate(btn);

            return btn;
        },
		
        showMenu(anchorButton, items) {

            const popupSet = document.getElementById("mainPopupSet");
            if (!popupSet) {
                console.error("FirePack UI: mainPopupSet not found.");
                return;
            }

            const popup = document.createXULElement("menupopup");

            for (const item of items) {

                if (item.separator) {
                    popup.appendChild(document.createXULElement("menuseparator"));
                    continue;
                }

                const menuitem = document.createXULElement("menuitem");
                menuitem.setAttribute("label", item.label);

                if (item.type === "radio") {
                    menuitem.setAttribute("type", "radio");
                    if (item.checked)
                        menuitem.setAttribute("checked", "true");
                }

                menuitem.addEventListener("command", () => {
                    if (typeof item.action === "function")
                        item.action();
                });

                popup.appendChild(menuitem);
            }

            popupSet.appendChild(popup);

            popup.addEventListener("popuphidden", () => {
                popup.remove();
            }, { once: true });

            popup.openPopup(anchorButton, "after_end");
        },

        createAppMenuButton({
            id,
            label,
            icon,
            onClick,
            onCreate,
            subview
        }) {

            waitForAppMenuReady(() => {

                const mainView = document.getElementById("appMenu-mainView");
                if (!mainView) {
                    console.error("FirePack UI: appMenu-mainView not found.");
                    return;
                }

                if (document.getElementById(id))
                    return;

                const container = mainView.querySelector(".panel-subview-body");
                if (!container) {
                    console.error("FirePack UI: panel-subview-body not found.");
                    return;
                }

                const button = document.createXULElement("toolbarbutton");

                button.id = id;
                button.className = subview
                    ? "subviewbutton subviewbutton-nav"
                    : "subviewbutton";

                button.setAttribute("label", label);

                const iconURL = resolveIcon(icon);
                if (iconURL)
                    button.setAttribute("image", iconURL);

                if (subview && typeof subview === "string") {

                    button.addEventListener("mousedown", (event) => {
                        if (event.button !== 0) return;

                        event.preventDefault();
                        event.stopPropagation();

                        PanelUI.showSubView(subview, button);
                    });

                } else {

                    button.addEventListener("command", () => {
                        if (typeof onClick === "function")
                            onClick(button);
                    });
                }

                container.appendChild(button);

                if (typeof onCreate === "function")
                    onCreate(button);
            });
        }
    };
})());