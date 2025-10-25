/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";

import { settings } from "./settings";
export const cl = classNameFactory("vc-joiner-");

export type LogLevel = "trace" | "debug" | "perf" | "info" | "warn" | "error";

const COLORS: Record<LogLevel, string> = {
    trace: "color: #6b7280",
    debug: "color: #9ca3af",
    perf: "color: #ff00ff",
    info: "color: #3b82f6",
    warn: "color: #facc15",
    error: "color: #ef4444",
};

const LEVEL_ORDER: LogLevel[] = ["trace", "debug", "perf", "info", "warn", "error"];

export function createLogger(name: string) {
    // Função interna que lê o nível dinamicamente
    function getCurrentLevel(): LogLevel {
        return (settings.store._dev_logging_level as LogLevel) ?? "trace";
    }

    function log(msgLevel: LogLevel, ...args: any[]) {
        const currentLevel = getCurrentLevel();
        if (LEVEL_ORDER.indexOf(msgLevel) < LEVEL_ORDER.indexOf(currentLevel)) return;
        const color = COLORS[msgLevel];
        console.log(`%c[${msgLevel.toUpperCase()}] [${name}]`, color, ...args);
    }

    return {
        inherit(subName: string) {
            return createLogger(`${name}.${subName}`);
        },
        trace: (...args: any[]) => log("trace", ...args),
        debug: (...args: any[]) => log("debug", ...args),
        perf: (...args: any[]) => log("perf", ...args),
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
