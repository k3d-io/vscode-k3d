# Kubernetes [k3d](https://github.com/rancher/k3d) extension for Visual Studio Code

[![Version](https://vsmarketplacebadge.apphb.com/version/inercia.vscode-k3d.svg)](https://marketplace.visualstudio.com/items?itemName=inercia.vscode-k3d)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/inercia.vscode-k3d.svg)](https://marketplace.visualstudio.com/items?itemName=inercia.vscode-k3d)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/inercia.vscode-k3d.svg)](https://vsmarketplacebadge.apphb.com/rating/inercia.vscode-k3d.svg)

## Overview

This extension displays your [k3d](https://github.com/rancher/k3d) local clusters
in the Kubernetes extension's Cloud Explorer. You can use this to create and
delete clusters, and to merge them into your `kubeconfig`.

![](images/screencast-1.gif)

**This is an early stage preview. It's not feature complete! Feature requests
welcome via the issues page. (And let us know about bugs too!)**

This project is heavily based on the [KinD plugin for VSCode](https://github.com/deislabs/kind-vscode).

## Installation

You can find this plugin in the
[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=inercia.vscode-k3d).
You will find detailed installation instructions there.

This extension will download the latest, stable version of `k3d` automatically, although you can
force a specific version of `k3d` with some settings (see [bellow](#Settings)).

## Features

* Create/delete k3d clusters from the Kubernetes view.
* Add/remove nodes to existing k3d clusters.
* Automatically update the kubeconfig after creating/deleting clusters.
* Commands and keyboard shortcuts for all the operations.
* Recycle clusters: remove the oldest cluster and create a new one in just one command.

## Settings

This extension is controlled by a multitude of user settings.

The following list contains all the options and their default values.:

| Option | Default value | Description |
| :--- | :--- | :--- |
| `k3d.paths` | {} | paths for different tools. _[see following settings]_ |
| `k3d.paths.k3d` | "" | this extension will download a recent version of `k3d` automatically, but you can use your own binary by seting this parameter. You can use OS-specific binaries by using `k3d.paths.k3d-{linux,mac,windows}` instead. |
| `k3d.updateKubeconfig` | "always" | update the kubeconfig after creating/destroying a cluster. It can be `always`, `never` or `onCreate`. |
| `k3d.kubeconfig` | "" | use this kubeconfig for making modificatios after creating/destroying clusters. Note well that this kubeconfig must be in the `vs-kubernetes.knownKubeconfigs` for being shown in the clusters view. |
| `k3d.defaults` | {} | defaults for different parameters used for new K3D clusters. _[see following settings]_ |
| `k3d.defaults.image` | "" | default image for new K3D clusters. |
| `k3d.defaults.network` | "" | default existing network for new K3D cluster. |
| `k3d.defaults.numServers` | 1 | default number of server nodes for new K3D clusters. |
| `k3d.defaults.numAgents` | 0 | default number of agent nodes for new K3D clusters. |
| `k3d.defaults.serverArgs` | "" | default K3S server arguments for new K3D clusters. |
| `k3d.images` | {} | images used for creating new K3D cluster nodes |
| `k3d.images.proposals.registry`| `https://registry.hub.docker.com` | registry used for looking for images for the cluster (defaults to the Docker Hub). |
| `k3d.images.proposals.repo` | `rancher/k3s` | image repository used for proposing different images, including the namespace (ie, `rancher/k3s`) |
| `k3d.images.proposals.tagRegex` | "" | filter proposed images with a _regex_ (ie, `.*v1\\.19.*` for filtering all the images with _1.19_). |

Example configuration:

```JSON
    "k3d.updateKubeconfig": "always",
    "k3d.paths": {
        "k3d.paths.k3d-linux": "/home/user/bin/k3d"
    },
    "k3d.defaults": {
        "k3d.defaults.image": "docker.io/rancher/k3s:v1.19.5-k3s1"
    }

```

## Keyboard shortcuts

* `ctr+k` `ctr+c`: create a new cluster with last settings.
* `ctr+k` `ctr+r`: recycle oldest cluster with last settings.

## Development

The easiest way to start coding on the extension is by following these steps:

* `git clone https://github.com/inercia/vscode-k3d.git`
* `code vscode-k3d`
* `npm install` in the terminal, then `F5` to start a new VSCode window
with the extension installed. You can add breakpoints and so on, and you
can see the debug output in `View > Output` and choosing the `k3d` view.
