# k3d extension for Visual Studio Code

This extension displays your `k3d` local cluster in the Kubernetes extension's Cloud Explorer.
You can use this to create and delete clusters, and to merge them into your kubeconfig.

**This is an early stage preview. It's not feature complete! Feature requests welcome via the issues page.
(And let us know about bugs too!)**

This project is heavily based on the [KinD plugin for VSCode](https://github.com/deislabs/kind-vscode).

# Prerequisites

You must have a recent `k3d` binary on your system path.  You can download the binaries for your
operating system from https://github.com/rancher/k3d/releases. In particular, `k3d` must support
JSON output.

You can set the path to your k3d executble with the `k3d.path` setting.

# Development

* `git clone https://github.com/inercia/vscode-k3d.git`
* `code vscode-k3d`
* `npm install` in the terminal, then `F5` to run it in a new window.

You can see the debug output in `View > Output` and choosing the `k3d` view.
