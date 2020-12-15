import * as vscode from 'vscode';
import { Platform, platform } from "../utils/shell";
import * as path from 'path';
import * as shell from '../utils/shell';
import * as config from "../utils/config";

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
    const baseKey = config.getK3DToolPathBaseKey(tool);
    const os = platform();
    const osOverridePath = vscode.workspace.getConfiguration(config.VS_KUBE_K3D_CFG_KEY)[config.osOverrideKey(os, baseKey)];
    return osOverridePath || vscode.workspace.getConfiguration(config.VS_KUBE_K3D_CFG_KEY)[baseKey];
}

export function getInstallFolder(tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}