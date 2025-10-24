/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec as execCb } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { promisify } from "util";

const exec = promisify(execCb);

export type RobloxProcessInfo = {
  pid: number;
  name: string;
  path: string;
};

export async function getRobloxProcess(): Promise<RobloxProcessInfo | null> {
  if (process.platform !== "win32") {
    throw new Error("Unsupported platform: only Windows is supported");
  }

  try {
    const ps = "powershell -NoProfile -Command \"Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress\"";
    const { stdout } = await exec(ps);
    const s = (stdout || "").trim();
    if (!s) return null;

    const parsed = JSON.parse(s);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!entry || !entry.Id) return null;

    return {
      pid: Number(entry.Id),
      name: entry.ProcessName ?? "RobloxPlayerBeta",
      path: entry.Path ?? "",
    };
  } catch {
    return null;
  }
}

export async function isRobloxOpen(_: IpcMainInvokeEvent): Promise<boolean> {
  if (process.platform !== "win32") {
    throw new Error("Unsupported platform: only Windows is supported");
  }

  const proc = await getRobloxProcess();
  return proc !== null;
}

export async function closeRoblox(_: IpcMainInvokeEvent,): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Unsupported platform: only Windows is supported");
  }

  try {
    // graceful stop
    const ps = "powershell -NoProfile -Command \"Stop-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 200; if (Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue) { Stop-Process -Name RobloxPlayerBeta -Force -ErrorAction SilentlyContinue }\"";
    await exec(ps);
  } catch {
    try {
      await exec("taskkill /IM RobloxPlayerBeta.exe /F");
    } catch {
      // swallow silently
    }
  }
}

export async function openRoblox(
  _: IpcMainInvokeEvent,
  uri: string
): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Unsupported platform: only Windows is supported");
  }

  const command = `start "" "${uri}"`;

  try {
    await exec(command);
  } catch (error) {
    throw new Error(`Failed to start Roblox: ${(error as Error).message}`);
  }
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
