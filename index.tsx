/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Settings } from "@api/Settings";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildStore, Menu } from "@webpack/common";

import { JoinerChatBarIcon } from "./JoinerIcon";
import { BiomesConfig, BiomesKeywords,FullJoinerConfig, settings } from "./settings";

// Patch pro ContextMenu
const ChatBarContextCheckbox: NavContextMenuPatchCallback = children => {
    const { AutoJoin: isEnabled, contextMenu } = settings.use(["AutoJoin", "contextMenu"]);
    if (!contextMenu) return;

    const group = findGroupChildrenByChildId("submit-button", children);
    if (!group) return;

    const idx = group.findIndex(c => c?.props?.id === "submit-button");
    group.splice(idx + 1, 0,
        <Menu.MenuCheckboxItem
            id="vc-autojoin-toggle"
            label="Enable AutoJoin"
            checked={isEnabled}
            action={() => settings.store.AutoJoin = !settings.store.AutoJoin}
        />
    );
};

export default definePlugin({
    name: "SolsAutoJoiner",
    description: "Monitor specific channels for Roblox share links + selected biomes",
    authors: [{ name: "masutty", id: 188851299255713792n }],
    settings,

    contextMenus: {
        "textarea-context": ChatBarContextCheckbox,
    },

    renderChatBarButton: JoinerChatBarIcon,

    boundHandler: null as ((data: any) => void) | null,
    monitoredSet: null as Set<string> | null,
    linkTimestamps: null as Map<string, number> | null,

    start() {
        const config = Settings.plugins.SolsAutoJoiner as unknown as FullJoinerConfig;
        this.monitoredSet = new Set(config.MonitoredChannels.split(",").map(id => id.trim()).filter(Boolean));
        this.linkTimestamps = new Map();
        this.boundHandler = this.handleNewMessage.bind(this);
        FluxDispatcher.subscribe("MESSAGE_CREATE", this.boundHandler);

        console.log("[SolsAutoJoiner] Monitoring channels:", Array.from(this.monitoredSet));
    },

    stop() {
        if (this.boundHandler) FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.boundHandler);
        this.boundHandler = null;
        this.monitoredSet = null;
        this.linkTimestamps?.clear();
        this.linkTimestamps = null;
        console.log("[SolsAutoJoiner] Stopped monitoring.");
    },

    async handleNewMessage(data: { channelId: string; message: any; }) {
        const { channelId, message } = data;
        const config = Settings.plugins.SolsAutoJoiner as unknown as FullJoinerConfig;
        if (!this.monitoredSet?.has(channelId)) return;

        const content: string = (message.content ?? "").toLowerCase();
        // console.log(`[SolsAutoJoiner] Processing message: "${content}"`);

        const regex = /https?:\/\/(?:www\.)?roblox\.com\/share\?code=([a-f0-9]+)/gi;
        let match: RegExpExecArray | null;
        let foundAny = false;

        while ((match = regex.exec(content)) !== null) {
            foundAny = true;
            const link = match[0];
            const code = match[1];
            console.log(`[SolsAutoJoiner] Found Roblox link: ${link} (code: ${code})`);

            const now = Date.now();
            const cooldownSeconds = parseInt(config._dev_dedupe_link_cooldown) || 30;
            const lastTime = this.linkTimestamps?.get(link) ?? 0;

            if (now - lastTime < cooldownSeconds * 1000) {
                console.log(`[SolsAutoJoiner] Link deduplication (${now - lastTime}ms), ignoring: ${link}`);
                continue;
            }

            // Checa biomes ativos
            const matchedBiomes = Object.entries(BiomesKeywords)
                .filter(([biome]) => config[biome as keyof BiomesConfig])
                .filter(([_, keywords]) => keywords.some(kw => content.includes(kw)))
                .map(([biome]) => biome);

            if (matchedBiomes.length === 0) continue; // found sharelink but no biome keyword matched

            console.log(`[SolsAutoJoiner] Link matches active biomes: ${matchedBiomes.join(", ")}`);

            // Marca link como processado
            this.linkTimestamps?.set(link, now);
            setTimeout(() => {
                this.linkTimestamps?.delete(link);
                console.log(`[SolsAutoJoiner] Link cooldown expired, removed: ${link}`);
            }, cooldownSeconds * 1000);

            const channel = ChannelStore.getChannel(channelId);
            const guildId = channel?.guild_id;
            const msgLink = guildId ? `https://discord.com/channels/${guildId}/${channelId}/${message.id}` : "unknown";

            console.log(`[SolsAutoJoiner] 🔔 New Roblox share detected! Link: ${msgLink} | Share: ${link} | Biomes: ${matchedBiomes.join(", ")}`);

            const username = message.author?.username ?? "Unknown User";
            const userId = message.author?.id ?? "Unknown ID";

            if (config.IgnoredUsers.split(",").map(id => id.trim()).includes(userId)) continue; // valid link but user is in ignore list
            if (matchedBiomes.length > 1) continue; // only one biome per message. if multiple keywords match, skip

            // Desktop Notification
            if (config.Notifications) {
                const channel = ChannelStore.getChannel(channelId);
                const channelName = channel?.name ? `#${channel.name}` : `#${channelId}`;

                const guildId = message.guild_id;
                const guild = GuildStore.getGuild(guildId);
                const guildName = guild?.name ?? `Server ${guildId}`;

                const biomeDetected = matchedBiomes.length > 1 ? "Multiple" : matchedBiomes[0];

                const title = `ℹ️ Link found! - ${biomeDetected}`;
                const body = [
                    `In channel: ${channelName} (${guildName})`,
                    `Sent by: ${username} (${userId})`
                ].join("\n");

                try {
                    const notif = new Notification(title, { body });
                    console.log(`[SolsAutoJoiner] Desktop notification sent for link: ${link}`);

                    // captura code e link no closure
                    const codeCopy = code;
                    const linkCopy = link;

                    notif.onclick = () => {
                        console.log(`[SolsAutoJoiner] Notification clicked, opening Roblox link: ${linkCopy}`);

                        // Desativa AutoJoin após join manual via notificação (se configurado)
                        if (config.disableAutoJoinAfterSuccess) {
                            settings.store.AutoJoin = false;
                        }

                        try {
                            const Native = VencordNative.pluginHelpers.SolsAutoJoiner as unknown as { openRoblox: (uri: string) => void; };
                            Native.openRoblox(`roblox://navigation/share_links?code=${codeCopy}&type=Server`);
                        } catch (err) {
                            console.error("[SolsAutoJoiner] Failed to open Roblox from notification:", err);
                        }
                    };
                } catch (err) {
                    console.error("[SolsAutoJoiner] Failed to send desktop notification:", err);
                }
            }

            // Autojoiner
            if (config.AutoJoin) {
                try {
                    const Native = VencordNative.pluginHelpers.SolsAutoJoiner as unknown as { openRoblox: (uri: string) => void; };
                    console.log(`[SolsAutoJoiner] Autojoining Roblox server with code: ${code}`);
                    await Native.openRoblox(`roblox://navigation/share_links?code=${code}&type=Server`);

                    // Desativa AutoJoin após join automático (se configurado)
                    if (config.disableAutoJoinAfterSuccess) {
                        settings.store.AutoJoin = false;
                        console.log("[SolsAutoJoiner] AutoJoin disabled after successful join.");
                    }
                } catch (err) {
                    console.error("[SolsAutoJoiner] Failed to autojoin Roblox:", err);
                }
            }
        }

        if (!foundAny) console.log("[SolsAutoJoiner] No Roblox links found in message.");
    }

});
