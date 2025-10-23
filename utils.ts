/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";

import { settings } from "./settings";
export const cl = classNameFactory("vc-joiner-");

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const COLORS = {
    trace: "color: #6b7280",
    debug: "color: #9ca3af",
    info: "color: #3b82f6",
    warn: "color: #facc15",
    error: "color: #ef4444",
};

export function createLogger(name: string, debugEnabled: boolean) {
    function log(level: LogLevel, ...args: any[]) {
        if (level === "debug" && !debugEnabled) return;
        const color = COLORS[level];
        const tag = `[${name}] [${level.toUpperCase()}]`;
        console.log(`%c${tag}`, color, ...args);
    }

    return {
        trace: (...args: any[]) => log("trace", ...args),
        debug: (...args: any[]) => log("debug", ...args),
        info: (...args: any[]) => log("info", ...args),
        warn: (...args: any[]) => log("warn", ...args),
        error: (...args: any[]) => log("error", ...args),
    };
}

export interface SettingMeta {
    key: string;
    type?: any;
    description?: string;
    default?: any;
    options?: Array<{ label: string; value: any; }>;
}

export function getSettingMeta<K extends keyof typeof settings.def>(key: K): SettingMeta {
    const def = settings.def[key] as any;

    if (!def) {
        throw new Error(`Setting "${String(key)}" not found in settings.def`);
    }

    return {
        key: String(key),
        type: def.type,
        description: def.description,
        default: def.default,
        options: def.options ?? undefined,
    };
}
