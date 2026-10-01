#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', 'plugins');
const REGISTRY_PATH = path.resolve(PLUGIN_ROOT, 'plugins.json');

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readJson(filePath, fallback = []) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return fallback;
        }

        if (error && error.name === 'SyntaxError') {
            throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
        }

        throw error;
    }
}

function writeJson(filePath, data) {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizePluginName(pluginName) {
    return String(pluginName || '').trim();
}

function listInstalledPlugins(options = {}) {
    const pluginRoot = options.pluginRoot || PLUGIN_ROOT;
    const registryPath = options.registryPath || REGISTRY_PATH;

    ensureDirectory(pluginRoot);

    const registry = readJson(registryPath, { plugins: [] });
    const installed = Array.isArray(registry.plugins) ? registry.plugins : [];

    return installed.map((plugin) => ({
        name: plugin.name || plugin.id || plugin.slug || 'unknown',
        id: plugin.id || plugin.name || plugin.slug || 'unknown',
        version: plugin.version || 'unknown',
        path: plugin.path || '',
        ...plugin,
    }));
}

function getPluginEntry(pluginName, options = {}) {
    const name = normalizePluginName(pluginName);

    if (!name) {
        throw new Error('A plugin name is required.');
    }

    const plugins = listInstalledPlugins(options);
    return plugins.find((plugin) => {
        const currentName = String(plugin.name || plugin.id || plugin.slug || '').toLowerCase();
        return currentName === name.toLowerCase();
    }) || null;
}

function uninstallPlugin(pluginName, options = {}) {
    const name = normalizePluginName(pluginName);
    const pluginRoot = options.pluginRoot || PLUGIN_ROOT;
    const registryPath = options.registryPath || REGISTRY_PATH;

    if (!name) {
        throw new Error('Plugin name is required to uninstall a plugin.');
    }

    ensureDirectory(pluginRoot);

    const registry = readJson(registryPath, { plugins: [] });
    const installedPlugins = Array.isArray(registry.plugins) ? registry.plugins : [];
    const target = installedPlugins.find((plugin) => {
        const currentName = String(plugin.name || plugin.id || plugin.slug || '').toLowerCase();
        return currentName === name.toLowerCase();
    });

    const candidateDir = path.resolve(pluginRoot, name);
    const candidateManifest = path.resolve(pluginRoot, name, 'plugin.json');

    const pluginDirectory = target && target.path
        ? path.isAbsolute(String(target.path))
            ? path.resolve(String(target.path))
            : path.resolve(pluginRoot, String(target.path))
        : candidateDir;

    const manifestPath = target && target.manifest
        ? path.isAbsolute(String(target.manifest))
            ? path.resolve(String(target.manifest))
            : path.resolve(pluginRoot, String(target.manifest))
        : candidateManifest;

    const pluginExistsOnDisk = fs.existsSync(pluginDirectory) || fs.existsSync(manifestPath);

    if (!target && !pluginExistsOnDisk) {
        const error = new Error(`Plugin "${name}" is not installed.`);
        error.code = 'PLUGIN_NOT_FOUND';
        throw error;
    }

    if (fs.existsSync(pluginDirectory) && fs.statSync(pluginDirectory).isDirectory()) {
        fs.rmSync(pluginDirectory, { recursive: true, force: true });
    }

    if (fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()) {
        fs.rmSync(manifestPath, { force: true });
    }

    const remainingPlugins = installedPlugins.filter((plugin) => {
        const currentName = String(plugin.name || plugin.id || plugin.slug || '').toLowerCase();
        return currentName !== name.toLowerCase();
    });

    writeJson(registryPath, {
        ...(registry && typeof registry === 'object' ? registry : {}),
        plugins: remainingPlugins,
    });

    return {
        name,
        removed: true,
        directory: pluginDirectory,
        registryPath,
    };
}

function main() {
    const args = process.argv.slice(2);
    const pluginName = args[0] || '';

    if (!pluginName) {
        console.error('Usage: node pluginUninstaller.js <plugin-name>');
        process.exitCode = 1;
        return;
    }

    try {
        const result = uninstallPlugin(pluginName);
        console.log(`Plugin "${result.name}" successfully uninstalled.`);
        console.log(`Removed directory: ${result.directory}`);
    } catch (error) {
        console.error(`Uninstall failed: ${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    PLUGIN_ROOT,
    REGISTRY_PATH,
    listInstalledPlugins,
    getPluginEntry,
    uninstallPlugin,
    main,
};
