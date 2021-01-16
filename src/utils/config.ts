// import { URL } from "url";

import * as vscode from 'vscode';

import { Platform, platform } from "./shell";

// the K3D config key
export const VS_KUBE_K3D_CFG_KEY = "k3d";

// the Kubernetes tools config key
export const VS_KUBE_CFG_KEY = "vs-kubernetes";

// setting: merge of the new kubeconfig in the default kubeconfig
export const VS_KUBE_K3D_UPDATE_KUBECONFIG_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.updateKubeconfig`;

// setting: update channel for the k3d binary
export const VS_KUBE_K3D_UPDATE_CHANNEL_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.updateChannel`;

// setting: drain nodes before deleting them
export const VS_KUBE_K3D_DRAIN_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.drainBeforeDelete`;

// setting: context on recylce
export const VS_KUBE_K3D_REPLACE_CONTEXT_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.replaceContext`;

// setting: merge of the new kubeconfig in the default kubeconfig
export const VS_KUBE_K3D_CREATE_DEFAULS_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.defaults`;

// setting: images configuration
export const VS_KUBE_K3D_IMAGES_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.images`;

// setting: DOCKER_HOST
export const VS_KUBE_K3D_DOCKERHOST_CFG_KEY =
    `${VS_KUBE_K3D_CFG_KEY}.dockerHost`;

// Use WSL on Windows

const USE_WSL_KEY = "use-wsl";

export enum UpdateKubeconfig {
    OnCreate = 1,
    OnDelete,
    Always,
    Never,
}

// getK3DConfigUpdateKubeconfig returns the behaviour about modifying tyhe kubeconfig
// when a cluster is created or deleted.
export function getK3DConfigUpdateKubeconfig(): UpdateKubeconfig | undefined {
    const config = vscode.workspace.getConfiguration();
    const value = config.get<string>(VS_KUBE_K3D_UPDATE_KUBECONFIG_CFG_KEY, "always");
    switch (value) {
        case "onCreate": return UpdateKubeconfig.OnCreate;
        case "onDelete": return UpdateKubeconfig.OnDelete;
        case "always": return UpdateKubeconfig.Always;
        case "never": return UpdateKubeconfig.Never;
    }
    return undefined;
}

export enum ReplaceContext {
    NewCluster,
    OldestCluster
}

// getK3DReplaceContext returns the contgext to use after recycling clusters.
export function getK3DReplaceContext(): ReplaceContext | undefined {
    const config = vscode.workspace.getConfiguration();
    const value = config.get<string>(VS_KUBE_K3D_REPLACE_CONTEXT_CFG_KEY, "new");
    switch (value) {
        case "new": return ReplaceContext.NewCluster;
        case "oldest": return ReplaceContext.OldestCluster;
    }
    return undefined;
}

// getK3DConfigCreateDefaults returns a cluster creation default
// (as provided in `k3d.defaults`). The key will specify something
// like`network` or`image`.
export function getK3DConfigCreateDefaults<T>(key: string): T | undefined {
    const config = vscode.workspace.getConfiguration(VS_KUBE_K3D_CREATE_DEFAULS_CFG_KEY);
    return config.get<T>(`${VS_KUBE_K3D_CREATE_DEFAULS_CFG_KEY}.${key}`);
}

// getK3DConfigImagesProposals returns the image proposals configuration.
export function getK3DConfigImages(key: string, fallback: string): string {
    const baseKey = `${VS_KUBE_K3D_IMAGES_CFG_KEY}.${key}`;
    const configKey = enclosingKey(baseKey);
    const config = vscode.workspace.getConfiguration(configKey)[baseKey];
    return config ? config : fallback;
    //    return config.get<string>(`${VS_KUBE_K3D_IMAGES_CFG_KEY}.${key}`, fallback);
}

export enum UpdateChannel {
    Stable = 1,
    All
}

// getK3DConfigUpdateChannel returns the update channel for the k3d binary
export function getK3DConfigUpdateChannel(): UpdateChannel | undefined {
    const config = vscode.workspace.getConfiguration();
    const value = config.get<string>(VS_KUBE_K3D_UPDATE_CHANNEL_CFG_KEY, "stable");
    switch (value) {
        case "stable": return UpdateChannel.Stable;
        case "all": return UpdateChannel.All;
    }
    return undefined;
}

// getK3DConfigUpdateChannel returns if we should drain the node before deleting them
export function getK3DConfigDrainBeforeDelete(): boolean {
    const config = vscode.workspace.getConfiguration();
    const value = config.get<boolean>(VS_KUBE_K3D_DRAIN_CFG_KEY, true);
    return value ? value : true;
}

// getK3DgetK3DDockerHost returns DockerHost
export function getK3DDockerHost(): string | undefined {
    const config = vscode.workspace.getConfiguration();

    const k3dDockerHost = config.get<string>(VS_KUBE_K3D_DOCKERHOST_CFG_KEY);
    if (k3dDockerHost) {
        return k3dDockerHost;
    }

    const extensionDockerHost = config.get<string>("docker.host");
    if (extensionDockerHost) {
        return extensionDockerHost;
    }

    const dockerHost = process.env['DOCKER_HOST'];
    if (dockerHost) {
        return dockerHost;

        // const url = new URL(dockerHost);
        // if (!url.protocol.startsWith("unix")) {
        //     return dockerHost;
        // }
    }

    return undefined;
}

// Functions for working with tool paths

export function getK3DConfigPathFor(tool: string): string | undefined {
    const baseKey = getK3DKeyFor(tool);
    const configKey = enclosingKey(baseKey);
    const os = platform();
    const osOverridePath = vscode.workspace.getConfiguration(configKey)[osOverrideKey(os, baseKey)];
    return osOverridePath || vscode.workspace.getConfiguration(configKey)[baseKey];
}

/////////////////////////////////////////////////////////////////////////////////////////

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

async function addValueToConfigAtScope(
    configKey: string,
    value: any,
    scope: vscode.ConfigurationTarget,
    valueAtScope: any,
    createIfNotExist: boolean): Promise<void> {

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

    await vscode.workspace.getConfiguration().update(enclosingKey(configKey), newValue, scope);
}

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(enclosingKey(configKey))!;

    await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

export function toolPathOSKey(os: Platform, tool: string): string {
    const baseKey = getK3DKeyFor(tool);
    const osSpecificKey = osOverrideKey(os, baseKey);
    return osSpecificKey;
}

export function getK3DKeyFor(tool: string): string {
    return `${VS_KUBE_K3D_CFG_KEY}.paths.${tool}`;
}

export function osOverrideKey(os: Platform, baseKey: string): string {
    const osKey = osKeyString(os);
    return osKey ? `${baseKey}-${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

function osKeyString(os: Platform): string | null {
    switch (os) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'mac';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

// calculate the enclosing config key
// for example, "k3d.paths.k3d-linux" -> "k3d.paths"
function enclosingKey(configKey: string): string {
    const enclosingKeyElements = configKey.split(".");
    return enclosingKeyElements.slice(0, -1).join(".");
}