/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { findLazy } from "@webpack";
import { NavigationRouter, Toasts } from "@webpack/common";

import { settings } from "../settings";
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
        return (settings.store.loggingLevel as LogLevel) ?? "trace";
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

export function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    if (diff < minute) return "Just now";

    const units = [
        { label: "year", ms: year },
        { label: "month", ms: month },
        { label: "day", ms: day },
        { label: "hour", ms: hour },
        { label: "minute", ms: minute },
    ];

    for (const { label, ms } of units) {
        if (diff >= ms) {
            const value = Math.floor(diff / ms);
            return `${value} ${label}${value !== 1 ? "s" : ""} ago`;
        }
    }

    return "Just now";
}


export function showToast(
    message: string,
    type: typeof Toasts.Type.MESSAGE = Toasts.Type.MESSAGE,
    duration: number = 1000,
    position: typeof Toasts.Position.BOTTOM | typeof Toasts.Position.TOP = Toasts.Position.BOTTOM
) {
    Toasts.show(
        Toasts.create(message, type.toLowerCase(), { duration, position })
    );
}

export function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
}

export function openInNewTab(url: string) {
    window.open(url, "_blank");
}

// export function sendNotification(title: string, body: string, icon?: string, onclick?: () => void): void {
//     // const notif = new Notification(title, { body, });
//     const notif = new window.Notification(title, { body, icon });
//     notif.onclick = () => {
//         if (onclick) {
//             onclick();
//         }
//         notif.close();
//     };
// }

export function sendNotification({
    title,
    content,
    icon,
    onClick,
}: {
    title: string;
    content: string;
    icon?: string;
    onClick?: () => void;
}) {
    const notif = new window.Notification(title, { body: content, icon });
    notif.onclick = () => {
        if (onClick) {
            onClick();
        }
        notif.close();
    };
}

export function jumpToMessage(messageId: string, channelId: string, guildId: string) {
    return NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${messageId}`);
}

export const ChannelTypes = findLazy(m => m.ANNOUNCEMENT_THREAD === 10);
