(function () {

    if (window.__firepackAudioOptimized) return;
    window.__firepackAudioOptimized = true;

    let audioContext;

    function createContext() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: "interactive"
            });
        } catch (_) {}
    }

    function warmUpAudio() {
        if (!audioContext) return;

        try {
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        } catch (_) {}
    }

    function resumeIfSuspended() {
        if (!audioContext) return;
        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }
    }

    function unlockAudio() {
        resumeIfSuspended();
        warmUpAudio();
    }

    createContext();

    if (audioContext) {
        if (audioContext.state === "suspended") {
            document.addEventListener("click", unlockAudio, { once: true });
            document.addEventListener("keydown", unlockAudio, { once: true });
        } else {
            warmUpAudio();
        }
    }

    setInterval(() => {
        if (!document.hidden) {
            resumeIfSuspended();
        }
    }, 30000);

})();