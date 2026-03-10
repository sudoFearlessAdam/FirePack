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
	
	let profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
	profileDir.append("chrome");
	profileDir.append("firepack");
	
	let resProto = Services.io.getProtocolHandler("resource")
	.QueryInterface(Ci.nsIResProtocolHandler);
	
	let uri = Services.io.newFileURI(profileDir);
	uri = Services.io.newURI(uri.spec + "/");
	
	resProto.setSubstitution("firepack", uri);
	
	function injectGlobals(target) {
		target.console = target.console || {
			log: (...args) => Services.console.logStringMessage("[Pack] " + args.join(" ")),
			warn: (...args) => Services.console.logStringMessage("[Pack] " + args.join(" ")),
			error: (...args) => Services.console.logStringMessage("[Pack] " + args.join(" "))
		};
		
		target.Services = Services;
		target.Cc = Components.classes;
		target.Ci = Components.interfaces;
		target.Cu = Components.utils;
		
		if (!target.Audio) {
			target.Audio = function(filePath) {
				this.play = () => {
					const sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
					const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
					file.initWithPath(filePath);
					sound.play(file);
				};
			};
		}
		
		if (!target.fetch) target.fetch = (...args) => Cu.evalInSandbox(`fetch(...args)`, window);
		if (!target.setTimeout) target.setTimeout = window.setTimeout;
		if (!target.setInterval) target.setInterval = window.setInterval;
	}
	
    window.FirePack = {
        registerModule,
        modules: FirePackModules,
		registerFont,
		applyUIFont,
		applyWebFont,
		runExecutable
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
				
				let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
				.createInstance(Ci.nsIFileInputStream);
				fstream.init(manifestFile, 0x01, 0, 0);
				
				let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"]
				.createInstance(Ci.nsIConverterInputStream);
				cstream.init(fstream, "UTF-8", 0, 0);
				
				let data = "";
				let str = {};
				
				while (cstream.readString(0xffffffff, str) !== 0) {
					data += str.value;
				}
				
				cstream.close();
				
				let manifest = JSON.parse(data);
				
				if (manifest.enabled === false) {
					console.log("FirePack: Pack disabled →", manifest.name);
					continue;
				}
				
				injectGlobals(window);
				
				window.FirePack.root = packDir.clone();
				window.FirePack.loadScript = function(relativePath) {
					let file = packDir.clone();
					relativePath.split(/[\\/]/).forEach(p => { if (p) file.append(p); });
					if (!file.exists()) return;
					Services.scriptloader.loadSubScript(Services.io.newFileURI(file).spec, window);
				};
				window.FirePack.loadCSS = function(relativePath) {
					let file = packDir.clone();
					relativePath.split(/[\\/]/).forEach(p => { if (p) file.append(p); });
					if (!file.exists()) return;
					
					let uri = Services.io.newFileURI(file).spec;
					
					let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
					.getService(Ci.nsIStyleSheetService);
					
					let cssURI = Services.io.newURI(uri);
					
					if (!sss.sheetRegistered(cssURI, sss.USER_SHEET)) {
						sss.loadAndRegisterSheet(cssURI, sss.USER_SHEET);
					}
				};
				
				const mainURI = Services.io.newFileURI(mainFile).spec;
				Services.scriptloader.loadSubScript(mainURI, window);
				
				console.log(`FirePack: Loaded pack → ${manifest.name} v${manifest.version}`);
				} catch (err) {
				console.error("FirePack: Failed pack →", packDir.leafName, err);
			}
		}
	}
	
	function registerFont(fontName, fontURL) {
		
		const css = `
		@font-face {
		font-family: "${fontName}";
		src: url("${fontURL}") format("woff2");
		font-weight: normal;
		font-style: normal;
		font-display: swap;
		}
		`;
		
		let uri = Services.io.newURI(
			"data:text/css;charset=utf-8," + encodeURIComponent(css)
		);
		
		let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
		.getService(Ci.nsIStyleSheetService);
		
		if (!sss.sheetRegistered(uri, sss.AGENT_SHEET)) {
			sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
		}
	}
	
	function applyUIFont(fontName) {
		
		const css = `
		window,
		dialog,
		toolbar,
		menubar,
		menu,
		menuitem,
		toolbarbutton,
		label,
		description,
		tab,
		.tab-label,
		#urlbar-input,
		#searchbar textbox {
		font-family: "${fontName}", sans-serif !important;
		}
		
		/* don't break icon fonts */
		toolbarbutton image,
		svg,
		svg * {
		font-family: inherit !important;
		}
		`;
		
		let uri = Services.io.newURI(
			"data:text/css;charset=utf-8," + encodeURIComponent(css)
		);
		
		let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
		.getService(Ci.nsIStyleSheetService);
		
		if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
			sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
		}
	}
	
	function applyWebFont(fontName) {
		
		const css = `
		html, body {
		font-family: "${fontName}", sans-serif !important;
		}
		
		/* keep icon fonts intact */
		[class*="icon"],
		[class*="Icon"],
		.material-icons,
		.fa,
		.fas,
		.far,
		.fab {
		font-family: inherit !important;
		}
		
		/* prevent svg security errors */
		svg, svg * {
		font-family: inherit !important;
		}
		`;
		
		let uri = Services.io.newURI(
			"data:text/css;charset=utf-8," + encodeURIComponent(css)
		);
		
		let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
		.getService(Ci.nsIStyleSheetService);
		
		if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
			sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
		}
	}
	
	function runExecutable(relativePath, args = []) {
		
		let file = FirePack.root.clone();
		relativePath.split(/[\\/]/).forEach(p => { if (p) file.append(p); });
		
		if (!file.exists()) {
			console.error("FirePack: Executable not found →", file.path);
			return;
		}
		
		if (!FirePack.root.contains(file)) {
			console.error("FirePack: Refusing to execute outside pack →", file.path);
			return;
		}
		
		try {
			const process = Cc["@mozilla.org/process/util;1"]
			.createInstance(Ci.nsIProcess);
			
			process.init(file);
			
			process.run(false, args, args.length);
			
			console.log("FirePack: Executed →", file.path);
			} catch (e) {
			console.error("FirePack: Failed to execute →", file.path, e);
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