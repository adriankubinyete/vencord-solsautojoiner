/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelRouter, ChannelStore, GuildStore, Menu, NavigationRouter } from "@webpack/common";

import { settings, TriggerKeywords } from "./settings";
import { CustomChatBarButton } from "./ui/ChatBarButton";
import { ChannelTypes, createLogger,jumpToMessage, sendNotification } from "./utils/index";
import { recentJoinStore } from "./utils/RecentJoinStore";
import { IJoinData, RobloxLinkHandler } from "./utils/RobloxLinkHandler";

const PLUGIN_NAME = "SolsRadar";
const baselogger = createLogger(PLUGIN_NAME);

const patchChannelContextMenu: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel) return children;

    // csv list to set
    const monitoredChannels = new Set(
        settings.store.monitorChannelList
            .split(",")
            .map(id => id.trim())
            .filter(Boolean)
    );

    const isMonitored = isMonitoredChannel(channel.id);

    const group =
        findGroupChildrenByChildId("mark-channel-read", children) ?? children;

    group.push(
        <Menu.MenuItem
            id="vc-saj-monitor-toggle"
            label={isMonitored ? `${PLUGIN_NAME} stop monitoring` : `${PLUGIN_NAME} add to monitoring`}
            color={isMonitored ? "danger" : "brand"}
            action={() => {
                if (isMonitored) {
                    monitoredChannels.delete(channel.id);
                } else {
                    monitoredChannels.add(channel.id);
                }
                settings.store.monitorChannelList = Array.from(monitoredChannels).join(",");
            }}
        />
    );

    return children;
};

export default definePlugin({
    name: "SolsRadar",
    description: "Does Sol's RNG stuff",
    authors: [{ name: "masutty", id: 188851299255713792n }],
    settings,

    contextMenus: {
        "channel-context": patchChannelContextMenu,
    },

    renderChatBarButton: CustomChatBarButton,

    /**
     * Tenta forçar a subscrição nos canais monitorados, sem abrir o histórico.
     */

    async preloadMonitoredChannels(monitored: Set<string>): Promise<void> {
        const log = baselogger.inherit("preloadMonitoredChannels");
        if (!monitored.size) return;

        for (const channelId of monitored) {
            try {
                log.trace(`Loading channel ${channelId}`);
                ChannelRouter.transitionToChannel(channelId);

                // wait a bit to let the channel load
                await new Promise(res => setTimeout(res, 100));
            } catch (err) {
                log.error(`Failed to load channel ${channelId}:`, err);
            }
        }

        NavigationRouter.transitionToGuild("@me");
    },

    start(): void {
        const log = baselogger.inherit("start");

        log.trace("Loading recent joins");
        recentJoinStore.load();

        if (settings.store.monitorNavigateToChannelsOnStartup) {
            log.trace("Force-loading monitored channels");
            const monitoredChannels = new Set(settings.store.monitorChannelList.split(",").map(id => id.trim()).filter(Boolean));
            this.preloadMonitoredChannels(monitoredChannels)
                .then(() => log.info("Finished force-loading monitored channels"))
                .catch(err => log.error("Error force-loading monitored channels:", err));
        }
    },

    stop(): void {
        const log = baselogger.inherit("stop");

        log.info("Saving recent joins");
        recentJoinStore.save();
    },

    flux: {
        async WINDOW_UNLOAD() {
            const log = baselogger.inherit("WINDOW_UNLOAD");
            log.info("Saving recent joins");
            recentJoinStore.save();
        },

        async MESSAGE_CREATE({ message, optimistic }: { message: Message, optimistic: boolean; }) {
            const log = baselogger.inherit(`${message.id}`);
            if (optimistic) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            const channelName: string = channel.name;
            const channelId: string = channel.id;
            const authorId = message.author?.id ?? "Unknown ID";
            const authorUsername = message.author?.username ?? "Unknown Username";
            let guildName: string | undefined = "Unknown Guild";
            let guildId: string | undefined = "Unknown Guild ID";

            // not a valid channel (idc about these)
            switch (channel.type) {
                case ChannelTypes.DM:
                case ChannelTypes.GROUP_DM:
                    return;
            }

            if (channel.guild_id) {
                const guild = GuildStore.getGuild(channel.guild_id);
                guildName = guild.name;
                guildId = guild.id;
            }

            if (isUserBlocked(message.author.id)) return;
            // log.trace("settings.store._dev_greedy_monitoring : ", settings.store._dev_greedy_monitoring, "isMonitoredChannel(channelId) : ", isMonitoredChannel(channelId));
            if (!settings.store.monitorGreedyMode && !isMonitoredChannel(channelId)) return; // assures that channel is monitored or we are in greedy mode
            if (settings.store.monitorGreedyMode && isGreedyIgnoredChannel(channelId)) return;

            const ro = new RobloxLinkHandler(settings, log);
            const link = ro.extract(message.content); // get link from msg content
            if (!link || !link.ok) return;

            // if we got here, that means the message has a valid roblox link. now we must check trigger words before deciding what to do
            const matches = findKeywords(message.content);
            switch (matches.length) {
                case 0:
                    log.info("❌ No match found");
                    return;
                case 1:
                    log.info("✅ Match found: ", matches[0]);
                    break;
                default:
                    log.warn(`❌ Multiple keyword matches (${matches.join(", ")})`);
                    return;
            }
            const matchName = matches[0];
            if (!settings.store[matchName]) {
                log.info("❌ Match found but disabled: ", matchName);
                return;
            }
            const match = TriggerKeywords[matchName];

            const shouldNotify = settings.store.notifyEnabled;
            const shouldJoin = settings.store.joinEnabled;
            let joinData: IJoinData | null = null;

            if (shouldJoin) {
                log.debug("Executing join");
                joinData = await ro.safelyJoin(link);
                recentJoinStore.add({
                    title: `${match.name} sniped!`,
                    description: `Sent in ${channelName} (${guildName})`,
                    iconUrl: match.iconUrl,
                    authorName: authorUsername,
                    authorAvatarUrl: `https://cdn.discordapp.com/avatars/${authorId}/${message.author?.avatar}.png`,
                    messageJumpUrl: `https://discord.com/channels/${guildId}/${channelId}/${message.id}`,
                    joinStatus: joinData
                });

                // fake link, destroy the fucker
                if (joinData && joinData.verified && joinData.safe === false) {
                    if (settings.store.monitorBlockUnsafeServerMessageAuthors) settings.store.monitorBlockedUserList += `,${authorId}`;

                    log.warn("Bait link detected, safety action will commence soon");
                    setTimeout(async () => {
                        log.info("Executing safety action");
                        switch (settings.store.verifyAfterJoinFailFallbackAction) {
                            case "joinSols":
                                await ro.executeJoin({
                                    ok: true,
                                    code: "",
                                    link: "",
                                    type: "public",
                                    placeId: "15532962292"
                                });
                                break;
                            default:
                                ro.closeRoblox();
                                break;
                        }
                    }, settings.store.verifyAfterJoinFailFallbackDelayMs);
                }
            }

            if (shouldNotify) {
                let title = `🎯 SoRa :: Sniped ${match.name}`;
                let content = `From user ${authorUsername}\nSent in ${channelName} (${guildName})`;
                let onClick = () => { ro.safelyJoin(link); };

                if (joinData) {
                    onClick = () => { jumpToMessage(message.id, channelId, guildId); };

                    if (joinData.joined) {
                        title = `🎯 SoRa :: Joined ${match.name}`;
                    }

                    if (joinData.verified === false) {
                        content += "\n⚠️ Link was not verified";
                    }

                    if (joinData.verified && joinData.safe === true) {
                        content += "\n✅ Link was verified";
                    }

                    if (joinData.verified && joinData.safe === false) {
                        title = `⚠️ SoRa :: Bait link detected (${match.name})`;

                        if (joinData.joined) {
                            title += " - click to go to message";
                            content += `\nSafety action triggered! (${settings.store.verifyAfterJoinFailFallbackAction})`;
                        }
                    }

                    if (joinData.message) {
                        content += `\n${joinData.message}`;
                    }
                } else {
                    title += " - click to join!";
                }

                log.debug("Sending notification");
                sendNotification({ title, content, icon: match.iconUrl, onClick });
            }

        }

    },

});


function isMonitoredChannel(channelId: string) {
    return new Set(settings.store.monitorChannelList.split(",").map(id => id.trim()).filter(Boolean)).has(channelId);
}

function isGreedyIgnoredChannel(channelId: string) {
    return new Set(settings.store.monitorGreedyExceptionList.split(",").map(id => id.trim()).filter(Boolean)).has(channelId);
}

function isUserBlocked(userId: string) {
    return new Set(settings.store.monitorBlockedUserList.split(",").map(id => id.trim()).filter(Boolean)).has(userId);
}

function findKeywords(text: string): string[] {
    const normalized = text.toLowerCase();

    let matches: string[] = [];
    matches = Object.entries(TriggerKeywords)
        .filter(([_, value]) =>
            value.keywords.some(kw => {
                const pattern = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i");
                return pattern.test(normalized);
            })
        )
        .map(([key]) => key);

    return matches;
}
