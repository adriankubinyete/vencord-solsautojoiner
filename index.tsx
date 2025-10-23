/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import definePlugin from "@utils/types";
import { ChannelRouter, ChannelStore, FluxDispatcher, GuildStore, NavigationRouter } from "@webpack/common";

import { JoinerChatBarIcon } from "./JoinerIcon";
import { BiomeSettings, BiomesKeywords, JoinerSettings, settings } from "./settings";
import { createLogger } from "./utils";

const log = createLogger("[SolsAutoJoiner]", true);

export default definePlugin({
    name: "SolsAutoJoiner",
    description: "Monitor specific channels for Roblox share links + selected biomes",
    authors: [{ name: "masutty", id: 188851299255713792n }],
    settings,

    renderChatBarButton: JoinerChatBarIcon,

    boundHandler: null as ((data: any) => void) | null,
    monitoredSet: null as Set<string> | null,
    linkCodeTimestamps: null as Map<string, number> | null,
    config: null as JoinerSettings | null,

    /**
     * Tenta forçar a subscrição nos canais monitorados, sem abrir o histórico.
     */

    async preloadMonitoredChannels(monitored: Set<string>) {
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

    start() {
        // Carrega a configuração do plugin
        const config = Settings.plugins.SolsAutoJoiner as unknown as JoinerSettings;
        this.config = config;

        // Inicializa o Set de canais monitorados
        this.monitoredSet = new Set(
            config.monitorChannelList
                .split(",")
                .map(id => id.trim())
                .filter(Boolean)
        );

        // Inicializa o Map para deduplicação de links
        this.linkCodeTimestamps = new Map();

        // Bind do handler de novas mensagens
        this.boundHandler = this.handleNewMessage.bind(this);
        FluxDispatcher.subscribe("MESSAGE_CREATE", this.boundHandler);

        // Force-load channels on startup, se configurado
        if (config.monitorNavigateToChannelsOnStartup && this.monitoredSet.size > 0) {
            this.preloadMonitoredChannels(this.monitoredSet)
                .then(() => log.info("Finished force-loading monitored channels"))
                .catch(err => log.error("Error force-loading monitored channels:", err));
        }
    },

    stop() {
        if (this.boundHandler) FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.boundHandler);
        this.boundHandler = null;
        this.config = null;

        this.linkCodeTimestamps?.clear();
        this.linkCodeTimestamps = null;

        this.monitoredSet?.clear();
        this.monitoredSet = null;

        log.info("Stopped.");
    },

    /*
    * Helpers
    */

    channelIsBeingMonitored(channelId: string) {
        const monitoredChannelsSet = new Set(this.config!.monitorChannelList.split(",").map(id => id.trim()).filter(Boolean));
        return monitoredChannelsSet?.has(channelId);
    },

    userIsBlocked(userId: string) {
        return this.config!.monitorBlockedUserList.split(",").map(x => x.trim()).includes(userId);
    },

    getLinkFromMessageContent(content: string) {
        if (!content?.trim()) return null;

        const normalized = content.toLowerCase();

        const shareMatch = /https?:\/\/(?:www\.)?roblox\.com\/share\?code=([a-f0-9]+)/i.exec(normalized);
        const privateMatch = /https?:\/\/(?:www\.)?roblox\.com\/games\/(\d+)(?:\/[^?]*)?\?privateserverlinkcode=([a-f0-9]+)/i.exec(normalized);

        // https://www.roblox.com/games/15532962292?privateServerLinkCode=10797789767819061560477789923716
        // placeid = 15532962292

        const hasShare = Boolean(shareMatch);
        const hasPrivate = Boolean(privateMatch);

        if (hasShare && hasPrivate) {
            log.warn("⚠️ Both a share link and a private server link found in the same message — ignoring due to ambiguity.");
            return null;
        }

        const match = shareMatch ?? privateMatch;
        if (!match) return null;

        return {
            type: hasShare ? "share" as const : "private" as const,
            link: match[0],
            code: hasShare ? match[1] : match[2],
            placeid: hasPrivate ? match[1] : undefined
        };
    },

    isLinkCodeOnCooldown(code: string): boolean {
        const now = Date.now();
        const cooldownMs = this.config!._dev_dedupe_link_cooldown_ms || 10000;
        const lastTime = this.linkCodeTimestamps!.get(code) ?? 0;
        if (now - lastTime < cooldownMs) {
            const remainingCooldown = cooldownMs - (now - lastTime);
            log.debug(`⏳ Code ${code} is on cooldown. Remaining: ${remainingCooldown}ms`);
            return true;
        }
        return false;
    },

    markLinkCodeAsProcessed(code: string) {
        const now = Date.now();
        this.linkCodeTimestamps!.set(code, now);
    },

    isLinkProcessable(link: { link: string; code: string; type: "share" | "private"; placeId?: string }) {
        // log.info(`Processing link: ${link.code}`);
        if (this.isLinkCodeOnCooldown(link.code)) return false;
        this.markLinkCodeAsProcessed(link.code);
        return true;
    },

    detectBiomeKeywords(text: string): string[] {
        const normalized = text.toLowerCase();
        return Object.entries(BiomesKeywords)
            .filter(([biome]) => this.config![biome as keyof BiomeSettings])
            .filter(([_, keywords]) =>
                keywords.some(kw => {
                    // eslint-disable-next-line @stylistic/quotes
                    const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, "i");
                    return pattern.test(normalized);
                })
            )
            .map(([biome]) => biome);
    },

    // true if join was successful, false otherwise (currently means join is unsafe)
    async join(link: { link: string; code: string; type: "share" | "private"; placeId?: string; }): Promise<{ isSafe: boolean; joinHappened: boolean; }> {
        const verifyMode = this.config!.verifyMode || "none";
        const fallbackActionDelayMs = this.config!._dev_verification_fail_fallback_delay_ms || 5000;
        let isSafe = false;
        let joinHappened = false;

        if (verifyMode === "before") {
            const { allowed, message } = await this.isSafeLink(link);
            if (!allowed) {
                log.warn(`⚠️ Link verification (before) failed: ${message}`);
                return { isSafe, joinHappened };
            }
            isSafe = true;
        }

        await this.openRoblox(link);
        joinHappened = true;

        if (verifyMode === "after") {
            const { allowed, message } = await this.isSafeLink(link);
            if (!allowed) {
                log.warn(`⚠️ Link verification (after) failed: ${message}`);
                log.info(`Waiting ${fallbackActionDelayMs}ms before fallback action...`);
                await new Promise(res => setTimeout(res, fallbackActionDelayMs));
                await this.openRoblox({ type: "public", placeId: "15532962292" });
                return { isSafe, joinHappened };
            }
            isSafe = true;
        }

        return { isSafe, joinHappened };
    },

    async openRoblox(link: { link?: string; type: "share" | "private" | "public"; code?: string; placeId?: string; }) {
        const Native = (VencordNative.pluginHelpers.SolsAutoJoiner as unknown) as {
            openRoblox: (uri: string) => void;
        };

        if (!link?.type) {
            log.error("❌ openRoblox: Missing link type.");
            return;
        }

        let uri: string | null = null;

        switch (link.type) {
            case "public":
                if (!link.placeId) {
                    log.error("❌ openRoblox: Missing placeId for public link.");
                    return;
                }
                uri = `roblox://placeID=${link.placeId}`;
                break;

            case "share":
                if (!link.code) {
                    log.error("❌ openRoblox: Missing share code.");
                    return;
                }
                uri = `roblox://navigation/share_links?code=${link.code}&type=Server`;
                break;

            case "private":
                if (!link.placeId || !link.code) {
                    log.error("❌ openRoblox: Missing placeId or linkCode for private link.");
                    return;
                }
                uri = `roblox://placeID=${link.placeId}&linkCode=${link.code}`;
                break;
        }

        if (!uri) {
            log.error("❌ openRoblox: Failed to construct URI.");
            return;
        }

        try {
            Native.openRoblox(uri);
        } catch (err) {
            log.error("⚠️ Failed to open Roblox link:", err);
        }
    },

    async resolveShareCode(shareCode: string): Promise<{ placeId: string } | undefined> {
        try {
            log.debug(`Resolving share code ${shareCode}`);

            const token = this.config!.verifyRoblosecurityToken;
            if (!token) {
                log.warn("No .ROBLOSECURITY token set.");
                return undefined;
            }

            // Pega o Native do plugin
            const Native = VencordNative.pluginHelpers.SolsAutoJoiner as {
                fetchRobloxCsrf: (token: string) => Promise<{ status: number; csrf: string | null }>;
                resolveRobloxShareLink: (token: string, csrf: string, shareCode: string) => Promise<{ status: number; data: any }>;
            };

            // 1️⃣ Busca CSRF token
            const { status: csrfStatus, csrf } = await Native.fetchRobloxCsrf(token);
            // status 403 expected
            log.debug(`[CSRF] Status: ${csrfStatus} || "null"}`);

            if (!csrf) {
                log.warn(`Failed to fetch CSRF token for share code ${shareCode}`);
                return undefined;
            }

            // 2️⃣ Resolve o share link usando o CSRF
            const { status, data } = await Native.resolveRobloxShareLink(token, csrf, shareCode);
            log.debug(`[ResolveShareLink] Status: ${status}, Data:`, data);

            if (!data || status !== 200) {
                log.error(`[ResolveShareLink] Failed to resolve share code ${shareCode}`);
                log.error(`[ResolveShareLink] ${data}}`);
                // if the word "auth" is mentioned in the error, it probably means we need a new token
                if (data?.includes("auth")) {
                    log.warn("⚠️ Your .ROBLOSECURITY token is probably expired. Try setting a new one.");
                }
                return undefined;
            }

            const serverData = data?.privateServerInviteData;
            log.debug("[ServerData]", serverData);

            if (serverData?.status !== "Valid") {
                log.warn(`Share code ${shareCode} is not valid.`);
                return undefined;
            }

            log.info(`Share code ${shareCode} resolved successfully: placeId=${serverData.placeId}`);
            return { placeId: serverData.placeId };
        } catch (err) {
            log.error(`Error resolving share code ${shareCode}:`, err);
            return undefined;
        }
    },

    async isSafeLink(link: { link: string; type: "share" | "private"; code: string; placeId?: string; }): Promise<{ allowed: boolean; message: string; }> {
        let { placeId } = link;

        // --- PRIVATE SERVER LINKS ---
        if (link.type === "private") {
            if (!placeId) {
                return { allowed: false, message: "No placeId found in private server link." };
            }

            if (this.isBlockedPlaceId(placeId)) {
                return { allowed: false, message: `PlaceId ${placeId} is blocked.` };
            }

            if (!this.isAllowedPlaceId(placeId)) {
                return { allowed: false, message: `PlaceId ${placeId} is not in the allowed list.` };
            }

            return { allowed: true, message: "Private link is allowed." };
        }

        // --- SHARE LINKS ---
        if (link.type === "share") {
            const resolved = await this.resolveShareCode(link.code);
            placeId = resolved?.placeId;

            if (!placeId) {
                return { allowed: false, message: "Failed to resolve placeId from share link." };
            }

            if (this.isBlockedPlaceId(placeId)) {
                return { allowed: false, message: `PlaceId ${placeId} is blocked.` };
            }

            if (!this.isAllowedPlaceId(placeId)) {
                return { allowed: false, message: `PlaceId ${placeId} is not in the allowed list.` };
            }

            return { allowed: true, message: "Share link is allowed." };
        }

        // --- UNKNOWN TYPE ---
        return { allowed: false, message: "Unknown link type." };
    },

    isAllowedPlaceId(placeId: string): boolean {
        const allowedIds = this.config!.verifyAllowedPlaceIds.split(",").map(id => id.trim()).filter(Boolean);
        if (allowedIds.length === 0) return true;
        return allowedIds.includes(placeId);
    },

    isBlockedPlaceId(placeId: string): boolean {
        const blockedIds = this.config!.verifyBlockedPlaceIds.split(",").map(id => id.trim()).filter(Boolean);
        if (blockedIds.length === 0) return false;
        return blockedIds.includes(placeId);
    },


    /*
    * Message Handler
    */

    async handleNewMessage(data: { channelId: string; message: any; }) {
        const msgStartTime = performance.now();

        // Is it a valid message?
        const { channelId, message } = data;
        const authorId = message.author?.id ?? "Unknown ID";
        if (!this.channelIsBeingMonitored(channelId)) return;
        if (this.userIsBlocked(authorId)) return;

        const content: string = (message.content ?? "");
        const authorUsername = message.author?.username ?? "Unknown User";
        const channelName = ChannelStore.getChannel(channelId)?.name ?? "Unknown Channel";
        const guildName = GuildStore.getGuild(ChannelStore.getChannel(channelId)?.guild_id)?.name ?? "Unknown Guild";

        // What is the server link?
        const link = this.getLinkFromMessageContent(content);
        if (!link) return;

        // log.info("Checking if link is processable...");
        if (!this.isLinkProcessable(link)) return; // Is it on cooldown? (deduplication via link)
        log.debug(`Detected link of type ${link.type} from ${authorUsername} (${authorId}):`, link);

        // What biome is it?
        const biomesMatched = this.detectBiomeKeywords(content);
        const biome = biomesMatched?.[0];
        if (biomesMatched.length === 0) {
            log.debug(`❌ Link ${link.code} did not match any enabled biome.`);
            return;
        }
        if (biomesMatched.length > 1) {
            log.warn(`⚠️ Link ${link.code} matched multiple biomes: ${biomesMatched.join(", ")} — ignoring due to ambiguity.`);
            return;
        }
        log.info(`✅ Link ${link.code} matched biome: ${biome}`);

        const shouldNotifyThisMessage = this.config!.notifyEnabled; // snapshot the value before autojoin, because it MIGHT disable from this.config directly

        // Should we join automatically?
        if (this.config!.joinEnabled) {
            const { isSafe, joinHappened } = await this.join(link);

            // se o join aconteceu, e o servidor era inseguro, entao o usuário foi movido
            // se o join aconteceu, e o servidor era seguro, tudo bem, continue
            // se o join nao aconteceu, e o servidor era seguro, tudo bem, continue (nao tem como isso acontecer atualmente)
            // se o join nao aconteceu, e o servidor era inseguro, tudo bem, continue

            if (!isSafe && this.config!.monitorBlockUnsafeServerMessageAuthors) {
                this.config!.monitorBlockedUserList += `,${authorId}`;
            }

            if (joinHappened && !isSafe) {
                const title = "⚠️ SAJ :: Bad server!";
                const body = [
                    "The link you just tried to join was unsafe. You have been moved to a safe server. Click on this notification to jump to the bad message.",
                    `In channel: ${channelName} (${guildName})`,
                    `Sent by: ${authorUsername} (${authorId})`
                ].join("\n");
                const onClick = () => {
                    const messageUrl = `https://discord.com/channels/${ChannelStore.getChannel(channelId)?.guild_id}/${channelId}/${message.id}`;
                    window.open(messageUrl, "_blank");
                };
                this.sendNotification(title, body, onClick);
                return;
            }

            if (!joinHappened && !isSafe) {
                log.warn(`⚠️ Link ${link.code} was blocked.`);
                return;
            }

            if (this.config!.joinDisableAfterAutoJoin) settings.store.joinEnabled = false;
            if (this.config!.notifyDisableAfterAutoJoin) settings.store.notifyEnabled = false;
        }

        // Should we notify it?
        if (shouldNotifyThisMessage) {
            const title = `🎯 SAJ :: Detected ${biome}`;
            const body = [
                `Server: ${link.code} (${link.type})`,
                `In channel: ${channelName} (${guildName})`,
                `Sent by: ${authorUsername} (${authorId})`
            ].join("\n");
            const onClick = () => {
                this.join(link);
            };
            this.sendNotification(title, body, onClick);
        }

    },

    sendNotification(title: string, body: string, onclick?: () => void): void {
        try {
            const notif = new Notification(title, { body });
            notif.onclick = () => {
                if (onclick) {
                    try {
                        onclick();
                    } catch (err) {
                        this.log?.error("⚠️ Failed to run notification callback:", err);
                    }
                }
                notif.close();
            };
        } catch (err) {
            this.log?.error("⚠️ Failed to send notification:", err);
        }
    },

});
