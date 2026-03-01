// config.js ()

try {
    const Ci = Components.interfaces;

	Services.obs.addObserver(function observer(subject, topic) {
		if (topic === "domwindowopened") {
			subject.addEventListener("load", function onLoad() {
				subject.removeEventListener("load", onLoad, false);

				if (subject.location.href === "chrome://browser/content/browser.xhtml") {
					Services.scriptloader.loadSubScript(
						"file:///C:/ProgramData/FirePack/loaders/loader.js",
						subject
					);
				}
			}, false);
		}
	}, "domwindowopened");

} catch (e) {
    Components.utils.reportError(e);
}
