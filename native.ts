/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec as execCb } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { promisify } from "util";

const exec = promisify(execCb);

export type ProcessInfo = {
  pid: number;
  name: string;
  path: string;
};

export async function getProcess(
  _: IpcMainInvokeEvent,
  processName: string
): Promise<ProcessInfo[]> {
  if (process.platform !== "win32") {
    throw new Error(
      `Unsupported platform: getProcess only works on Windows, current platform is "${process.platform}"`
    );
  }

  if (!processName || typeof processName !== "string") {
    throw new Error("Invalid argument: processName must be a non-empty string");
  }

  try {
    const psCommand = `powershell -NoProfile -Command "Get-Process -Name ${processName} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress"`;

    const { stdout } = await exec(psCommand);
    const trimmed = (stdout || "").trim();

    if (!trimmed) {
      // Nenhum processo encontrado
      return [];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Failed to parse PowerShell output as JSON. Raw output: "${trimmed}"`
      );
    }

    const arr = Array.isArray(parsed) ? parsed : [parsed];

    const result = arr
      .filter((entry: any) => entry && entry.Id)
      .map((entry: any) => ({
        pid: Number(entry.Id),
        name: entry.ProcessName ?? processName,
        path: entry.Path ?? "",
      }));

    if (result.length === 0) {
      // Nenhum processo válido encontrado
      return [];
    }

    return result;
  } catch (err: any) {
    // Se algum erro do exec ou PowerShell ocorrer
    throw new Error(
      `Failed to get process "${processName}": ${err?.message ?? err}`
    );
  }
}


export async function killProcess(_: IpcMainInvokeEvent, pid: number): Promise<void> {
  if (process.platform !== "win32") return;
  try {
    await exec(`taskkill /PID ${pid} /F`);
  } catch {
    // ignore errors
  }
}

// export async function isRobloxOpen(_: IpcMainInvokeEvent): Promise<boolean> {
//   if (process.platform !== "win32") {
//     throw new Error("Unsupported platform: only Windows is supported");
//   }

//   const proc = await getRobloxProcess();
//   return proc !== null;
// }

// export async function closeRoblox(_: IpcMainInvokeEvent,): Promise<void> {
//   if (process.platform !== "win32") {
//     throw new Error("Unsupported platform: only Windows is supported");
//   }

//   try {
//     // graceful stop
//     const ps = "powershell -NoProfile -Command \"Stop-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 200; if (Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue) { Stop-Process -Name RobloxPlayerBeta -Force -ErrorAction SilentlyContinue }\"";
//     await exec(ps);
//   } catch {
//     try {
//       await exec("taskkill /IM RobloxPlayerBeta.exe /F");
//     } catch {
//       // swallow silently
//     }
//   }
// }

export async function openUri(
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

export async function fetchRobloxCsrf(_: IpcMainInvokeEvent, token: string): Promise<{ status: number; csrf: string | null; }> {
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


export async function resolveRobloxShareLink(_: IpcMainInvokeEvent, token: string, csrf: string, shareCode: string): Promise<{ status: number; data: any | null; }> {
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
