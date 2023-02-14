import * as dedent from 'dedent';
import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import * as k3d from '../k3d/k3d';
import { failed } from '../utils/errorable';
import { shell } from '../utils/shell';
import '../utils/string';


export interface K3dCloudProviderClusterNode {
    readonly nodeType: 'cluster';
    readonly clusterName: string;
}

export interface K3dCloudProviderClusterNodeNode {
    readonly nodeType: 'node';
    readonly nodeName: string;
    readonly clusterName: string;
}
export interface K3dCloudProviderErrorNode {
    readonly nodeType: 'error';
    readonly diagnostic: string;
}

export type K3dCloudProviderTreeNode =
    K3dCloudProviderClusterNode |
    K3dCloudProviderClusterNodeNode |
    K3dCloudProviderErrorNode;

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

class K3dTreeDataProvider implements vscode.TreeDataProvider<K3dCloudProviderTreeNode> {

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<K3dCloudProviderTreeNode | undefined> =
        new vscode.EventEmitter<K3dCloudProviderTreeNode | undefined>();

    readonly onDidChangeTreeData: vscode.Event<K3dCloudProviderTreeNode | undefined> =
        this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: K3dCloudProviderTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        switch (element.nodeType) {
            case 'cluster':
                return new Promise<vscode.TreeItem>((resolve) => {
                    // try to get some information for this cluster
                    k3d.getClusterInfo(shell, element.clusterName).then(function (cluster) {
                        const clusterTreeItem = new vscode.TreeItem(element.clusterName, vscode.TreeItemCollapsibleState.None);
                        clusterTreeItem.contextValue = `k3d.cluster ${k8s.CloudExplorerV1.SHOW_KUBECONFIG_COMMANDS_CONTEXT}`;
                        clusterTreeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

                        // look for this cluster in the list of current clusters
                        if (cluster.succeeded) {
                            // create some description (text that is displayed by the side)
                            // and tooltip for this cluster
                            clusterTreeItem.description = `(${cluster.result.serversRunning} / ${cluster.result.agentsRunning})`;

                            function uniqueStrings(value: string, index: number, self: string[]) {
                                return self.indexOf(value) === index;
                            }

                            let serversCanGrow = "no";
                            if (k3d.getClusterGrowServers(cluster.result)) {
                                clusterTreeItem.contextValue += " k3d.clusterServerGrowable";
                                serversCanGrow = "yes";
                            }

                            clusterTreeItem.tooltip = new vscode.MarkdownString().appendMarkdown(dedent`
                                <strong>k3d cluster _"${element.clusterName}"_ </strong>
                                * ${cluster.result.serversRunning} servers running (${cluster.result.serversCount} total) / ${cluster.result.agentsRunning} agents running (${cluster.result.agentsCount} total)
                                * growable servers: ${serversCanGrow}
                                * created at _${cluster.result.created}_
                                * load balancer: _${cluster.result.hasLoadBalancer}_
                                * images volume: _${cluster.result.imageVolume}_
                                * networks: _${cluster.result.nodes.map((node) => node.network).filter(uniqueStrings).join(",")}_
                                `);
                        }

                        resolve(clusterTreeItem);
                    });
                });

            case 'node':
                return new Promise<vscode.TreeItem>((resolve) => {
                    // try to get some information for this cluster
                    k3d.getClusterInfo(shell, element.clusterName).then(function (cluster) {
                        const nodeTreeItem = new vscode.TreeItem(element.clusterName, vscode.TreeItemCollapsibleState.None);
                        nodeTreeItem.contextValue = `k3d.node`;
                        nodeTreeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

                        // look for this cluster in the list of current clusters
                        if (cluster.succeeded) {
                            const node = cluster.result.nodes.find((node) => node.name === element.nodeName);
                            if (node !== undefined) {
                                // create some description (text that is displayed by the side)
                                // and tooltip for this cluster
                                nodeTreeItem.label = node.name;
                                nodeTreeItem.description = `(${node.role})`;

                                // add some extra "tags" to the context depending on the "role"
                                // this will give us the possibility to add some commands for
                                // specific nodes
                                switch (node.role) {
                                    case "server":
                                        nodeTreeItem.contextValue += ' k3d.nodeServer';

                                        // add the `*Removable` iff it can be removed
                                        // (ie, it is not the last server in the cluster)
                                        if (cluster.result.serversRunning > 1) {
                                            nodeTreeItem.contextValue += ' k3d.nodeServerRemovable';
                                        }
                                        break;

                                    case "agent":
                                        nodeTreeItem.contextValue += ' k3d.nodeAgent k3d.nodeAgentRemovable';
                                        break;
                                }

                                nodeTreeItem.tooltip = new vscode.MarkdownString().appendMarkdown(dedent`
                                    <strong>_"${node.name}"_ (${node.role}) </strong>
                                    * running: _${node.running}_
                                    * cluster: ${element.clusterName}
                                    * created at _${node.created}_
                                    * network: _${node.network}_
                                    `);
                            }

                        }

                        resolve(nodeTreeItem);
                    });
                });

            case 'error':
                const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
                treeItem.tooltip = element.diagnostic;
                return treeItem;

            default:
                break;
        }

        return new vscode.TreeItem("Unknown", vscode.TreeItemCollapsibleState.None);
    }

    getChildren(element?: K3dCloudProviderTreeNode | undefined): vscode.ProviderResult<K3dCloudProviderTreeNode[]> {
        if (element) {
            switch (element.nodeType) {
                case 'cluster':
                    return getNodesForCluster(element.clusterName);
            }

            return [];
        }

        // when no element is passed, get the children of root: the list of clusters
        return getClusters();
    }
}

// getClusters get the current list of k3d clusters
async function getClusters(): Promise<K3dCloudProviderTreeNode[]> {
    const clusters = await k3d.getClusters(shell);
    if (failed(clusters)) {
        return [{ nodeType: 'error', diagnostic: clusters.error[0] }];
    }

    return clusters.result.map((c) => ({ nodeType: 'cluster', clusterName: c.name, } as const));
}

// getNodesForCluster get the current list of nodes in a k3d cluster
async function getNodesForCluster(clusterName: string): Promise<K3dCloudProviderTreeNode[]> {
    const clusters = await k3d.getClusters(shell);
    if (failed(clusters)) {
        return [{ nodeType: 'error', diagnostic: clusters.error[0] }];
    }

    const cluster = clusters.result.find((c) => c.name === clusterName);
    if (cluster === undefined) {
        return [{ nodeType: 'error', diagnostic: `could not find ${clusterName}` }];
    }

    return cluster.nodes.map((node) => ({ nodeType: 'node', clusterName: clusterName, nodeName: node.name, } as const));
}

// getK3dKubeconfigYaml is invoked when we click on "Merge into Kubeconfig"
async function getK3dKubeconfigYaml(clusterName: string): Promise<string | undefined> {
    const kcyaml = await k3d.getKubeconfig(shell, clusterName);
    if (failed(kcyaml)) {
        vscode.window.showErrorMessage(`Can't get kubeconfig for k3d cluster "${clusterName}": ${kcyaml.error[0]}`);
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
