// sudoFearlessAdam (github.com/sudoFearlessAdam)
// main.cpp - Master installer. This script installs firepack to the computer.


#include <windows.h>
#include <shlobj.h>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include "resource.h"

namespace fs = std::filesystem;

void setColor(int color) {
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    SetConsoleTextAttribute(hConsole, color);
}

std::string getAppData() {
    char path[MAX_PATH] = {};
    if (SUCCEEDED(SHGetFolderPathA(nullptr, CSIDL_APPDATA, nullptr, 0, path)))
        return std::string(path);
    return "";
}

bool isAdmin() {
    BOOL admin = FALSE;
    PSID adminGroup = nullptr;
    SID_IDENTIFIER_AUTHORITY NtAuthority = SECURITY_NT_AUTHORITY;
    if (AllocateAndInitializeSid(&NtAuthority, 2,
        SECURITY_BUILTIN_DOMAIN_RID, DOMAIN_ALIAS_RID_ADMINS,
        0, 0, 0, 0, 0, 0, &adminGroup)) {
        CheckTokenMembership(nullptr, adminGroup, &admin);
        FreeSid(adminGroup);
    }
    return admin != FALSE;
}

fs::path detectFirefox() {
    if (fs::exists("C:\\Program Files\\Mozilla Firefox\\firefox.exe"))
        return "C:\\Program Files\\Mozilla Firefox";
    if (fs::exists("C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe"))
        return "C:\\Program Files (x86)\\Mozilla Firefox";
    return {};
}

void createConfigJS(const fs::path& ffRoot) {
    fs::path cfg = ffRoot / "config.js";
    std::ofstream f(cfg, std::ios::binary);
    f << R"(

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
)";
}

void createLoaderConfigJS(const fs::path& ffRoot) {
    fs::path prefDir = ffRoot / "defaults" / "pref";
    fs::create_directories(prefDir);
    fs::path cfg = prefDir / "loaderconfig.js";
    std::ofstream f(cfg, std::ios::binary);
    f << R"(pref("general.config.obscure_value", 0);
pref("general.config.filename", "config.js");
pref("general.config.sandbox_enabled", false);
)";
}

void enableUserChrome() {
    std::string appData = getAppData();
    fs::path iniFile = fs::path(appData) / "Mozilla\\Firefox\\profiles.ini";
    if (!fs::exists(iniFile)) return;

    std::ifstream ini(iniFile);
    std::string line;
    while (std::getline(ini, line)) {
        if (line.rfind("Path=", 0) == 0) {
            fs::path profile = fs::path(appData) / "Mozilla\\Firefox" / line.substr(5);
            if (fs::exists(profile)) {
                fs::path userJS = profile / "user.js";
                std::ofstream f(userJS, std::ios::binary);
                f << R"(user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
)";
            }
        }
    }
}

bool extractZipFromResource(const fs::path& destDir) {
    HINSTANCE hInstance = GetModuleHandle(nullptr);
    HRSRC hRes = FindResource(hInstance, MAKEINTRESOURCE(IDR_COREZIP), RT_RCDATA);
    if (!hRes) {

        char exePath[MAX_PATH] = {};
        GetModuleFileNameA(nullptr, exePath, MAX_PATH);
        fs::path exeDir = fs::path(exePath).parent_path();
        std::vector<fs::path> candidates = {
            exeDir / "corefiles.zip",
            fs::current_path() / "corefiles.zip",
            fs::path("corefiles.zip")
        };

        for (const auto& cand : candidates) {
            if (fs::exists(cand)) {
                fs::create_directories(destDir);
                std::string cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Expand-Archive -LiteralPath '"
                    + cand.string() + "' -DestinationPath '" + destDir.string() + "' -Force\"";
                int rc = system(cmd.c_str());
                if (rc == 0) return true;
                setColor(12);
                std::cout << "[error] Expand-Archive fallback failed with code " << rc << " for " << cand.string() << "\n";
                setColor(7);
            }
        }

        setColor(12);
        std::cout << "[error] No fallback corefiles.zip found\n";
        setColor(7);
        return false;
    }

    HGLOBAL hGlob = LoadResource(hInstance, hRes);
    if (!hGlob) {
        setColor(12);
        std::cout << "[error] LoadResource failed\n";
        setColor(7);
        return false;
    }

    DWORD size = SizeofResource(hInstance, hRes);
    if (size == 0) {
        setColor(12);
        std::cout << "[error] Resource has zero size\n";
        setColor(7);
        return false;
    }

    void* data = LockResource(hGlob);
    if (!data) {
        setColor(12);
        std::cout << "[error] LockResource failed\n";
        setColor(7);
        return false;
    }

    fs::create_directories(destDir);
    fs::path outFile = destDir / "core.zip";
    std::ofstream ofs(outFile, std::ios::binary);
    if (!ofs) {
        setColor(12);
        std::cout << "[error] Failed to open output file: " << outFile.string() << "\n";
        setColor(7);
        return false;
    }

    ofs.write(reinterpret_cast<const char*>(data), size);
    ofs.close();

    if (!fs::exists(outFile)) {
        setColor(12);
        std::cout << "[error] Written zip not found: " << outFile.string() << "\n";
        setColor(7);
        return false;
    }

    std::string cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Expand-Archive -LiteralPath '"
        + outFile.string() + "' -DestinationPath '" + destDir.string() + "' -Force\"";
    int rc = system(cmd.c_str());
    if (rc != 0) {
        setColor(12);
        std::cout << "[error] Expand-Archive failed with code " << rc << "\n";
        setColor(7);
        return false;
    }

    fs::remove(outFile);
    return true;
}

void registerFpack() {
    char buffer[MAX_PATH] = {};
    GetModuleFileNameA(nullptr, buffer, MAX_PATH);
    std::string currentExe(buffer);
    std::string installerPath = "C:\\ProgramData\\FirePack\\packinst.exe";
    system("assoc .fpack=FirePackFile >nul 2>&1");
    std::string ftypeCmd = std::string("ftype FirePackFile=\"") + installerPath + "\" \"%1\" >nul 2>&1";
    system(ftypeCmd.c_str());
}

int main() {
    setColor(11);
    std::cout << "----------------------------------------\n";
    setColor(10);
    std::cout << "        FirePack Installer\n";
    setColor(11);
    std::cout << "----------------------------------------\n\n";
    setColor(7);

    if (!isAdmin()) {
        std::cout << "Please run as administrator!\n";
        system("pause");
        return 0;
    }

    fs::path ffRoot = detectFirefox();
    if (ffRoot.empty()) {
        setColor(12);
        std::cout << "[error] Firefox installation not found.\n";
        system("pause");
        return 0;
    }

    setColor(10);
    std::cout << "Firefox detected at: " << ffRoot.string() << "\n\n";

    setColor(11);
    std::cout << "Installing config.js...\n";
    setColor(7);
    createConfigJS(ffRoot);

    setColor(11);
    std::cout << "Installing loaderconfig.js...\n";
    setColor(7);
    createLoaderConfigJS(ffRoot);

    setColor(11);
    std::cout << "Enabling userChrome.css support...\n";
    setColor(7);
    enableUserChrome();

    fs::path firepackDir = "C:\\ProgramData\\FirePack";
    extractZipFromResource(firepackDir);

    setColor(10);
    std::cout << "Core files installed to: " << firepackDir.string() << "\n";

    registerFpack();
    setColor(10);
    std::cout << ".fpack successfully registered.\n";

    setColor(11);
    std::cout << "----------------------------------------\n";
    setColor(10);
    std::cout << "Setup Complete. You can now click on FirePack files (.fpack) to install any pack\n";
    setColor(7);
    system("pause");
    return 0;

}
