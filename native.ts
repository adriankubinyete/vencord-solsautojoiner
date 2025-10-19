/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec } from "child_process";
import { IpcMainInvokeEvent } from "electron";

export async function openRoblox(_: IpcMainInvokeEvent, uri: string) {

    if (process.platform === "win32") {
        // Tenta abrir direto

        // a uri é tipo: roblox://navigation/share_links?placeId=12345&linkCode=abcdef

        try {
            exec(`start "" "${uri}"`);
        } catch {
            // fallback
            exec(`cmd /c start "" "${uri}"`);
        }
    } else if (process.platform === "darwin") {
        exec(`open "${uri}"`);
    } else {
        exec(`xdg-open "${uri}"`);
    }
}
