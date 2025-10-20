/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Settings } from "@api/Settings";
import definePlugin from "@utils/types";
import { ChannelRouter, ChannelStore, FluxDispatcher, GuildStore, Menu, NavigationRouter, SelectedChannelStore } from "@webpack/common";

import { JoinerChatBarIcon } from "./JoinerIcon";
import { BiomesConfig, BiomesKeywords, FullJoinerConfig, settings } from "./settings";

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

    /**
     * Tenta forçar a subscrição nos canais monitorados, sem abrir o histórico.
     */

    async forceLoadMonitoredChannels(monitored: Set<string>) {
        if (!monitored.size) return;

        console.log("[SolsAutoJoiner] Forcing load of monitored channels...");

        // Salva o canal atual pra voltar no final
        const currentChannel = SelectedChannelStore.getChannelId();

        for (const channelId of monitored) {
            try {
                console.log(`[SolsAutoJoiner] Loading channel: ${channelId}`);
                ChannelRouter.transitionToChannel(channelId);

                // Aguarda um pequeno delay pra dar tempo de carregar o canal
                await new Promise(res => setTimeout(res, 100));
            } catch (err) {
                console.error(`[SolsAutoJoiner] Failed to load channel ${channelId}:`, err);
            }
        }

        NavigationRouter.transitionToGuild("@me");

        console.log("[SolsAutoJoiner] Finished preloading monitored channels.");
    },

    start() {
        const config = Settings.plugins.SolsAutoJoiner as unknown as FullJoinerConfig;
        this.monitoredSet = new Set(config.MonitoredChannels.split(",").map(id => id.trim()).filter(Boolean));
        this.linkTimestamps = new Map();
        this.boundHandler = this.handleNewMessage.bind(this);
        FluxDispatcher.subscribe("MESSAGE_CREATE", this.boundHandler);

        console.log("[SolsAutoJoiner] Monitoring channels:", Array.from(this.monitoredSet));

        // ✅ Force-load channels on startup
        if (settings.store.forceNavigateToMonitoredChannelsOnStartup && this.monitoredSet.size > 0) {
            this.forceLoadMonitoredChannels(this.monitoredSet)
                .then(() => console.log("[SolsAutoJoiner] Finished subscribing to monitored channels."))
                .catch(err => console.error("[SolsAutoJoiner] Error force-loading monitored channels:", err));
        }
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
        const startAll = performance.now();

        const { channelId, message } = data;
        const config = Settings.plugins.SolsAutoJoiner as unknown as FullJoinerConfig;
        if (!this.monitoredSet?.has(channelId)) return;

        const content: string = (message.content ?? "").toLowerCase();
        const username = message.author?.username ?? "Unknown User";
        const userId = message.author?.id ?? "Unknown ID";

        const extractLinks = (text: string) => {
            const regex = /https?:\/\/(?:www\.)?roblox\.com\/share\?code=([a-f0-9]+)/gi;
            const links: { link: string; code: string; }[] = [];
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) links.push({ link: match[0], code: match[1] });
            return links;
        };

        const isOnCooldown = (link: string, code: string) => {
            const now = Date.now();
            const cooldownSeconds = parseInt(config._dev_dedupe_link_cooldown) || 30;
            const lastTime = this.linkTimestamps?.get(link) ?? 0;
            if (now - lastTime < cooldownSeconds * 1000) {
                console.log(`[SolsAutoJoiner] ⏳ ${code} | Dedupe cooldown (${now - lastTime}ms)`);
                return true;
            }
            return false;
        };

        const markLinkProcessed = (link: string) => {
            const now = Date.now();
            const cooldownSeconds = parseInt(config._dev_dedupe_link_cooldown) || 30;
            this.linkTimestamps?.set(link, now);
            setTimeout(() => this.linkTimestamps?.delete(link), cooldownSeconds * 1000);
        };

        const matchBiomes = (text: string) => {
            return Object.entries(BiomesKeywords)
                .filter(([biome]) => config[biome as keyof BiomesConfig])
                .filter(([_, keywords]) =>
                    keywords.some(kw => {
                        // eslint-disable-next-line @stylistic/quotes
                        const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, "i");
                        return pattern.test(text);
                    })
                )
                .map(([biome]) => biome);
        };

        const isIgnoredUser = (id: string) => {
            if (config.IgnoredUsers.split(",").map(x => x.trim()).includes(id)) {
                console.log(`[SolsAutoJoiner] 🚫 ${id} | Ignored user`);
                return true;
            }
            return false;
        };

        const sendNotification = (link: string, code: string, biome: string, shouldNotify: boolean) => {
            if (!shouldNotify) return;
            const startNotify = performance.now();
            const channel = ChannelStore.getChannel(channelId);
            const channelName = channel?.name ? `#${channel.name}` : `#${channelId}`;
            const guild = GuildStore.getGuild(message.guild_id);
            const guildName = guild?.name ?? `Server ${message.guild_id}`;
            console.log(`[SolsAutoJoiner] 🔔 ${code} | Sending notification for biome ${biome}`);

            const title = `ℹ️ Link found! - ${biome}`;
            const body = [
                `Server: ${code}`,
                `In channel: ${channelName} (${guildName})`,
                `Sent by: ${username} (${userId})`
            ].join("\n");

            try {
                const notif = new Notification(title, { body });
                notif.onclick = () => {
                    try {
                        const Native = VencordNative.pluginHelpers.SolsAutoJoiner as unknown as { openRoblox: (uri: string) => void; };
                        Native.openRoblox(`roblox://navigation/share_links?code=${code}&type=Server`);
                    } catch (err) {
                        console.error(`[SolsAutoJoiner] ⚠️ ${code} | Failed to open Roblox from notif:`, err);
                    }
                };
            } catch (err) {
                console.error(`[SolsAutoJoiner] ⚠️ ${code} | Failed to send notif`, err);
            }

            const notifyTime = performance.now() - startNotify;
            console.log(`[SolsAutoJoiner] ⏱️ ${code} | sendNotification took ${notifyTime.toFixed(2)}ms`);
        };

        const autoJoin = async (link: string, code: string, biome: string) => {
            const startJoin = performance.now();
            if (!config.AutoJoin) return;
            try {
                console.log(`[SolsAutoJoiner] 🚀 ${code} | Autojoining ${biome}`);
                const Native = VencordNative.pluginHelpers.SolsAutoJoiner as unknown as { openRoblox: (uri: string) => void; };
                await Native.openRoblox(`roblox://navigation/share_links?code=${code}&type=Server`);

                if (config.disableAutoJoinAfterSuccess) {
                    settings.store.AutoJoin = false;
                    console.log(`[SolsAutoJoiner] ℹ️ ${code} | AutoJoin disabled`);
                }
                if (config.disableNotificationsAfterSuccess) {
                    settings.store.Notifications = false;
                    console.log(`[SolsAutoJoiner] ℹ️ ${code} | Notifications disabled`);
                }
            } catch (err) {
                console.error(`[SolsAutoJoiner] ⚠️ ${code} | Autojoin failed:`, err);
            }
            const joinTime = performance.now() - startJoin;
            console.log(`[SolsAutoJoiner] ⏱️ ${code} | autoJoin took ${joinTime.toFixed(2)}ms`);
        };

        // Loop principal com métricas
        const loopStart = performance.now();
        const links = extractLinks(content);
        console.log(`[SolsAutoJoiner] 🧩 Found ${links.length} link(s)`);

        for (const { link, code } of links) {
            const startLoop = performance.now();

            if (isOnCooldown(link, code)) continue;
            markLinkProcessed(link);

            const biomeStart = performance.now();
            const matchedBiomes = matchBiomes(content);
            const biomeTime = performance.now() - biomeStart;

            if (matchedBiomes.length === 0) {
                console.log(`[SolsAutoJoiner] ❌ ${code} | No biomes (${biomeTime.toFixed(2)}ms)`);
                continue;
            }
            if (matchedBiomes.length > 1) {
                console.log(`[SolsAutoJoiner] ⚠️ ${code} | Multiple biomes: ${matchedBiomes.join(", ")} (${biomeTime.toFixed(2)}ms)`);
                continue;
            }
            if (isIgnoredUser(userId)) continue;

            const biome = matchedBiomes[0];
            console.log(`[SolsAutoJoiner] ✅ ${code} | Biome ${biome} (${biomeTime.toFixed(2)}ms)`);

            const shouldNotify = config.Notifications;
            await autoJoin(link, code, biome);
            sendNotification(link, code, biome, shouldNotify);

            const loopTime = performance.now() - startLoop;
            console.log(`[SolsAutoJoiner] ⏲️ ${code} | total loop time ${loopTime.toFixed(2)}ms`);
        }

        const totalTime = performance.now() - startAll;
        console.log(`[SolsAutoJoiner] 🕒 Message processed in ${totalTime.toFixed(2)}ms`);
    }
});
