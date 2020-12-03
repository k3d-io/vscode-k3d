import * as vscode from 'vscode';

const VS_KUBE_EXTENSION_CONFIG_KEY = "vs-kubernetes";
const VS_KUBE_KUBECONFIG_PATH_KEY = "vs-kubernetes.kubeconfig";
const VS_KUBE_KNOWN_KUBECONFIGS_KEY = "vs-kubernetes.knownKubeconfigs";

export function getKnownKubeconfigs(): string[] {
    const kkcConfig = vscode.workspace.getConfiguration(VS_KUBE_EXTENSION_CONFIG_KEY)[VS_KUBE_KNOWN_KUBECONFIGS_KEY];
    if (!kkcConfig || !kkcConfig.length) {
        return [];
    }
    return kkcConfig as string[];
}

export function getActiveKubeconfig(): string {
    return vscode.workspace.getConfiguration(VS_KUBE_EXTENSION_CONFIG_KEY)[VS_KUBE_KUBECONFIG_PATH_KEY];
}
