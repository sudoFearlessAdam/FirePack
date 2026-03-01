(function () {

    if (window.__firepackGCActive) return;
    window.__firepackGCActive = true;

    const { Services } = globalThis;

    function tryGC() {
        try {
            if (typeof window.gc === "function") {
                window.gc();
            }
        } catch (_) {}
    }

    function tryCycleCollect() {
        try {
            if (Services && Services.obs) {
                Services.obs.notifyObservers(null, "cycle-collector-forget-skippable");
            }
        } catch (_) {}
    }

    function runCleanup() {
        tryGC();
        tryCycleCollect();
    }

    if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
            runCleanup();
        });
    }

    if (Services && Services.obs) {
        Services.obs.addObserver({
            observe(subject, topic) {
                if (topic === "memory-pressure") {
                    runCleanup();
                }
            }
        }, "memory-pressure");
    }

    setInterval(() => {
        if (document.hidden) {
            runCleanup();
        }
    }, 60000);
})();