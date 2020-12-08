# Kubernetes [k3d](https://github.com/rancher/k3d) extension for Visual Studio Code

![GitHub release (latest by date)](https://img.shields.io/github/v/release/inercia/vscode-k3d)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/inercia.vscode-k3d)

## Overview

This extension displays your [k3d](https://github.com/rancher/k3d) local clusters
in the Kubernetes extension's Cloud Explorer. You can use this to create and
delete clusters, and to merge them into your `kubeconfig`.

![](images/screencast-1.gif)

**This is an early stage preview. It's not feature complete! Feature requests
welcome via the issues page. (And let us know about bugs too!)**

This project is heavily based on the [KinD plugin for VSCode](https://github.com/deislabs/kind-vscode).

## Settings

Example:

```JSON
    "vs-kubernetes-k3d": {
        "vs-kubernetes-k3d.k3d-path.linux": "/home/user/bin/k3d"
    }
```

* `vs-kubernetes-k3d.k3d-path`: this extension will download a recent version
of `k3d` automatically, but you can use your own binary by seting this
parameter.

## Development

The easiest way to start coding on the extension is by following these steps:

* `git clone https://github.com/inercia/vscode-k3d.git`
* `code vscode-k3d`
* `npm install` in the terminal, then `F5` to start a new VSCode window
with the extension installed. You can add breakpoints and so on, and you
can see the debug output in `View > Output` and choosing the `k3d` view.
