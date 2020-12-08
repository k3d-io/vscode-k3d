
// import * as config from '../config/config';
import { Errorable, failed } from '../utils/errorable';
import * as shell from '../utils/shell';
import { K3dClusterInfo } from "./k3d.objectmodel";
import { Observable, throwError } from 'rxjs';
import { logChannel } from '../utils/log';
import '../utils/array';

import { getOrInstallK3D, EnsureMode } from '../installer/installer';

// import { ListenOptions } from 'net';

async function invokeK3DCommandObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return k3dExe;
    }
    const exe = k3dExe.result;

    const cmd = `${exe} ${command} ${args}`;
    logChannel.appendLine(`$ ${cmd}`);

    function andLog<T>(fn: (s: string) => T): (s: string) => T {
        return (s: string) => {
            logChannel.appendLine(s);
            return fn(s);
        };
    }

    return await sh.execObj<T>(cmd, `${exe} ${command}`, opts, andLog(fn));
}

function invokeTracking(sh: shell.Shell, command: string, ...args: string[]): Observable<shell.ProcessTrackingEvent> {
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

// Settings used for creating the cluster
export interface ClusterCreateSettings {
    readonly name: string;
    readonly image: string;
    readonly numServers: number;
    readonly numAgents: number;
}

export const FIELD_CLUSTER_NAME = 'cluster_name';
export const FIELD_CUSTOM_IMAGE = 'cluster_image_custom';
export const FIELD_NUM_SERVERS = 'cluster_num_servers';
export const FIELD_NUM_AGENTS = 'cluster_num_agents';

export function createClusterSettingsFromForm(s: any): ClusterCreateSettings {
    const name = s[FIELD_CLUSTER_NAME];
    const image = s[FIELD_CUSTOM_IMAGE];
    const numServers = +s[FIELD_NUM_SERVERS];
    const numAgents = +s[FIELD_NUM_AGENTS];

    return {
        name,
        image,
        numServers,
        numAgents
    };
}

export const createClusterHTMLHeader = "<h1>Create k3d cluster</h1>";

// createClusterHTML is the form that is shown when creating a new cluster
export const createClusterHTML = `
    Create a new k3s cluster with containerized nodes (k3s in docker).
    Every cluster will consist of one or more containers:
    <ul>
        <li>1 (or more) server node container (k3s)</li>
        <li>(optionally) 1 loadbalancer container as the entrypoint to the cluster (nginx)</li>
        <li>(optionally) 1 (or more) agent node containers (k3s)</li>
    </ul>
    <p/>
    <hr>
    <p/>
    <p>Cluster name: <input type='text' name='${FIELD_CLUSTER_NAME}' value='k3d-default' /></p>
    <p>Number of servers: <input type='text' name='${FIELD_NUM_SERVERS}' value='1' size='2' /></p>
    <p>Number of agents: <input type='text' name='${FIELD_NUM_AGENTS}' value='0' size='2' /></p>
    <p>Node image (custom image takes precedence if specified): <input type='text' name='${FIELD_CUSTOM_IMAGE}' value='' /></p>
    `;

export function createClusterArgsFromSettings(settings: ClusterCreateSettings): string[] {
    const args: string[] = [];

    if (settings.numServers > 0) {
        args.push("--servers", `${settings.numServers}`);
    }
    if (settings.numAgents > 0) {
        args.push("--agents", `${settings.numAgents}`);
    }
    if (settings.image !== "") {
        args.push("--image", `${settings.image}`);
    }
    return args;
}

export function createCluster(sh: shell.Shell, settings: ClusterCreateSettings, configFilePath: string | undefined): Observable<shell.ProcessTrackingEvent> {
    const args: string[] = createClusterArgsFromSettings(settings);
    return invokeTracking(sh, 'cluster create', settings.name, ...args);
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
            .map((l: any) => ({ name: l.name }))
            .orderBy((c: K3dClusterInfo) => c.name);
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
