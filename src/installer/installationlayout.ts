import * as vscode from 'vscode';
import { Platform, platform } from "../utils/shell";
import * as path from 'path';
import * as shell from '../utils/shell';
import { VS_KUBE_K3D_EXTENSION_CONFIG_KEY } from "../utils/config";

function osKeyString(os: Platform): string | null {
    switch (os) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'mac';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export function formatBin(tool: string, platform: Platform): string | null {
    const platformString = platformUrlString(platform);
    if (!platformString) {
        return null;
    }

    const toolPath = `${platformString}-amd64/${tool}`;
    if (platform === Platform.Windows) {
        return toolPath + '.exe';
    }
    return toolPath;
}

// Functions for working with tool paths

export function getConfigK3DToolPath(tool: string): string | undefined {
    const baseKey = getK3DToolPathBaseKey(tool);
    return getK3DPathSetting(baseKey);
}

function getK3DToolPathBaseKey(tool: string): string {
    return `${VS_KUBE_K3D_EXTENSION_CONFIG_KEY}.${tool}-path`;
}

function getK3DPathSetting(baseKey: string): string | undefined {
    const os = platform();
    const osOverridePath = vscode.workspace.getConfiguration(VS_KUBE_K3D_EXTENSION_CONFIG_KEY)[osOverrideKey(os, baseKey)];
    return osOverridePath || vscode.workspace.getConfiguration(VS_KUBE_K3D_EXTENSION_CONFIG_KEY)[baseKey];
}

function osOverrideKey(os: Platform, baseKey: string): string {
    const osKey = osKeyString(os);
    return osKey ? `${baseKey}.${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

export function getInstallFolder(tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}