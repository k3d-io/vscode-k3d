import * as settings from './createClusterSettings';
import { promptClusterSettings, createClusterInteractive } from './createCluster';
import { deleteClusterByName } from './deleteCluster';
import { tryResolveClusterNode } from './utils';

import * as k3d from '../k3d/k3d';
import * as model from '../k3d/k3d.objectmodel';

import * as config from '../utils/config';
import { shell } from '../utils/shell';
import * as kubectl from '../utils/kubectl';

//////////////////////////////////////////////////////////////////////////////////////////////
// commands entrypoints
//////////////////////////////////////////////////////////////////////////////////////////////

// entrypoint for the "k3d: replace cluster" command
export async function onReplaceCluster(target?: any): Promise<void> {
    const defaultSettings = settings.forNewCluster(settings.getDefaultClusterSettings());
    const providedSettings = await promptClusterSettings(defaultSettings);
    if (providedSettings.cancelled) {
        return;
    }
    return replaceCluster(providedSettings.value, target);
}

// entrypoint for the "k3d: replace cluster (with last settings)" command
export async function onReplaceClusterLast(target?: any): Promise<void> {
    const lastSettings = settings.forNewCluster(settings.getLastClusterSettings());
    return replaceCluster(lastSettings, target);
}

//////////////////////////////////////////////////////////////////////////////////////////////

export async function replaceCluster(createSettings: settings.ClusterCreateSettings, target?: any): Promise<void> {
    let actions: Promise<void>[] = [];

    const promisedClusters = await k3d.getClusters(shell);
    let clustersByCreation: model.K3dClusterInfo[] = [];
    if (promisedClusters.succeeded && promisedClusters.result.length > 0) {
        clustersByCreation = promisedClusters.result.orderBy((cluster: model.K3dClusterInfo) => cluster.created);
    }

    // check if the user selected a cluster in the UI
    let deleteName = "";
    const selectedCluster = await tryResolveClusterNode(target);
    if (selectedCluster !== undefined) {
        deleteName = selectedCluster.clusterName;
    } else if (clustersByCreation.length > 0) {
        // check if we can remove an old cluster: in that case, add an action for removing it
        deleteName = clustersByCreation[0].name;
    }

    if (deleteName !== "") {
        actions.push(deleteClusterByName(deleteName, false));
    }

    // calculate the new cluster that will be active after delete/create
    let switchContext = true;
    const behaviour = config.getK3DReplaceContext();
    if (behaviour && (behaviour === config.ReplaceContext.OldestCluster) && clustersByCreation.length > 1) {
        // when using the `OldestCluster`, we must switch to the oldest cluster
        // that will be alive (after removing the deleted cluster).
        const remainingClusters = clustersByCreation.filter((cluster: model.K3dClusterInfo) => cluster.name !== deleteName);
        if (remainingClusters.length > 0) {
            const newContext = `k3d-${remainingClusters[0].name}`;

            actions.push(kubectl.setContext(newContext));
            switchContext = false;
        }
    }
    actions.push(createClusterInteractive(createSettings, switchContext));

    if (target) {
        await Promise.all(actions);
        return;
    }
    await Promise.all([actions]);
}
