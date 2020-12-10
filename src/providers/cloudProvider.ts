import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';
import * as k3d from '../k3d/k3d';
import { shell } from '../utils/shell';
import { failed } from '../utils/errorable';
import '../utils/string';

class K3dCloudProvider implements k8s.CloudExplorerV1.CloudProvider {
    readonly cloudName = "k3d";
    readonly treeDataProvider = new K3dTreeDataProvider();
    async getKubeconfigYaml(cluster: any): Promise<string | undefined> {
        const treeNode = cluster as K3dCloudProviderTreeNode;
        if (treeNode.nodeType === 'cluster') {
            return await getK3dKubeconfigYaml(treeNode.clusterName);
        }
        return undefined;
    }
}

export interface K3dCloudProviderClusterNode {
    readonly nodeType: 'cluster';
    readonly clusterName: string;
}

export interface K3dCloudProviderErrorNode {
    readonly nodeType: 'error';
    readonly diagnostic: string;
}

export type K3dCloudProviderTreeNode = K3dCloudProviderClusterNode | K3dCloudProviderErrorNode;

class K3dTreeDataProvider implements vscode.TreeDataProvider<K3dCloudProviderTreeNode> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<K3dCloudProviderTreeNode | undefined> = new vscode.EventEmitter<K3dCloudProviderTreeNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<K3dCloudProviderTreeNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: K3dCloudProviderTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.nodeType === 'error') {
            const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
            treeItem.tooltip = element.diagnostic;
            return treeItem;
        } else {
            const treeItem = new vscode.TreeItem(element.clusterName, vscode.TreeItemCollapsibleState.None);
            treeItem.contextValue = `k3d.cluster ${k8s.CloudExplorerV1.SHOW_KUBECONFIG_COMMANDS_CONTEXT}`;
            return treeItem;
        }
    }
    getChildren(element?: K3dCloudProviderTreeNode | undefined): vscode.ProviderResult<K3dCloudProviderTreeNode[]> {
        if (element) {
            return [];
        }
        return getClusters();
    }
}

async function getClusters(): Promise<K3dCloudProviderTreeNode[]> {
    const clusters = await k3d.getClusters(shell);
    if (failed(clusters)) {
        return [{ nodeType: 'error', diagnostic: clusters.error[0] }];
    }
    return clusters.result.map((c) => ({ nodeType: 'cluster', clusterName: c.name } as const));
}

// getK3dKubeconfigYaml is invoked when we click on "Merge into Kubeconfig"
async function getK3dKubeconfigYaml(clusterName: string): Promise<string | undefined> {
    const kcyaml = await k3d.getKubeconfig(shell, clusterName);
    if (failed(kcyaml)) {
        vscode.window.showErrorMessage(`Can't get kubeconfig for ${clusterName}: ${kcyaml.error[0]}`);
        return undefined;
    }
    const originalKubeconfig = kcyaml.result;
    const distinctKubeconfig = replaceAPIServerIP(originalKubeconfig, clusterName);
    return distinctKubeconfig;
}

function replaceAPIServerIP(kubeconfig: string, clusterName: string): string {
    // TODO: replace the IP address for the API Server
    // return kubeconfig.replaceAll('0.0.0.0', someIP);
    return kubeconfig;
}

export const K3D_CLOUD_PROVIDER = new K3dCloudProvider();

export async function refresh(): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (cloudExplorer.available) {
        cloudExplorer.api.refresh();
    }
}
