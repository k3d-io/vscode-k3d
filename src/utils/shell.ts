'use strict';

import * as rx from '../../node_modules/rxjs';
import * as shelljs from 'shelljs';
import * as spawnrx from 'spawn-rx';
import * as vscode from 'vscode';

import { Errorable } from './errorable';

export interface ExecOpts {
    readonly cwd?: string;
}

export interface Shell {
    exec(cmd: string, stdin?: string): Promise<Errorable<ShellResult>>;
    execObj<T>(cmd: string, cmdDesc: string, opts: ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>>;
    execTracking(cmd: string, args: string[]): rx.Observable<ProcessTrackingEvent>;
}

export const shell: Shell = {
    exec: exec,
    execObj: execObj,
    execTracking: execTracking,
};

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;

function execOpts(): any {
    const env = process.env;
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}

async function exec(cmd: string, stdin?: string): Promise<Errorable<ShellResult>> {
    try {
        return { succeeded: true, result: await execCore(cmd, execOpts(), stdin) };
    } catch (ex) {
        return { succeeded: false, error: [`Error invoking '${cmd}: ${ex}`] };
    }
}

async function execObj<T>(cmd: string, cmdDesc: string, opts: ExecOpts, fn: ((stdout: string) => T)): Promise<Errorable<T>> {
    const o = Object.assign({}, execOpts(), opts);
    try {
        const sr = await execCore(cmd, o);
        if (sr.code === 0) {
            const value = fn(sr.stdout);
            return { succeeded: true, result: value };
        } else {
            return { succeeded: false, error: [`${cmdDesc} error: ${sr.stderr}`] };
        }
    } catch (ex) {
        return { succeeded: false, error: [`Error invoking '${cmd}: ${ex}`] };
    }
}

function execCore(cmd: string, opts: any, stdin?: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve, _reject) => {
        const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({ code: code, stdout: stdout, stderr: stderr }));
        if (stdin) {
            proc.stdin.end(stdin);
        }
    });
}

function execTracking(command: string, args: string[]): rx.Observable<ProcessTrackingEvent> {
    const eventSubject = new rx.Subject<ProcessTrackingEvent>();
    let pendingOut = '';
    let stderr = '';
    const spawnEvents = spawnrx.spawn<{ source: 'stdout' | 'stderr', text: string }>(command, args, { split: true });
    spawnEvents.subscribe(
        (chunk) => {
            const isStdOut = chunk.source === 'stdout';
            if (isStdOut) {
                const todo = pendingOut + chunk.text;
                const lines = todo.split('\n').map((l) => l.trim());
                const lastIsWholeLine = todo.endsWith('\n');
                const newPending = lastIsWholeLine ? '' : lines.pop()!;
                pendingOut = newPending;
                for (const line of lines) {
                    eventSubject.next({ eventType: 'line', text: line });
                }
            } else {
                stderr = stderr + chunk.text;
            }
        },
        (error) => {
            eventSubject.next({ eventType: 'failed', exitCode: exitCodeFrom(error), stderr: stderr });
            eventSubject.complete();
        },
        () => {
            eventSubject.next({ eventType: 'succeeded' });
            eventSubject.complete();
        });
    return eventSubject;
}

export interface LineEvent {
    readonly eventType: 'line';
    readonly text: string;
}

export interface ProcessSucceededEvent {
    readonly eventType: 'succeeded';
}

export interface ProcessFailedEvent {
    readonly eventType: 'failed';
    readonly exitCode: 'no-program' | number | undefined;
    readonly stderr: string;
}

export type ProcessTrackingEvent = LineEvent | ProcessSucceededEvent | ProcessFailedEvent;

function exitCodeFrom(error: any): 'no-program' | number | undefined {
    if (error.errno === 'ENOENT' || error.code === 'ENOENT') {
        return 'no-program';
    }
    const prefix = 'Failed with exit code: ';
    if (error.message && error.message.startsWith && error.message.startsWith(prefix)) {
        return Number.parseInt((error.message as string).substring(prefix.length));
    }
    return undefined;
}
