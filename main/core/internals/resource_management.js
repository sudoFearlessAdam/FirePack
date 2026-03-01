(function () {

    if (window.__firepackResourceController) return;
    window.__firepackResourceController = true;

    const { Services } = globalThis;

    function getConfig() { return FirePack.modules.config; }
    function getUI() { return FirePack.modules.ui; }

    const Configs = getConfig();
    const UI = getUI();

    if (!Configs.exists("firepack.resource.mode")) {
        Configs.create("firepack.resource.mode", "balanced");
    }

    function applyMode(mode) {

        switch (mode) {

            case "performance":
                Services.prefs.setIntPref("dom.ipc.processCount", 8);
                Services.prefs.setBoolPref("browser.tabs.unloadOnLowMemory", false);
                Services.prefs.setIntPref("image.mem.max_decoded_image_kb", 1024000);
                Services.prefs.setBoolPref("browser.cache.disk.enable", true);
                break;

            case "low":
                Services.prefs.setIntPref("dom.ipc.processCount", 2);
                Services.prefs.setBoolPref("browser.tabs.unloadOnLowMemory", true);
                Services.prefs.setIntPref("image.mem.max_decoded_image_kb", 256000);
                Services.prefs.setBoolPref("browser.cache.disk.enable", false);
                break;

            default:
                Services.prefs.setIntPref("dom.ipc.processCount", 4);
                Services.prefs.setBoolPref("browser.tabs.unloadOnLowMemory", true);
                Services.prefs.setIntPref("image.mem.max_decoded_image_kb", 512000);
                Services.prefs.setBoolPref("browser.cache.disk.enable", false);
                break;
        }

        Configs.edit("firepack.resource.mode", mode);
        console.log("FirePack: Resource mode →", mode);

        const mainButton = document.getElementById("firepack-resource-button");
        if (mainButton) {
            mainButton.setAttribute("label", `Resource Mode (${prettyMode(mode)})`);
        }
    }

    function prettyMode(mode) {
        return mode === "performance" ? "Performance" :
               mode === "low" ? "Low Memory" :
               "Balanced";
    }

    applyMode(Configs.get("firepack.resource.mode"));

    function ensureSubviewExists() {

        if (document.getElementById("firepack-resource-subview"))
            return;

        const subview = document.createXULElement("panelview");
        subview.id = "firepack-resource-subview";

        const body = document.createXULElement("vbox");
        body.className = "panel-subview-body";

        function createItem(label, modeValue) {

            const item = document.createXULElement("toolbarbutton");
            item.className = "subviewbutton";
            item.setAttribute("type", "radio");
            item.setAttribute("label", label);

            if (Configs.get("firepack.resource.mode") === modeValue) {
                item.setAttribute("checked", "true");
            }

            item.addEventListener("command", () => {

                body.querySelectorAll('toolbarbutton[type="radio"]').forEach(btn => {
                    btn.removeAttribute("checked");
                });

                item.setAttribute("checked", "true");

                applyMode(modeValue);
            });

            return item;
        }

        body.appendChild(createItem("🔥 Performance Mode", "performance"));
        body.appendChild(createItem("⚖ Balanced Mode", "balanced"));
        body.appendChild(createItem("💾 Low Memory Mode", "low"));

        subview.appendChild(body);

        document.getElementById("appMenu-multiView")
            .appendChild(subview);
    }

    ensureSubviewExists();

    UI.createAppMenuButton({
        id: "firepack-resource-button",
        label: `Resource Mode (${prettyMode(Configs.get("firepack.resource.mode"))})`,
        subview: "firepack-resource-subview"
    });

})();