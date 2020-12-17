import * as k8s from 'vscode-kubernetes-tools-api';

export async function refreshKubernetesToolsViews(): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (cloudExplorer.available) {
        cloudExplorer.api.refresh();
    }

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.refresh();
    }
}
