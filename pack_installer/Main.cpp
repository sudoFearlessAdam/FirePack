// sudoFearlessAdam (github.com/sudoFearlessAdam)
// Main.cpp - Pack installer. This script is the installer that installs a firepack (.fpack)

#include <windows.h>
#include <shlobj.h>
#include <filesystem>
#include <iostream>
#include <vector>
#include <fstream>
#include <string>
#include <tlhelp32.h>
#include <sstream>

#include "headers/nlohmann_json.hpp"

using json = nlohmann::json;
namespace fs = std::filesystem;

void setColor(int color)
{
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    SetConsoleTextAttribute(hConsole, color);
}

std::string getAppData()
{
    char path[MAX_PATH];
    SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, path);
    return std::string(path);
}

bool extractZip(const std::string& packPath, const std::string& dest)
{
    std::string zipPath = packPath;

    if (packPath.size() > 6 && packPath.substr(packPath.size() - 6) == ".fpack")
    {
        zipPath = packPath.substr(0, packPath.size() - 6) + ".zip";
        std::filesystem::copy_file(packPath, zipPath, std::filesystem::copy_options::overwrite_existing);
    }

    std::string cmd =
        "powershell -NoLogo -NoProfile -Command "
        "\"Expand-Archive -LiteralPath '" + zipPath + "' -DestinationPath '" + dest + "' -Force\"";

    bool success = system(cmd.c_str()) == 0;

    if (zipPath != packPath)
        std::filesystem::remove(zipPath);

    return success;
}

json loadPackInfo(const fs::path& packJson)
{
    std::ifstream f(packJson);
    if (!f.is_open())
    {
        std::cout << "Failed to open pack.json\n";
        system("pause");
        exit(0);
    }

    json j;
    try
    {
        f >> j;
    }
    catch (json::parse_error&)
    {
        std::cout << "Invalid JSON in pack.json\n";
        system("pause");
        exit(0);
    }

    if (!j.contains("name") || !j.contains("version") ||
        !j["name"].is_string() || !j["version"].is_string())
    {
        std::cout << "pack.json is invalid: 'name' and 'version' are required\n";
        system("pause");
        exit(0);
    }

    return j;
}

std::vector<fs::path> getFirefoxProfiles()
{
    std::vector<fs::path> profiles;
    fs::path root = getAppData();
    root /= "Mozilla/Firefox/Profiles";

    if (!fs::exists(root)) return profiles;

    for (auto& entry : fs::directory_iterator(root))
        if (entry.is_directory())
            profiles.push_back(entry.path());

    return profiles;
}

void copyDirectory(const fs::path& src, const fs::path& dst)
{
    fs::create_directories(dst);

    for (auto& entry : fs::recursive_directory_iterator(src))
    {
        const auto& path = entry.path();
        auto rel = fs::relative(path, src);
        auto dest = dst / rel;

        if (entry.is_directory())
            fs::create_directories(dest);
        else
            fs::copy_file(path, dest, fs::copy_options::overwrite_existing);
    }
}

bool isFirefoxRunning()
{
    PROCESSENTRY32 entry;
    entry.dwSize = sizeof(PROCESSENTRY32);

    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (Process32First(snapshot, &entry))
    {
        do
        {
            std::wstring wname(entry.szExeFile);
            std::string name(wname.begin(), wname.end());
            if (name == "firefox.exe")
            {
                CloseHandle(snapshot);
                return true;
            }
        } while (Process32Next(snapshot, &entry));
    }

    CloseHandle(snapshot);
    return false;
}

void closeFirefox()
{
    system("taskkill /IM firefox.exe /F >nul 2>&1");
}

void openFirefox()
{
    system("start firefox.exe");
}

int main(int argc, char* argv[])
{
    setColor(14);
    std::cout << "============================================\n";
    setColor(10);
    std::cout << "          FirePack Pack Installer\n";
    setColor(14);
    std::cout << "============================================\n\n";
    setColor(7);
    if (argc < 2)
    {
        std::cout << "Usage: packinst.exe <pack.zip/.fpack>\n";
        system("pause");
        return 0;
    }

    fs::path packZip = argv[1];

    if (!fs::exists(packZip))
    {
        std::cout << "Pack file not found.\n";
        system("pause");
        return 0;
    }

    bool firefoxWasClosed = false;

    if (isFirefoxRunning())
    {
        std::cout << "Firefox needs to be closed to install a pack. Do you want the installer to close it? (y/n): ";
        char ans;
        std::cin >> ans;

        if (ans == 'y' || ans == 'Y')
        {
            closeFirefox();
            firefoxWasClosed = true;

            Sleep(1500);
        }
        else
        {
            std::cout << "\nCannot run installer: Firefox is not closed\n";
            system("pause");
            return 0;
        }
    }

    fs::path temp = fs::temp_directory_path() /
        ("FirePack_" + std::to_string(GetTickCount64()));
    fs::create_directories(temp);

    std::cout << "Extracting pack...\n";
    if (!extractZip(packZip.string(), temp.string()))
    {
        std::cout << "Failed to extract pack.\n";
        system("pause");
        return 0;
    }

    fs::path packJson = temp / "pack.json";
    if (!fs::exists(packJson))
    {
        std::cout << "pack.json missing.\n";
        system("pause");
        return 0;
    }

    json info = loadPackInfo(packJson);
    std::string name = info["name"];
    std::string version = info["version"];

    std::string author = info.value("author", "Unknown");
    std::string description = info.value("description", "No description provided");

    setColor(11);
    std::cout << "\nPack Name : ";
    setColor(10);
    std::cout << name << "\n";

    setColor(11);
    std::cout << "Version   : ";
    setColor(10);
    std::cout << version << "\n";

    setColor(11);
    std::cout << "Author    : ";
    setColor(10);
    std::cout << author << "\n";

    setColor(11);
    std::cout << "Description: ";
    setColor(14);
    std::cout << description << "\n\n";

    setColor(7);

    auto profiles = getFirefoxProfiles();
    if (profiles.empty())
    {
        std::cout << "No Firefox profiles found.\n";
        system("pause");
        return 0;
    }

    std::cout << "Select profile (select '7' if you are not sure.) :\n\n";
    for (size_t i = 0; i < profiles.size(); i++)
        std::cout << i + 1 << ". " << profiles[i].filename().string() << "\n";

    std::cout << "\n" << profiles.size() + 1 << ". Install on all\n";
    std::cout << "\nEnter number: ";

    int choice;
    std::cin >> choice;

    std::vector<fs::path> targets;

    if (choice >= 1 && choice <= profiles.size())
    {
        targets.push_back(profiles[choice - 1]);
    }
    else if (choice == profiles.size() + 1)
    {
        targets = profiles;
    }
    else
    {
        std::cout << "Invalid selection.\n";
        system("pause");
        return 0;
    }

    for (auto& profile : targets)
    {
        fs::path chrome = profile / "chrome";
        fs::path firepack = chrome / "firepack";
        fs::path destination = firepack / name;

        fs::create_directories(firepack);
        if (fs::exists(destination)) fs::remove_all(destination);

        copyDirectory(temp, destination);
    }

    fs::remove_all(temp);

    std::cout << "\nInstalled successfully.\n";

    if (targets.size() == 1)
        std::cout << "Profile: " << targets[0].filename().string() << "\n";
    else
        std::cout << "Installed on all profiles.\n";

    if (firefoxWasClosed)
    {
        std::cout << "\nDo you want to open Firefox now? (y/n): ";
        char ans;
        std::cin >> ans;
        if (ans == 'y' || ans == 'Y')
        {
            openFirefox();
        }
    }

    return 0;

}
