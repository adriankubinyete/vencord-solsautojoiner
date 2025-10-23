/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec } from "child_process";
import { IpcMainInvokeEvent } from "electron";

const csrfCache = new Map<string, string>(); // ROBLOSECURITY token -> CSRF token
const shareCache = new Map<string, any>(); // shareCode -> resolved code object

export async function openRoblox(_: IpcMainInvokeEvent, uri: string) {
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
        const process = exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });

        // process.on("spawn", () => log.trace("⚙️ Process spawned"));
        // process.on("exit", code => log.trace(`💨 Process exited with code: ${code}`));
    });
}

// export async function resolveShareLink(_: IpcMainInvokeEvent, token: string, shareCode: string): Promise<any | null> {
//     if (shareCache.has(shareCode)) {
//         return shareCache.get(shareCode)!;
//     }

//     async function fetchCsrf(): Promise<string | null> {
//         const resp = await fetch("https://apis.roblox.com/sharelinks/v1/resolve-link", {
//             method: "POST",
//             headers: { "Cookie": `.ROBLOSECURITY=${token}` },
//         });
//         const csrf = resp.headers.get("x-csrf-token");
//         if (csrf) csrfCache.set(token, csrf);
//         return csrf;
//     }

//     async function tryResolve(csrfToken: string): Promise<any | null> {
//         const response = await fetch("https://apis.roblox.com/sharelinks/v1/resolve-link", {
//             method: "POST",
//             headers: {
//                 "Cookie": `.ROBLOSECURITY=${token}`,
//                 "X-CSRF-TOKEN": csrfToken,
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({ linkId: shareCode, linkType: "Server" }),
//         });

//         if (response.status === 403) throw new Error("CSRF expired");
//         if (!response.ok) {
//             return null;
//         }

//         const data = await response.json() as any;

//         const serverData = data?.privateServerInviteData;
//         if (serverData?.status === "Valid") {
//             shareCache.set(shareCode, serverData);
//             return serverData;
//         }

//         return null;
//     }

//     // Use cached or new CSRF
//     let csrf = csrfCache.get(token) ?? await fetchCsrf();
//     if (!csrf) return null;

//     try {
//         return await tryResolve(csrf);
//     } catch (err) {
//         if (String(err).includes("CSRF")) {
//             csrfCache.delete(token);
//             csrf = await fetchCsrf();
//             if (!csrf) return null;
//             return await tryResolve(csrf);
//         }
//         return null;
//     }
// }

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
