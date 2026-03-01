(function () {

    if (window.__firepackSchedulerActive) return;
    window.__firepackSchedulerActive = true;

    const deferredQueue = [];
    let scheduled = false;

    function flushQueue(deadline) {
        scheduled = false;

        while (deferredQueue.length &&
               (deadline.timeRemaining() > 0 || deadline.didTimeout)) {

            const task = deferredQueue.shift();

            try {
                task();
            } catch (e) {
                console.error(e);
            }
        }

        if (deferredQueue.length) {
            scheduleFlush();
        }
    }

    function scheduleFlush() {
        if (scheduled) return;
        scheduled = true;

        if ("requestIdleCallback" in window) {
            requestIdleCallback(flushQueue, { timeout: 200 });
        } else {
            setTimeout(() => flushQueue({ timeRemaining: () => 10, didTimeout: true }), 16);
        }
    }

    window.addEventListener("load", () => {
        queueMicrotask(() => {});
    });

    const originalSetTimeout = window.setTimeout;

    window.setTimeout = function (fn, delay, ...args) {

        if (typeof fn === "function" && delay > 0 && delay < 10) {
            delay = 10;
        }

        return originalSetTimeout(fn, delay, ...args);
    };

    window.FirePackSchedule = function (task) {
        deferredQueue.push(task);
        scheduleFlush();
    };
})();