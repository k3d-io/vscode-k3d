
import { ClusterCreateSettings } from './createClusterSettings';

export const FIELD_CLUSTER_NAME = 'cluster_name';
export const FIELD_CUSTOM_IMAGE = 'cluster_image_custom';
export const FIELD_NUM_SERVERS = 'cluster_num_servers';
export const FIELD_NUM_AGENTS = 'cluster_num_agents';

export const createClusterHTMLHeader = "<h1>Create k3d cluster</h1>";

// createClusterHTML is the form that is shown when creating a new cluster
export function getCreateClusterForm(defaults: ClusterCreateSettings): string {
    return `
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
    <p>Cluster name: <input type='text' name='${FIELD_CLUSTER_NAME}' value='${defaults.name}' /></p>
    <p>Number of servers: <input type='text' name='${FIELD_NUM_SERVERS}' value='${defaults.numServers}' size='2' /></p>
    <p>Number of agents: <input type='text' name='${FIELD_NUM_AGENTS}' value='${defaults.numAgents}' size='2' /></p>
    <p>Node image (custom image takes precedence if specified): <input type='text' name='${FIELD_CUSTOM_IMAGE}' value='${defaults.image}' /></p>
    `;
}

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
