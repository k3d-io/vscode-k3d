import * as vscode from "vscode";

const CHANNEL_ID = "k3d";

export interface ILogChannel {
    showOutput(message: string, title?: string): void;
    appendLine(message: string): void;
}

class LogChannel implements ILogChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel(CHANNEL_ID);

    showOutput(message: string, title?: string): void {
        if (title) {
            const simplifiedTime = (new Date()).toISOString().replace(/z|t/gi, ' ').trim(); // YYYY-MM-DD HH:mm:ss.sss
            const hightlightingTitle = `[${title} ${simplifiedTime}]`;
            this.appendLine(hightlightingTitle);
        }
        this.appendLine(message);
    }

    appendLine(message: string): void {
        this.channel.appendLine(message);
        this.channel.show();
    }
}

export const logChannel: ILogChannel = new LogChannel();
