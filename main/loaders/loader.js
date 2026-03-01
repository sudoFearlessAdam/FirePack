(function () {

    if (window.__FirePackLoaderInitialized) return;
    window.__FirePackLoaderInitialized = true;

    const { Services } = globalThis;
    const Ci = Components.interfaces;
    const Cc = Components.classes;

    const FirePackModules = Object.create(null);

    function registerModule(name, exports) {
        if (!name || typeof exports !== "object") {
            console.error("FirePack: Invalid module registration.");
            return;
        }

        if (FirePackModules[name]) {
            console.warn(`FirePack: Module "${name}" already exists.`);
            return;
        }

        FirePackModules[name] = Object.freeze(exports);
    }

    window.FirePack = {
        registerModule,
        modules: FirePackModules
    };

    function loadCoreDirectory(dir, label) {

        if (!dir.exists() || !dir.isDirectory()) return;

        let entries = dir.directoryEntries;

        while (entries.hasMoreElements()) {

            let file = entries.getNext().QueryInterface(Ci.nsIFile);

            if (!file.isFile() || !file.leafName.endsWith(".js"))
                continue;

            try {
                let uri = Services.io.newFileURI(file).spec;
                Services.scriptloader.loadSubScript(uri, window);
                console.log(`FirePack Core ${label} → ${file.leafName}`);
            } catch (e) {
                console.error(`FirePack Core ${label} Failed → ${file.leafName}`, e);
            }
        }
    }

    function loadCore() {

        let coreDir = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsIFile);

        coreDir.initWithPath("C:\\ProgramData\\FirePack\\core");

        if (!coreDir.exists() || !coreDir.isDirectory()) {
            console.warn("FirePack: No core directory found.");
            return;
        }

        let scriptModulesDir = coreDir.clone();
        scriptModulesDir.append("script_modules");
        loadCoreDirectory(scriptModulesDir, "ScriptModule");

        let internalsDir = coreDir.clone();
        internalsDir.append("internals");
        loadCoreDirectory(internalsDir, "Internal");
    }
	
    function loadPacks() {

        let chromeDir = Services.dirsvc.get("UChrm", Ci.nsIFile);
        chromeDir.append("firepack");

        if (!chromeDir.exists() || !chromeDir.isDirectory()) {
            console.log("FirePack: No firepack folder found.");
            return;
        }

        let entries = chromeDir.directoryEntries;

        while (entries.hasMoreElements()) {

            let packDir = entries.getNext().QueryInterface(Ci.nsIFile);
            if (!packDir.isDirectory()) continue;

            let manifestFile = packDir.clone();
            manifestFile.append("pack.json");

            let mainFile = packDir.clone();
            mainFile.append("main.js");

            if (!manifestFile.exists() || !mainFile.exists()) {
                console.warn("FirePack: Invalid pack →", packDir.leafName);
                continue;
            }

            try {

                let data = Services.io.newFileURI(manifestFile).spec;
                let xhr = new XMLHttpRequest();
                xhr.open("GET", data, false);
                xhr.send(null);

                let manifest = JSON.parse(xhr.responseText);

                if (manifest.enabled === false) {
                    console.log("FirePack: Pack disabled →", manifest.name);
                    continue;
                }

                let packScope = new Components.utils.Sandbox(window, {
                    wantComponents: true,
                    wantGlobalProperties: ["ChromeUtils"]
                });

                packScope.FirePack = {
                    modules: window.FirePack.modules,

                    loadScript(relativePath) {
                        let file = packDir.clone();
                        file.appendRelativePath(relativePath);
                        if (!file.exists()) return;

                        let uri = Services.io.newFileURI(file).spec;
                        Services.scriptloader.loadSubScript(uri, packScope);
                    },

                    loadCSS(relativePath) {
                        let file = packDir.clone();
                        file.appendRelativePath(relativePath);
                        if (!file.exists()) return;

                        let uri = Services.io.newFileURI(file).spec;

                        let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                            .getService(Ci.nsIStyleSheetService);

                        let cssURI = Services.io.newURI(uri);

                        if (!sss.sheetRegistered(cssURI, sss.AGENT_SHEET)) {
                            sss.loadAndRegisterSheet(cssURI, sss.AGENT_SHEET);
                        }
                    }
                };

                let mainURI = Services.io.newFileURI(mainFile).spec;
                Services.scriptloader.loadSubScript(mainURI, packScope);

                console.log(`FirePack: Loaded pack → ${manifest.name} v${manifest.version}`);

            } catch (err) {
                console.error("FirePack: Failed pack →", packDir.leafName, err);
            }
        }
    }

    function bootstrap() {
        loadCore();
        loadPacks();
    }

    if (document.readyState === "complete") {
        bootstrap();
    } else {
        window.addEventListener("load", bootstrap, { once: true });
    }

})();