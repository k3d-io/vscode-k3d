import * as k3d from '../k3d/k3d';

import { tryResolveClusterNode, promptCluster } from './utils';

import { shell } from '../utils/shell';
import { longRunning } from '../utils/host';
import { displayNodeOperationResult } from './utils';

export async function onAddServer(target?: any): Promise<void> {
    if (target) {
        await addServer(target);
    } else {
        await addServerInteractive();
    }
}

async function addServer(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return;  // should never happen
    }
    await addServerNodeToCluster(clusterNode.clusterName);
}

async function addServerInteractive(): Promise<void> {
    const clusterName = await promptCluster('Cluster name', 'Getting existing clusters...');
    if (!clusterName) {
        return;
    }
    await addServerNodeToCluster(clusterName);
}

// addServerByName will be invoked when users click on "Add server"
async function addServerNodeToCluster(clusterName: string): Promise<void> {
    const max = 1000;
    const randInt = Math.floor(Math.random() * (max + 1));
    const nodeName = `${clusterName}-server-${randInt}`;

    const result = await longRunning(`Adding server "${nodeName}" to "${clusterName}"...`,
        () => k3d.addNodeTo(shell, clusterName, nodeName, "server"));

    displayNodeOperationResult(result, clusterName, nodeName, "added");
}
