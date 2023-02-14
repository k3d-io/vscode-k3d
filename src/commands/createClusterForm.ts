import * as vscode from 'vscode';

import { getClustersNetworks, getRegistries } from '../k3d/k3d';

import * as config from '../utils/config';
import * as docker from '../utils/docker';
import { Errorable, failed } from '../utils/errorable';
import { longRunning } from '../utils/host';
import { logChannel } from "../utils/log";
import * as registry from '../utils/registry';
import { shell } from '../utils/shell';

import { ClusterCreateSettings } from './createClusterSettings';

const DEFAULT_IMAGE_REGISTRY = "https://registry.hub.docker.com";
const DEFAULT_IMAGE_REPO = "rancher/k3s";

// names of all the fields in the "create cluster" form
export const FIELD_CLUSTER_NAME = 'cluster_name';
export const FIELD_CUSTOM_IMAGE = 'cluster_image_custom';
export const FIELD_NUM_SERVERS = 'cluster_num_servers';
export const FIELD_NUM_AGENTS = 'cluster_num_agents';
export const FIELD_LOAD_BALANCER = 'cluster_lb';
export const FIELD_EXISTING_NET = 'cluster_net';
export const FIELD_SERVER_ARGS = 'cluster_server_args';
export const FIELD_CREATE_REGISTRY = 'create_registry';
export const FIELD_EXISTING_REGISTRIES = 'existing_registries';
export const FIELD_GROW_SERVERS = 'cluster_grow_servers';

// getCreateClusterFormStyle returns the style for the create form page
export function getCreateClusterFormStyle(): string {
  const ui = {
    [vscode.ColorThemeKind.Light]: "light",
    [vscode.ColorThemeKind.Dark]: "dark",
    [vscode.ColorThemeKind.HighContrast]: "dark",
    [vscode.ColorThemeKind.HighContrastLight]: "light",
  }[vscode.window.activeColorTheme.kind];

  // TODO: there must be a better way to do this...
  const blackColor = ui === "dark" ? "lightgrey" : "lightslategrey";

  return `
  .input-counter {
    height: 20px;
    width: 40px;
    text-align: center;
    border:1px solid #ddd;
    border-radius: 4px;
    display: inline-block;
  }

  label {
    display: inline-block;
    width: 200px;
    text-align: right;
    padding-right: 5px;
  }​

  .block {
    padding: 1em;
  }

  .number-block{
    display: inline-block;
  }

  section {
    padding-top: 4rem;
    padding-bottom: 4rem;
    width: 50%;
    margin: auto;
  }

  details {
    padding: 10px 10px 10px 0px;
  }

  details[open] summary ~ * {
    animation: open 0.3s ease-in-out;
  }

  @keyframes open {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details summary {
    width: 100%;
    padding: 0.5rem 0;
    border-top: 1px solid ${blackColor};
    position: relative;
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: 300;
    list-style: none;
  }

  details summary:after {
    content: "+";
    color: ${blackColor};
    position: absolute;
    font-size: 1.75rem;
    line-height: 0;
    margin-top: 0.75rem;
    right: 0;
    font-weight: 200;
    transform-origin: center;
    transition: 200ms linear;
  }

  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 2rem;
  }

  details summary {
    outline: 0;
  }

  details p {
    font-size: 0.95rem;
    margin: 0 0 1rem;
    padding-top: 1rem;
  }
`;
}

export function getCreateClusterFormJavascript(): string {
  return `
`;
}

// createClusterHTML is the form that is shown when creating a new cluster
export async function getCreateClusterForm(defaults: ClusterCreateSettings): Promise<string> {

  //////////////////////////
  // general settings
  //////////////////////////
  let res = `
    <details open>
        <summary>General Settings</summary>
        <h6>
            Every cluster will consist of one or more containers:
            <ul>
                <li>1 (or more) server node container (k3s)</li>
                <li>(optionally) 1 loadbalancer container as the entrypoint to the cluster (nginx)</li>
                <li>(optionally) 1 (or more) agent node containers (k3s)</li>
            </ul>
        </h6>
        <div class="block">
            <label for="clusterName">
                Cluster name
            </label>
            <input name='${FIELD_CLUSTER_NAME}' value='${defaults.name}' type="text" id="clusterName" autofocus>
        </div>
        <div class="block">
            <label for="numServers">
                Num. servers
            </label>
            <div class="number-block">
                <input name='${FIELD_NUM_SERVERS}' value='${defaults.numServers}'
                    type="number" id="numServers" class="input-counter" min="1" max="99"/>
            </div>
        </div>
        <div class="block">
            <label for="numAgents">
                Num. agents
            </label>
            <div class="number-block">
                <input name='${FIELD_NUM_AGENTS}' value='${defaults.numAgents}'
                    type="number" id="numAgents" class="input-counter" min="0" max="99"/>
            </div>
        </div>
    </details>
  `;

  //////////////////////////
  // cluster node images
  //////////////////////////
  let datalistParam = "";
  let datalistExplain = "";

  const images = await getProposedImages();
  if (!images.succeeded) {
    await vscode.window.showErrorMessage(`Could not obtain a list of proposed images: ${images.error}.`);
  } else {
    // when a list of images is available, create a `datalist` with all the image:tag, and
    // add a`list=images` to the <input>
    const imagesNames = images.result;
    if (imagesNames.length > 0) {
      res += `<datalist id="images">`;
      res += imagesNames.map((s) => `<option value="${s}">${s}</option>`).join("\n");
      res += `</datalist>`;

      const imageRepo = config.getK3DConfigImages("proposalsRepo", DEFAULT_IMAGE_REPO);
      const imageRegistry = config.getK3DConfigImages("proposalsRegistry", DEFAULT_IMAGE_REGISTRY);

      datalistParam = `list="images"`;
      datalistExplain = `
      <li> ... or accept one of proposals in the dropdown menu (obtained for "${imageRepo}" from ${imageRegistry}).</li>`;
    }
  }

  res += `
    <details>
        <summary>Image</summary>
        <h6>
            The image used for creating all the nodes in the cluster.
            <ul>
              <li> Leave empty for using the default image.</li>
              <li> You can also provide your own image name (ie, "k3d-io/k3d:v1.18")</li>
              ${datalistExplain}
            </ul>
        </h6>
        <div class="block">
            <label for="nodeImage">
                Node image
            </label>
            <input name='${FIELD_CUSTOM_IMAGE}' value='${defaults.image}' type="text" id="nodeImage" ${datalistParam}>
        </div>
    </details>
    `;

  //////////////////////////
  // registries
  //////////////////////////
  datalistParam = "";
  const registriesResult = await getRegistries(shell);
  if (!registriesResult.succeeded) {
    await vscode.window.showErrorMessage(`Could not obtain list of k3d registries: ${registriesResult.error}.`);
  } else {
    const registries = registriesResult.result;
    if (registries.length > 0) {
      res += `<datalist id="registries">`;
      res += registries.map((s) => `<option value="${s.name}">${s.name} (${s.status})</option>`).join("\n");
      res += `</datalist>`;

      datalistParam = `list="registries"`;
    }
  }

  res += `
    <details>
        <summary>Registry</summary>
        <h6>
            Start a local registry or connect to one of the existing local registries available.
        </h6>
        <div class="block">
            <label for="createRegistry">
                Create local registry
            </label>
            <input name='${FIELD_CREATE_REGISTRY}' type="checkbox" id="createRegistry"
                value='${defaults.createRegistry ? "true" : "false"}'
                onClick="this.value = this.checked"
                ${defaults.createRegistry ? "checked" : ""}>
        </div>
    `;

  if (registriesResult.succeeded && registriesResult.result.length > 0) {
    res += `
        <div class="block">
            <label for="useRegistries">
                Use existing registries
            </label>
            <input name='${FIELD_EXISTING_REGISTRIES}' value='${defaults.useRegistries}'
                   type="text" id="useRegistries" ${datalistParam}>
        </div>
    `;
  }

  res += `
    </details>
    `;

  //////////////////////////
  // network settings
  //////////////////////////
  datalistParam = "";
  const result = await getClustersNetworks(shell);
  if (!result.succeeded) {
    await vscode.window.showErrorMessage(`Could not obtain list of k3d networks: ${result.error}.`);
  } else {
    const networkNames = result.result;
    if (networkNames.length > 0) {
      res += `<datalist id="networks">`;
      res += networkNames.map((s) => `<option value="${s}">${s}</option>`).join("\n");
      res += `</datalist>`;

      datalistParam = `list="networks"`;
    }
  }

  res += `
    <details>
        <summary>Network</summary>
        <h6>
            Some network customizations. You are probably safe with default values.
        </h6>
  `;

  if (result.succeeded && result.result.length > 0) {
    res += `
        <div class="block">
            <label for="clusterNet">
                Use existing network
            </label>
            <input name='${FIELD_EXISTING_NET}' value='${defaults.network}' type="text" id="clusterNet" ${datalistParam}>
        </div>
  `;
  }

  res += `
    </details>
    `;

  //////////////////////////
  // advanced settings
  //////////////////////////
  res += `
    <details>
        <summary>Advanced settings</summary>
        <h6>
            Advanced settings, do not change these unless you are really sure what you are doing.
        </h6>
        <div class="block">
            <label for="lb">
                Load Balancer
            </label>
            <input name='${FIELD_LOAD_BALANCER}' type="checkbox" id="lb"
                value='${defaults.lb ? "true" : "false"}'
                onClick="this.value = this.checked"
                ${defaults.lb ? "checked" : ""}>
        </div>
        <div class="block">
            <label for="grow">
                Growable servers
            </label>
            <input name='${FIELD_GROW_SERVERS}' type="checkbox" id="grow"
                value='${defaults.growServers ? "true" : "false"}'
                onClick="this.value = this.checked"
                ${defaults.growServers ? "checked" : ""}>
        </div>
        <div class="block">
            <label for="serverArgs">
                Extra <a href="https://rancher.com/docs/k3s/latest/en/installation/install-options/server-config/">K3S server arguments</a>
            </label>
            <input name='${FIELD_SERVER_ARGS}' value='${defaults.serverArgs}' type="text" id="serverArgs">
        </div>
    </details>
    `;

  return res;
}

export function createClusterSettingsFromForm(s: any): ClusterCreateSettings {
  const name: string = s[FIELD_CLUSTER_NAME];
  const image: string = s[FIELD_CUSTOM_IMAGE];
  const numServers: number = +s[FIELD_NUM_SERVERS];
  const growServers: boolean = s[FIELD_GROW_SERVERS] === "true" ? true : false;
  const numAgents: number = +s[FIELD_NUM_AGENTS];
  const lb: boolean = s[FIELD_LOAD_BALANCER] === "true" ? true : false;
  const network: string = s[FIELD_EXISTING_NET];
  const serverArgs: string = s[FIELD_SERVER_ARGS];
  const createRegistry: boolean = s[FIELD_CREATE_REGISTRY] === "true" ? true : false;
  const useRegistries: string[] = s[FIELD_EXISTING_REGISTRIES] ? s[FIELD_EXISTING_REGISTRIES].split(",") : [];

  return {
    name: name,
    image: image,
    numServers: numServers,
    growServers: growServers,
    numAgents: numAgents,
    network: network,
    lb: lb,
    serverArgs: serverArgs,
    createRegistry: createRegistry,
    useRegistries: useRegistries
  };
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
// images proposals
/////////////////////////////////////////////////////////////////////////////////////////////////////

// getProposedImages obtains a list of proposed images by querying the registry about tags
// for a given image name.
async function getProposedImages(): Promise<Errorable<string[]>> {
  const imageRepo: string = config.getK3DConfigImages("proposalsRepo", DEFAULT_IMAGE_REPO);
  if (imageRepo.length === 0) {
    logChannel.showOutput(`[images proposals] disabled by empty proposalsRepo`);
    return { succeeded: true, result: [] };
  }

  const imageRegistry = config.getK3DConfigImages("proposalsRegistry", DEFAULT_IMAGE_REGISTRY);
  if (imageRegistry.length === 0) {
    logChannel.showOutput(`[images proposals] disabled by empty proposalsRegistry`);
    return { succeeded: true, result: [] };
  }

  const components = imageRepo.split('/').slice(0, 2);
  if (components.length < 2) {
    const errorMsg = `proposalsRepo "${imageRepo}" does not contain namespace/repo`;
    logChannel.showOutput(`[images proposals] error: ${errorMsg}`);
    return { succeeded: false, error: [errorMsg] };
  }

  const imageNamespace = components[0];
  const imageName = components[1];

  const imageTagFilterConfig = config.getK3DConfigImages("proposalsTagRegex", "");
  const imageTagFilterRegex = imageTagFilterConfig ? new RegExp(imageTagFilterConfig, 'g') : undefined;

  let imageArchFilter = "";
  try {
    const dockerInfo = await docker.getDockerInfo(config.getK3DDockerHost());
    imageArchFilter = dockerInfo.architecture;
  } catch (error) {
    // TODO: could not obtain architecture info from docker info... show some message?
    imageArchFilter = "x86_64";
  }

  try {
    const tags = await longRunning(`Obtaining image proposals for "${imageRepo}" (from ${imageRegistry})...`,
      () => registry.registryTagsForImage(imageRegistry, imageNamespace, imageName, imageTagFilterRegex, imageArchFilter));
    if (failed(tags)) {
      logChannel.showOutput(`[images proposals] error: ${tags.error}`);
      return { succeeded: false, error: tags.error };
    } else {
      logChannel.showOutput(`[images proposals]  ${tags.result.length} images obtained`);
      const tagsResult = tags.result;
      return { succeeded: true, result: tagsResult.map((tag) => `${imageRepo}:${tag.name}`) };
    }
  } catch (error) {
    logChannel.showOutput(`[images proposals] error: ${error}`);
    return { succeeded: false, error: error as string[]};
  }
}
