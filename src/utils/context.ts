import { ExtensionContext } from "vscode";

// Provides access to the current extension context.
export class Context {
    private static _current: ExtensionContext;

    static register(extensionExtension: ExtensionContext): void {
        this._current = extensionExtension;
    }

    static get current(): ExtensionContext {
        return this._current;
    }
}
