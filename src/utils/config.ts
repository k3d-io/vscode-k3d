import * as vscode from 'vscode';

import { Platform } from '../utils/shell';

// the K3D config key
export const VS_KUBE_K3D_CFG_KEY = "vs-kubernetes-k3d";

// the Kubernetes tools config key
export const VS_KUBE_CFG_KEY = "vs-kubernetes";

// setting: force a specific KUBECONFIG where the kubeconfig will be merged
export const VS_KUBE_K3D_FORCE_KUBECONFIG_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.kubeconfig`;

// setting: merge of the new kubeconfig in the default kubeconfig
export const VS_KUBE_K3D_UPDATE_KUBECONFIG_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.updateKubeconfigOnCreate`;

// Use WSL on Windows

const USE_WSL_KEY = "use-wsl";

export function getK3DExtensionConfig() {
    return vscode.workspace.getConfiguration(VS_KUBE_K3D_CFG_KEY);
}

export function getK3DCreateClusterForcedKubeconfig(): string | undefined {
    return getK3DExtensionConfig()[VS_KUBE_K3D_FORCE_KUBECONFIG_CFG_KEY];
}

export function getK3DCreateClusterConfigUpdateKubeconfig(): boolean | undefined {
    return getK3DExtensionConfig()[VS_KUBE_K3D_UPDATE_KUBECONFIG_CFG_KEY];
}

export function getUseWsl(): boolean {
    return vscode.workspace.getConfiguration(VS_KUBE_CFG_KEY)[USE_WSL_KEY];
}

/////////////////////////////////////////////////////////////////////////////////////////

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
    await vscode.workspace.getConfiguration().update(VS_KUBE_K3D_CFG_KEY, newValue, scope);
}

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(VS_KUBE_K3D_CFG_KEY)!;
    await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

export function toolPathOSKey(os: Platform, tool: string): string {
    const baseKey = getK3DToolPathBaseKey(tool);
    const osSpecificKey = osOverrideKey(os, baseKey);
    return osSpecificKey;
}

export function getK3DToolPathBaseKey(tool: string): string {
    return `${VS_KUBE_K3D_CFG_KEY}.${tool}-path`;
}

export function osOverrideKey(os: Platform, baseKey: string): string {
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