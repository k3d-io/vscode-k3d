import * as k3d from "../k3d/k3d";

import { tryResolveClusterNode, promptCluster } from "./utils";

import { shell } from "../utils/shell";
import { longRunning } from "../utils/host";
import { displayNodeOperationResult } from "./utils";

export async function onAddAgent(target?: any): Promise<void> {
    if (target) {
        await addAgent(target);
    } else {
        await addAgentInteractive();
    }
}

async function addAgent(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return; // should never happen
    }
    await addAgentNodeToCluster(clusterNode.clusterName);
}

async function addAgentInteractive(): Promise<void> {
    const clusterName = await promptCluster(
        "Cluster name",
        "Getting existing clusters..."
    );
    if (!clusterName) {
        return;
    }
    await addAgentNodeToCluster(clusterName);
}

// addAgentByName will be invoked when users click on "Add agent"
async function addAgentNodeToCluster(clusterName: string): Promise<void> {
    const max = 1000;
    const randInt = Math.floor(Math.random() * (max + 1));
    const nodeName = `${clusterName}-agent-${randInt}`;

    const result = await longRunning(
        `Adding agent "${nodeName}" to "${clusterName}"...`,
        () => k3d.addNodeTo(shell, clusterName, nodeName, "agent")
    );

    displayNodeOperationResult(result, clusterName, nodeName, "added");
}
