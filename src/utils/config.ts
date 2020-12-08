import * as vscode from 'vscode';

import { Platform } from '../utils/shell';

// the K3D config key
export const VS_KUBE_K3D_EXTENSION_CONFIG_KEY = "vs-kubernetes-k3d";

// the Kubernetes tools config key
export const VS_KUBE_EXTENSION_CONFIG_KEY = "vs-kubernetes";

// Use WSL on Windows

const USE_WSL_KEY = "use-wsl";

export function getUseWsl(): boolean {
    return vscode.workspace.getConfiguration(VS_KUBE_EXTENSION_CONFIG_KEY)[USE_WSL_KEY];
}

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
    await setConfigValue(configKey, value);
}

async function setConfigValue(configKey: string, value: any): Promise<void> {
    await atAllConfigScopes(addValueToConfigAtScope, configKey, value);
}

async function addValueToConfigAtScope(configKey: string, value: any, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
    if (!createIfNotExist) {
        if (!valueAtScope || !(valueAtScope[configKey])) {
            return;
        }
    }

    let newValue: any = {};
    if (valueAtScope) {
        newValue = Object.assign({}, valueAtScope);
    }
    newValue[configKey] = value;
    await vscode.workspace.getConfiguration().update(VS_KUBE_K3D_EXTENSION_CONFIG_KEY, newValue, scope);
}

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(VS_KUBE_K3D_EXTENSION_CONFIG_KEY)!;
    await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

export function toolPathOSKey(os: Platform, tool: string): string {
    const baseKey = toolPathBaseKey(tool);
    const osSpecificKey = osOverrideKey(os, baseKey);
    return osSpecificKey;
}

function toolPathBaseKey(tool: string): string {
    return `${VS_KUBE_K3D_EXTENSION_CONFIG_KEY}.${tool}-path`;
}

function osOverrideKey(os: Platform, baseKey: string): string {
    const osKey = osKeyString(os);
    return osKey ? `${baseKey}.${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

function osKeyString(os: Platform): string | null {
    switch (os) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'mac';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}