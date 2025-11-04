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
    /*
    * Main Settings
    */
    joinEnabled: {
        type: OptionType.BOOLEAN,
        description: "Automatically join valid Roblox share links detected.",
        default: false
    },
    notifyEnabled: {
        type: OptionType.BOOLEAN,
        description: "Send a desktop notification when a valid Roblox share link is detected.",
        default: false
    },
    joinCloseGameBefore: {
        type: OptionType.BOOLEAN,
        description: "Close the game before joining. Makes your joins slightly slower.",
        default: true
    },

    /*
    * After-Join behavior
    */
    joinDisableAfterAutoJoin: {
        type: OptionType.BOOLEAN,
        description: "Disable automatic joins after a sucessful one join.",
        default: true
    },
    notifyDisableAfterAutoJoin: {
        type: OptionType.BOOLEAN,
        description: "Disable notifications after a sucessful automatic join.",
        default: false
    },

    /*
    * UI and shortcut
    */
    uiShowChatBarIcon: {
        type: OptionType.BOOLEAN,
        description: "Shows an icon in the chat bar for quick access to the plugin's settings.",
        default: true
    },
    uiShortcutAction: {
        type: OptionType.SELECT,
        description: "Action performed when right-clicking the chat bar icon.",
        default: "toggleAutoJoin",
        options: [
            { label: "No action", value: "none" },
            { label: "Toggle AutoJoin", value: "toggleJoin" },
            { label: "Toggle AutoJoin and Notifications", value: "toggleJoinAndNotifications" },
        ]
    },
    uiShowKeywords: {
        type: OptionType.BOOLEAN,
        description: "Show keywords for triggers in the chat bar menu.",
        default: true
    },

    /*
    * Monitoring
    */
    monitorChannelList: {
        type: OptionType.STRING,
        description: "Comma-separated channel IDs to monitor for valid server links.",
        default: ""
    },
    monitorNavigateToChannelsOnStartup: {
        type: OptionType.BOOLEAN,
        description: "Whenever you start Vencord, it will quickly navigate to each monitored channel to ensure they are loaded.",
        default: false
    },
    monitorBlockedUserList: {
        type: OptionType.STRING,
        description: "Comma-separated user IDs to ignore messages from when monitoring channels. This will only work if you're verifying server links.",
        default: ""
    },
    monitorBlockUnsafeServerMessageAuthors: {
        type: OptionType.BOOLEAN,
        description: "Automatically put users who post unsafe server links into the monitorBlockedUserList.",
        default: false
    },

    /*
    * Link verification
    */

    verifyRoblosecurityToken: {
        type: OptionType.STRING,
        description: ".ROBLOSECURITY token used for verifying place IDs when joining. It is required for any place ID verification to work. If it's not set, no verification will be done no matter what settings you have. This is totally optional if you don't want to use place ID verification. (Recommendation: create a fresh throwaway account for this purpose)",
        default: ""
    },
    verifyMode: {
        type: OptionType.SELECT,
        description: "When to verify Roblox place IDs.",
        default: "none",
        options: [
            { label: "No verification", value: "none" },
            { label: "Verify before joining (may slow your join time)", value: "before" },
            { label: "Verify after joining (riskier but won't slow your join time)", value: "after" },
        ]
    },
    verifyAllowedPlaceIds: {
        type: OptionType.STRING,
        description: "Comma-separated list of allowed place IDs. If empty, all place IDs are allowed.",
        default: ""
    },
    verifyBlockedPlaceIds: {
        type: OptionType.STRING,
        description: "Comma-separated list of blocked place IDs. If empty, no place IDs are blocked.",
        default: ""
    },
    verifyAfterJoinFailFallbackDelayMs: {
        type: OptionType.NUMBER,
        description: "If verification after joining fails, wait this many milliseconds before executing the safety action.",
        default: 5000
    },
    verifyAfterJoinFailFallbackAction: {
        type: OptionType.SELECT,
        description: "Action to execute when verification after joining fails.",
        default: "joinSols",
        options: [
            { label: "Join Sol's RNG public server", value: "joinSols" },
            { label: "Quit game", value: "quit" },
        ]
    },

    /*
    * Biome detection
    */
    // biome stuff
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
    MARI: { type: OptionType.BOOLEAN, description: "", default: false },
    JESTER: { type: OptionType.BOOLEAN, description: "", default: false },

    /*
    * Developer options
    */
   _dev_logging_level: {
       type: OptionType.SELECT,
       description: "Console logging level",
       default: "info",
       options: [
           { label: "Trace", value: "trace" },
           { label: "Debug", value: "debug" },
           { label: "Performance", value: "perf" },
           { label: "Info", value: "info" },
           { label: "Warn", value: "warn" },
           { label: "Error", value: "error" },
       ]
   },
    _dev_dedupe_link_cooldown_ms: {
        type: OptionType.NUMBER,
        description: "Cooldown in milliseconds to ignore duplicate links",
        default: 10000
    },
    _dev_verification_fail_fallback_delay_ms: {
        type: OptionType.NUMBER,
        description: "If verification after joining fails, wait this many milliseconds before executing the safety action.",
        default: 5000
    },
});

// Config geral do plugin
export interface PluginSettings {
    joinEnabled: boolean;
    notifyEnabled: boolean;
    joinCloseGameBefore: boolean;
    joinDisableAfterAutoJoin: boolean;
    notifyDisableAfterAutoJoin: boolean;
    uiShowChatBarIcon: boolean;
    uiShortcutAction: "none" | "toggleJoin" | "toggleJoinAndNotifications";
    monitorChannelList: string;
    monitorNavigateToChannelsOnStartup: boolean;
    monitorBlockedUserList: string;
    monitorBlockUnsafeServerMessageAuthors: boolean;
    verifyRoblosecurityToken: string;
    verifyMode: "none" | "before" | "after";
    verifyAllowedPlaceIds: string;
    verifyBlockedPlaceIds: string;
    verifyAfterJoinFailFallbackDelayMs: number;
    verifyAfterJoinFailFallbackAction: "joinSols" | "quit";
    _dev_logging_level: "trace" | "debug" | "perf" | "info" | "warn" | "error";
    _dev_dedupe_link_cooldown_ms: number;
}

// Config dos biomes
export interface TriggerKeywordSettings {
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
    MARI: boolean;
    JESTER: boolean;
}

// Junta plugin + biomes
export type JoinerSettings = PluginSettings & TriggerKeywordSettings;

// Palavras-chave por biome
export const TriggerKeywords: Record<keyof TriggerKeywordSettings, string[]> = {
    GLITCHED: ["glitch", "glitched", "glich", "glith"], // broken keywords because people freak out and type wrong
    DREAMSPACE: ["dream", "dream space", "dreamspace"],
    BLOODRAIN: ["blood rain", "blood", "bloodrain"],
    PUMPKINMOON: ["pump", "pumpkin", "pmoon"],
    GRAVEYARD: ["grave", "graveyard", "grave yard"],
    NULL: ["null"],
    CORRUPTION: ["corruption", "corrupt"],
    HELL: ["hell"],
    STARFALL: ["starfall", "star fall"],
    SANDSTORM: ["sand", "sand storm", "sandstorm"],
    SNOWY: ["snowy"],
    WINDY: ["windy"],
    RAINY: ["rainy"],
    MARI: ["mari", "voidcoin", "void coin"],
    JESTER: ["jester", "oblivion"],
};
