FirePack.registerModule("config", (function () {

    const { Services } = globalThis;

    const observers = new Map();

    function prefExists(name) {
        return Services.prefs.getPrefType(name) !== Services.prefs.PREF_INVALID;
    }

    function getPrefType(name) {
        return Services.prefs.getPrefType(name);
    }

    function detectType(value) {
        switch (typeof value) {
            case "boolean":
                return Services.prefs.PREF_BOOL;

            case "number":
                if (!Number.isInteger(value))
                    throw new Error("Configs: Only integers are supported for numbers.");
                return Services.prefs.PREF_INT;

            case "string":
                return Services.prefs.PREF_STRING;

            default:
                throw new Error("Configs: Unsupported value type.");
        }
    }

    function setPref(name, value) {
        const type = detectType(value);

        if (type === Services.prefs.PREF_BOOL)
            Services.prefs.setBoolPref(name, value);
        else if (type === Services.prefs.PREF_INT)
            Services.prefs.setIntPref(name, value);
        else
            Services.prefs.setStringPref(name, value);
    }

    function getPref(name) {
        const type = getPrefType(name);

        switch (type) {
            case Services.prefs.PREF_BOOL:
                return Services.prefs.getBoolPref(name);

            case Services.prefs.PREF_INT:
                return Services.prefs.getIntPref(name);

            case Services.prefs.PREF_STRING:
                return Services.prefs.getStringPref(name);

            default:
                return undefined;
        }
    }

    function notifyObservers(name) {
        if (!observers.has(name)) return;

        const value = getPref(name);

        for (const callback of observers.get(name)) {
            try {
                callback(value);
            } catch (e) {
                console.error("Configs: onChange callback error:", e);
            }
        }
    }

    Services.prefs.addObserver("", {
        observe(subject, topic, data) {
            if (topic === "nsPref:changed") {
                notifyObservers(data);
            }
        }
    });

    return {

        create(name, defaultValue) {
            if (!name) {
                console.error("Configs: Invalid config name.");
                return;
            }

            if (prefExists(name)) {
                console.warn(`Configs: "${name}" already exists.`);
                return;
            }

            try {
                setPref(name, defaultValue);
                console.log(`Configs: Created "${name}"`);
            } catch (e) {
                console.error("Configs: Failed creating config:", e);
            }
        },

        get(name) {
            if (!prefExists(name)) {
                console.error(`Configs: Config "${name}" does not exist.`);
                return undefined;
            }
            return getPref(name);
        },

        edit(name, value) {
            if (!prefExists(name)) {
                console.error(`Configs: Config "${name}" does not exist.`);
                return;
            }

            const existingType = getPrefType(name);
            const newType = detectType(value);

            if (existingType !== newType) {
                console.error(`Configs: Type mismatch for "${name}". Type cannot be changed.`);
                return;
            }

            try {
                setPref(name, value);
                notifyObservers(name);
                console.log(`Configs: Updated "${name}"`);
            } catch (e) {
                console.error("Configs: Failed updating config:", e);
            }
        },

        exists(name) {
            return prefExists(name);
        },

        remove(name) {
            if (!prefExists(name)) {
                console.error(`Configs: Config "${name}" does not exist.`);
                return;
            }

            try {
                Services.prefs.clearUserPref(name);
                console.log(`Configs: Removed "${name}"`);
            } catch (e) {
                console.error("Configs: Failed removing config:", e);
            }
        },

        onChange(name, callback) {
            if (!prefExists(name)) {
                console.error(`Configs: Config "${name}" does not exist.`);
                return;
            }

            if (typeof callback !== "function") {
                console.error("Configs: onChange requires a function.");
                return;
            }

            if (!observers.has(name))
                observers.set(name, new Set());

            observers.get(name).add(callback);
        }

    };

})());