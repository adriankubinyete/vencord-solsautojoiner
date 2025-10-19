/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// settings.tsx
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    Notifications: {
        type: OptionType.BOOLEAN,
        description: "Send a desktop notification when a valid Roblox share link is detected.",
        default: false
    },
    AutoJoin: {
        type: OptionType.BOOLEAN,
        description: "Automatically join valid Roblox share links detected.",
        default: false
    },
    disableAutoJoinAfterSuccess: {
        type: OptionType.BOOLEAN,
        description: "Disable AutoJoin after successful joins. Only applies to automatic joins, not manual clicks on notifications. This is recommended to avoid joining a new link while you're already in game, you can re-enable it manually via the chat menu icon or context menu.",
        default: true
    },
    disableNotificationsAfterSuccess: {
        type: OptionType.BOOLEAN,
        description: "Disable Notifications after a successful join. Only applies to automatic joins, not manual clicks on notifications.",
        default: false
    },
    shiftClickAlsoToggleNotifications: {
        type: OptionType.BOOLEAN,
        description: "When shift-clicking the chat bar icon, also toggle notifications along with AutoJoin.",
        default: false
    },
    showIcon: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Shows an icon for toggling AutoJoin in discord's chat bar",
        restartNeeded: true,
    },
    contextMenu: {
        type: OptionType.BOOLEAN,
        description: "Add option to toggle AutoJoin in discord's chat bar context menu",
        default: true,
    },
    showAutoJoinTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show tooltip when Auto Join is enabled",
        default: true
    },
    showAutoJoinAlert: {
        type: OptionType.BOOLEAN,
        description: "Show alert when enabling Auto Join",
        default: true
    },
    MonitoredChannels: {
        type: OptionType.STRING,
        description: "Comma-separated channel IDs to monitor",
        default: "",
        restartNeeded: true
    },
    IgnoredUsers: {
        type: OptionType.STRING,
        description: "Comma-separated user IDs to ignore",
        default: "",
        restartNeeded: true
    },
    GLITCHED: { type: OptionType.BOOLEAN, description: "", default: false },
    DREAMSPACE: { type: OptionType.BOOLEAN, description: "", default: false },
    BLOODRAIN: { type: OptionType.BOOLEAN, description: "", default: false },
    PUMPKINMOON: { type: OptionType.BOOLEAN, description: "", default: false },
    GRAVEYARD: { type: OptionType.BOOLEAN, description: "", default: false },
    NULL: { type: OptionType.BOOLEAN, description: "", default: false },
    CORRUPTION: { type: OptionType.BOOLEAN, description: "", default: false },
    HELL: { type: OptionType.BOOLEAN, description: "", default: false },
    STARFALL: { type: OptionType.BOOLEAN, description: "", default: false },
    SANDSTORM: { type: OptionType.BOOLEAN, description: "", default: false },
    SNOWY: { type: OptionType.BOOLEAN, description: "", default: false },
    WINDY: { type: OptionType.BOOLEAN, description: "", default: false },
    RAINY: { type: OptionType.BOOLEAN, description: "", default: false },
    _dev_dedupe_link_cooldown: {
        type: OptionType.STRING,
        description: "(developer option) Cooldown in seconds to ignore duplicate links",
        default: "30"
    }
});

// Config geral do plugin
export interface JoinerConfig {
    AutoJoin: boolean;
    Notifications: boolean;
    MonitoredChannels: string;
    IgnoredUsers: string;
    disableAutoJoinAfterSuccess: boolean;
    disableNotificationsAfterSuccess: boolean;
    shiftClickAlsoToggleNotifications: boolean;
    _dev_dedupe_link_cooldown: string; // string que será interpretada como número
}

// Config dos biomes
export interface BiomesConfig {
    GLITCHED: boolean;
    DREAMSPACE: boolean;
    BLOODRAIN: boolean;
    PUMPKINMOON: boolean;
    GRAVEYARD: boolean;
    NULL: boolean;
    CORRUPTION: boolean;
    HELL: boolean;
    STARFALL: boolean;
    SANDSTORM: boolean;
    SNOWY: boolean;
    WINDY: boolean;
    RAINY: boolean;
}

// Junta plugin + biomes
export type FullJoinerConfig = JoinerConfig & BiomesConfig;

// Palavras-chave por biome
export const BiomesKeywords: Record<keyof BiomesConfig, string[]> = {
    GLITCHED: ["glitch", "glitched"],
    DREAMSPACE: ["dream", "dream space", "dreamspace"],
    BLOODRAIN: ["blood rain", "blood"],
    PUMPKINMOON: ["pump", "pumpkin", "pumpkin moon"],
    GRAVEYARD: ["grave", "graveyard", "grave yard"],
    NULL: ["null"],
    CORRUPTION: ["corruption"],
    HELL: ["hell"],
    STARFALL: ["starfall", "star fall"],
    SANDSTORM: ["sand", "sand storm", "sandstorm"],
    SNOWY: ["snowy"],
    WINDY: ["windy"],
    RAINY: ["rainy"]
};
