
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
    const shouldUpdateKubeconfig = config.getK3DCreateClusterConfigUpdateKubeconfig();
    if (shouldUpdateKubeconfig !== undefined && shouldUpdateKubeconfig) {
        if (kubeconfig === undefined) {
            const forcedKubeconfig = config.getK3DCreateClusterForcedKubeconfig();
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
                            running: node.State.Running,
                            image: node.image,
                        })),
                    agentsCount: cluster.agentsCount,
                    agentsRunning: cluster.agentsRunning,
                    serversCount: cluster.serversCount,
                    serversRunning: cluster.serversRunning,
                    hasLoadBalancer: cluster.hasLoadBalancer,
                    imageVolume: cluster.imageVolume
                }))
            .orderBy((cluster: K3dClusterInfo) => cluster.name);
    }

    return invokeK3DCommandObj(sh, 'cluster list -o json', '', {}, parse);
}

///////////////////////////////////////////////////////////////////////////////
// get kubeconfig
///////////////////////////////////////////////////////////////////////////////

export async function getKubeconfig(sh: shell.Shell, clusterName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `kubeconfig get`, `${clusterName}`, {}, (s) => s);
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
