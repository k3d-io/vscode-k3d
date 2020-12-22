
import { Observable, throwError } from 'rxjs';

import { K3dClusterInfo } from "./k3d.objectmodel";
import { ClusterCreateSettings, createClusterArgsFromSettings } from '../commands/createClusterSettings';
import { getOrInstallK3D, EnsureMode } from '../installer/installer';

import * as config from '../utils/config';
import { getKubeconfigPath } from '../utils/kubeconfig';
import { Errorable, failed } from '../utils/errorable';
import * as shell from '../utils/shell';
import { logChannel } from '../utils/log';
import '../utils/array';
import { minDate } from '../utils/time';


// invokeK3DCommandObj runs the k3d command with some
// arguments and environment
async function invokeK3DCommandObj<T>(
    sh: shell.Shell,
    command: string,
    args: string,
    opts: shell.ExecOpts,
    fn: (stdout: string) => T): Promise<Errorable<T>> {

    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return k3dExe;
    }
    const exe = k3dExe.result;

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
    opts: shell.ExecOpts): Observable<shell.ProcessTrackingEvent> {

    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return throwError(new Error(k3dExe.error[0]));
    }
    const exe = k3dExe.result;

    const cmd = [...(command.split(' ')), ...args];
    logChannel.appendLine(`$ ${exe} ${cmd.join(' ')}`);
    return sh.execTracking(exe, cmd);
}

///////////////////////////////////////////////////////////////////////////////
// create cluster
///////////////////////////////////////////////////////////////////////////////

export function createCluster(sh: shell.Shell,
    settings: ClusterCreateSettings,
    kubeconfig: string | undefined): Observable<shell.ProcessTrackingEvent> {

    let opts = shell.defExecOpts();

    // check if we should set the KUBECONFIG env variable
    const updateKubeconfig = config.getK3DConfigUpdateKubeconfig();
    if (updateKubeconfig &&
        (updateKubeconfig === config.UpdateKubeconfig.Always || updateKubeconfig === config.UpdateKubeconfig.OnCreate)) {
        if (kubeconfig === undefined) {
            const forcedKubeconfig = config.getK3DConfigForcedKubeconfig();
            if (forcedKubeconfig) {
                kubeconfig = forcedKubeconfig;
            } else {
                kubeconfig = getKubeconfigPath();
            }
        }
        opts.env["KUBECONFIG"] = kubeconfig;
    }

    const args: string[] = createClusterArgsFromSettings(settings);
    if (settings.name) {
        return invokeK3DCommandTracking(sh,
            `cluster create ${settings.name}`,
            args,
            opts);
    } else {
        logChannel.appendLine(`[ERROR] no cluster name provided in 'createCluster'`);
        return throwError(new Error(`[ERROR] no cluster name provided in 'createCluster'`));
    }
}

///////////////////////////////////////////////////////////////////////////////
// delete cluster
///////////////////////////////////////////////////////////////////////////////

export function deleteCluster(sh: shell.Shell, clusterName: string): Promise<Errorable<null>> {
    return invokeK3DCommandObj(sh, 'cluster delete', `${clusterName}`, {}, (_) => null);
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
                            created: new Date(node.created)
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

    return invokeK3DCommandObj(sh, 'cluster list -o json', '', {}, parse);
}

// getClusterInfo gets some info for a cluster
export async function getClusterInfo(sh: shell.Shell, clusterName: string): Promise<Errorable<K3dClusterInfo>> {
    const clusters = await getClusters(sh);
    if (clusters.succeeded) {
        for (const cluster of clusters.result) {
            if (cluster.name === clusterName) {
                return {
                    succeeded: true,
                    result: cluster
                };
            }
        }
    }

    return {
        succeeded: false,
        error: [`cluster ${clusterName} not found`]
    };
}

///////////////////////////////////////////////////////////////////////////////
// get kubeconfig
///////////////////////////////////////////////////////////////////////////////

export async function getKubeconfig(sh: shell.Shell, clusterName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `kubeconfig get`, `${clusterName}`, {}, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// add agent node
///////////////////////////////////////////////////////////////////////////////

export async function addAgentTo(sh: shell.Shell, clusterName: string, nodeName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `node create ${nodeName} --cluster ${clusterName} --role agent`, ``, {}, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// remove agent node
///////////////////////////////////////////////////////////////////////////////

export async function deleteAgentFrom(sh: shell.Shell, clusterName: string, nodeName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `node delete ${nodeName}`, ``, {}, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// version
///////////////////////////////////////////////////////////////////////////////

export async function version(sh: shell.Shell): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `version`, '', {}, (s) => s.trim());
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
