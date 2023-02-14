import { Observable, throwError } from 'rxjs';
import { ClusterCreateSettings, createClusterArgsFromSettings } from '../commands/createClusterSettings';
import { EnsureMode, getOrInstallK3D } from '../installer/installer';
import '../utils/array';
import { Errorable, failed } from '../utils/errorable';
import * as kubectl from '../utils/kubectl';
import { logChannel } from '../utils/log';
import * as shell from '../utils/shell';
import { minDate } from '../utils/time';
import { K3dClusterInfo, K3dRegistryInfo } from "./k3d.objectmodel";




// invokeK3DCommandObj runs the k3d command with some
// arguments and environment
async function invokeK3DCommandObj<T>(
    sh: shell.Shell,
    command: string,
    args: string,
    fn: (stdout: string) => T): Promise<Errorable<T>> {

    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return k3dExe;
    }
    const exe = k3dExe.result;

    const kubeconfig = await kubectl.getKubeconfigPath();

    const opts = shell.defExecOpts();
    opts.env["KUBECONFIG"] = kubeconfig;

    const cmd = `${exe} ${command} ${args}`;
    logChannel.appendLine(`$ ${cmd}`);

    function andLog<T>(fn: (s: string) => T): (s: string) => T {
        return (s: string) => {
            logChannel.appendLine(strippedLines(s).join("\n"));
            return fn(s);
        };
    }

    return await sh.execObj<T>(cmd, `${exe} ${command}`, opts, andLog(fn));
}

function invokeK3DCommandTracking(
    sh: shell.Shell,
    command: string,
    args: string[],
    kubeconfig?: string): Observable<shell.ProcessTrackingEvent> {

    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return throwError(new Error(k3dExe.error[0]));
    }
    const exe = k3dExe.result;

    const opts = shell.defExecOpts();
    if (kubeconfig) {
        opts.env["KUBECONFIG"] = kubeconfig;
    }

    const cmd = [...(command.split(' ')), ...args];
    logChannel.appendLine(`$ ${exe} ${cmd.join(' ')}`);
    return sh.execTracking(exe, cmd, opts);
}

///////////////////////////////////////////////////////////////////////////////
// create cluster
///////////////////////////////////////////////////////////////////////////////

export function createCluster(sh: shell.Shell,
    settings: ClusterCreateSettings,
    kubeconfig: string,
    switchContext = true): Observable<shell.ProcessTrackingEvent> {

    const args: string[] = createClusterArgsFromSettings(settings, switchContext);
    if (settings.name) {
        return invokeK3DCommandTracking(sh, `cluster create ${settings.name}`, args, kubeconfig);
    } else {
        logChannel.appendLine(`[ERROR] no cluster name provided in 'createCluster'`);
        return throwError(new Error(`[ERROR] no cluster name provided in 'createCluster'`));
    }
}

///////////////////////////////////////////////////////////////////////////////
// delete cluster
///////////////////////////////////////////////////////////////////////////////

export function deleteCluster(sh: shell.Shell, clusterName: string): Promise<Errorable<null>> {
    return invokeK3DCommandObj(sh, 'cluster delete', `${clusterName}`, (_) => null);
}

///////////////////////////////////////////////////////////////////////////////
// list clusters
///////////////////////////////////////////////////////////////////////////////

// getClusters gets the list of current K3D clusters
export async function getClusters(sh: shell.Shell): Promise<Errorable<K3dClusterInfo[]>> {
    function parse(stdout: string): K3dClusterInfo[] {
        return JSON.parse(stdout)
            .map((cluster: any) => (
                {
                    name: cluster.name,
                    nodes: cluster.nodes.map((node: any) => (
                        {
                            name: node.name,
                            network: node.Network,
                            role: node.role,
                            running: new String(node.State.Running).trim().toLowerCase() === 'true',
                            image: node.image,
                            created: new Date(node.created),
                            cmd: node.Cmd
                        })),
                    agentsCount: cluster.agentsCount,
                    agentsRunning: cluster.agentsRunning,
                    serversCount: cluster.serversCount,
                    serversRunning: cluster.serversRunning,
                    hasLoadBalancer: new String(cluster.hasLoadbalancer).trim().toLowerCase() === 'true',
                    imageVolume: cluster.imageVolume,
                    created: minDate(cluster.nodes.map((node: any) => new Date(node.created)))
                }))
            .orderBy((cluster: K3dClusterInfo) => cluster.name);
    }

    return invokeK3DCommandObj(sh, 'cluster list -o json', '', parse);
}

// getClusterInfo gets some info for a cluster
export async function getClusterInfo(sh: shell.Shell, clusterName: string): Promise<Errorable<K3dClusterInfo>> {
    const clusters = await getClusters(sh);
    if (clusters.succeeded) {
        for (const cluster of clusters.result) {
            if (cluster.name === clusterName) {
                return { succeeded: true, result: cluster };
            }
        }
    }

    return { succeeded: false, error: [`cluster ${clusterName} not found`] };
}

// getClustersNetworks returns all the existing clusters networks
export async function getClustersNetworks(sh: shell.Shell): Promise<Errorable<string[]>> {
    const clusters = await getClusters(sh);
    if (!clusters.succeeded) {
        return clusters;
    }

    let res: string[] = [];

    // for each cluster, go through all the nodes obtaining all the networks
    clusters.result.forEach((cluster) => res = res.concat(cluster.nodes.map((node) => node.network)));

    // remove duplicates in the result
    res = res.filter((thing, i, arr) => arr.findIndex(t => t === thing) === i);

    return { succeeded: true, result: res };
}

///////////////////////////////////////////////////////////////////////////////
// registries
///////////////////////////////////////////////////////////////////////////////

// getRegistries gets the list of current K3D registries
export async function getRegistries(sh: shell.Shell): Promise<Errorable<K3dRegistryInfo[]>> {
    function parse(stdout: string): K3dRegistryInfo[] {
        return JSON.parse(stdout)
            .map((registry: any) => (
                {
                    name: registry.name,
                    network: registry.Network,
                    created: new Date(registry.created),
                    status: registry.State.Status
                }))
            .orderBy((registry: K3dRegistryInfo) => registry.name);
    }

    return invokeK3DCommandObj(sh, 'registry list -o json', '', parse);
}

///////////////////////////////////////////////////////////////////////////////
// get kubeconfig
///////////////////////////////////////////////////////////////////////////////

export async function getKubeconfig(sh: shell.Shell, clusterName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `kubeconfig get`, `${clusterName}`, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// add node
///////////////////////////////////////////////////////////////////////////////

export async function addNodeTo(sh: shell.Shell, clusterName: string, nodeName: string, role: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `node create ${nodeName} --cluster ${clusterName} --role ${role}`, ``, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// remove node
///////////////////////////////////////////////////////////////////////////////

export async function deleteNodeFrom(sh: shell.Shell, clusterName: string, nodeName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `node delete ${nodeName}`, ``, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// version
///////////////////////////////////////////////////////////////////////////////

export async function version(sh: shell.Shell): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `version`, '', (s) => s.trim());
}

///////////////////////////////////////////////////////////////////////////////
// current cluster
///////////////////////////////////////////////////////////////////////////////

export async function getCurrentCluster(): Promise<Errorable<string>> {
    const context = await kubectl.getContext();
    return { succeeded: true, result: kubectl.getClusterForContext(context) };
}

///////////////////////////////////////////////////////////////////////////////
// utils
///////////////////////////////////////////////////////////////////////////////

export function strippedLines(s: string): string[] {
    // skip the first charts in the line (the `INFO[0000]` stuff)
    return s.split(/\r?\n/)
        .map((l) => l.substring(20))
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
}

// utility function for checking if a cluster can grow the number of servers
export function getClusterGrowServers(clusterInfo: K3dClusterInfo): boolean {
    if (clusterInfo.serversCount >= 2) {
        return true;
    }

    // check if we can find the `--cluster-init` argument in some of the servers
    if (clusterInfo.nodes.
        filter((node) => node.role === "server").
        map((node) => node.cmd.join(" ")).
        join(" ").
        includes("cluster-init")) {
        return true ;
    }

    return false;
}