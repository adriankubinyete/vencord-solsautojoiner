/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec } from "child_process";
import { IpcMainInvokeEvent } from "electron";

export async function openRoblox(
    _: IpcMainInvokeEvent,
    uri: string
): Promise<void> {
    const { platform } = process;
    let command: string;

    switch (platform) {
        case "win32":
            command = `start "" "${uri}"`;
            break;
        case "darwin":
            command = `open "${uri}"`;
            break;
        default:
            command = `xdg-open "${uri}"`;
            break;
    }

    return new Promise<void>((resolve, reject) => {
        let spawned = false;

        const child = exec(command, (error, stdout, stderr) => {
            if (!spawned) return reject(new Error("Process failed to spawn"));
            if (error) return reject(error);
            resolve();
        });

        child.on("spawn", () => {
            spawned = true;
        });

    });
}

export async function fetchRobloxCsrf(_: IpcMainInvokeEvent, token: string): Promise<{ status: number; csrf: string | null }> {
    try {
        const res = await fetch("https://apis.roblox.com/sharelinks/v1/resolve-link", {
            method: "POST",
            headers: { "Cookie": `.ROBLOSECURITY=${token}` },
        });

        const csrf = res.headers.get("x-csrf-token");
        return { status: res.status, csrf };
    } catch (e) {
        return { status: -1, csrf: null };
    }
}


export async function resolveRobloxShareLink(_: IpcMainInvokeEvent, token: string, csrf: string, shareCode: string): Promise<{ status: number; data: any | null }> {
    try {
        const res = await fetch("https://apis.roblox.com/sharelinks/v1/resolve-link", {
            method: "POST",
            headers: {
                "Cookie": `.ROBLOSECURITY=${token}`,
                "X-CSRF-TOKEN": csrf,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ linkId: shareCode, linkType: "Server" }),
        });

        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: -1, data: null };
    }
}
