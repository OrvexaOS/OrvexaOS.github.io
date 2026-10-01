"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_PLUGIN_DIR = path.join(__dirname, "plugins");

function getPluginDirectory(override) {
    return path.resolve(override || process.env.ORVEXA_PLUGIN_DIR || DEFAULT_PLUGIN_DIR);
}

function validatePluginName(name) {
    if (typeof name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
        throw new Error("Invalid plugin name.");
    }
    return name;
}

async function findPluginName(source) {
    for (const filename of ["plugin.json", "package.json"]) {
        try {
            const manifest = JSON.parse(await fs.readFile(path.join(source, filename), "utf8"));
            if (manifest.name) return validatePluginName(manifest.name);
        } catch (error) {
            if (error.code !== "ENOENT") throw new Error(`Invalid ${filename}: ${error.message}`);
        }
    }
    return validatePluginName(path.basename(source));
}

async function installPlugin(sourcePath, options = {}) {
    const source = path.resolve(sourcePath);
    const sourceStat = await fs.stat(source).catch(() => null);
    if (!sourceStat || !sourceStat.isDirectory()) {
        throw new Error("Plugin source must be an existing directory.");
    }

    const name = validatePluginName(options.name || await findPluginName(source));
    const pluginDirectory = getPluginDirectory(options.pluginsDir);
    const destination = path.join(pluginDirectory, name);
    if (destination === source || destination.startsWith(`${source}${path.sep}`)) {
        throw new Error("Plugin destination cannot be inside its source directory.");
    }

    await fs.mkdir(pluginDirectory, { recursive: true });
    const id = crypto.randomBytes(6).toString("hex");
    const staging = path.join(pluginDirectory, `.${name}.install-${id}`);
    const backup = path.join(pluginDirectory, `.${name}.backup-${id}`);
    let backedUp = false;

    try {
        await fs.cp(source, staging, { recursive: true, errorOnExist: true, force: false });
        try {
            await fs.rename(destination, backup);
            backedUp = true;
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
        await fs.rename(staging, destination);
        if (backedUp) await fs.rm(backup, { recursive: true, force: true });
        return destination;
    } catch (error) {
        await fs.rm(staging, { recursive: true, force: true }).catch(() => { });
        if (backedUp) {
            await fs.rm(destination, { recursive: true, force: true }).catch(() => { });
            await fs.rename(backup, destination).catch(() => { });
        }
        throw error;
    }
}

async function uninstallPlugin(name, options = {}) {
    name = validatePluginName(name);
    const target = path.join(getPluginDirectory(options.pluginsDir), name);
    const stat = await fs.lstat(target).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
    });
    if (!stat) throw new Error(`Plugin is not installed: ${name}`);
    await fs.rm(target, { recursive: true, force: false });
}

async function listPlugins(options = {}) {
    const entries = await fs.readdir(getPluginDirectory(options.pluginsDir), { withFileTypes: true }).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
    });
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort();
}

module.exports = { installPlugin, uninstallPlugin, listPlugins, DEFAULT_PLUGIN_DIR };

if (require.main === module) {
    (async () => {
        const [command, argument] = process.argv.slice(2);
        if (command === "install" && argument) {
            console.log(`Installed plugin to ${await installPlugin(argument)}`);
        } else if (command === "uninstall" && argument) {
            await uninstallPlugin(argument);
            console.log(`Uninstalled plugin ${argument}`);
        } else if (command === "list") {
            const plugins = await listPlugins();
            console.log(plugins.length ? plugins.join("\n") : "No plugins installed.");
        } else {
            console.error("Usage: node pluginInstaller.js <install <directory>|uninstall <name>|list>");
            process.exitCode = 1;
        }
    })().catch((error) => {
        console.error(`Plugin installer: ${error.message}`);
        process.exitCode = 1;
    });
}
