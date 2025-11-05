/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Settings } from "@api/Settings";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import { ChannelRouter, ChannelStore, FluxDispatcher, GuildStore, Menu, NavigationRouter } from "@webpack/common";

import { JoinerChatBarIcon } from "./JoinerIcon";
import { ITriggerSettings, JoinerSettings, recentJoinsStore, settings, TriggerKeywords } from "./settings";
import { createLogger } from "./utils";

const baselogger = createLogger("SolsAutoJoiner");

// logo acima do export default
const patchChannelContextMenu: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel) return children;

    const config = Settings.plugins.SolsAutoJoiner as unknown as JoinerSettings;
    const monitoredChannels = new Set(
        config.monitorChannelList
            .split(",")
            .map(id => id.trim())
            .filter(Boolean)
    );

    // log.warn("[patchChannelContextMenu] Config:", config);
    // log.warn("[patchChannelContextMenu] Monitored channels:", monitoredChannels);

    const isMonitored = monitoredChannels.has(channel.id);

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;

    group.push(
        <Menu.MenuItem
            id="vc-saj-monitor-toggle"
            label={isMonitored ? "SolsAuto stop monitoring" : "SolsAuto add to monitoring"}
            color={isMonitored ? "danger" : "brand"}
            action={() => {
                if (isMonitored) {
                    monitoredChannels.delete(channel.id);
                } else {
                    monitoredChannels.add(channel.id);
                }
                config.monitorChannelList = Array.from(monitoredChannels).join(",");
            }}
        />
    );

    return children;
};

export default definePlugin({
    name: "SolsAutoJoiner",
    description: "Monitor specific channels for Roblox share links + selected biomes",
    authors: [{ name: "masutty", id: 188851299255713792n }],
    settings,

    contextMenus: {
        "channel-context": patchChannelContextMenu,
    },

    renderChatBarButton: JoinerChatBarIcon,

    boundHandler: null as ((data: any) => void) | null,
    monitoredSet: null as Set<string> | null,
    linkCodeTimestamps: null as Map<string, number> | null,
    config: null as JoinerSettings | null,
    addRecentJoin(joinData: {
        title: string;
        image?: string;
        description: string;
        message: { id: string; jumpUrl?: string };
        author: { name: string; avatar?: string; };
        channel: { id: string; name: string; };
        guild: { id: string; name: string; icon?: string; };
        link: {
            code: string;
            type: "share" | "private";
            joinHappened: boolean;
            wasVerified: boolean;
            isSafe: boolean;
        };
    }) {
        recentJoinsStore.add(joinData);
    },

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
        recentJoinsStore.clear();

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

    stop(): void {
        const log = baselogger.inherit("stop");
        if (this.boundHandler) FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.boundHandler);
        this.boundHandler = null;
        this.config = null;

        this.linkCodeTimestamps?.clear();
        this.linkCodeTimestamps = null;
        recentJoinsStore.clear();

        this.monitoredSet?.clear();
        this.monitoredSet = null;


        log.info("Stopped.");
    },

    /*
    * Helpers
    */

    channelIsBeingMonitored(channelId: string): boolean {
        const monitoredChannelsSet = new Set(this.config!.monitorChannelList.split(",").map(id => id.trim()).filter(Boolean));
        return monitoredChannelsSet?.has(channelId);
    },

    userIsBlocked(userId: string): boolean {
        return this.config!.monitorBlockedUserList.split(",").map(x => x.trim()).includes(userId);
    },

    getLinkFromMessageContent(content: string): { ok: true; type: "share" | "private"; link: string; code: string; placeId?: string; } | { ok: false; reason: "no-content" | "ambiguous" | "message-has-no-match"; } {
        if (!content?.trim()) return { ok: false, reason: "no-content" };

        const normalized = content.toLowerCase();

        const shareMatch = /https?:\/\/(?:www\.)?roblox\.com\/share\?code=([a-f0-9]+)/i.exec(normalized);
        const privateMatch = /https?:\/\/(?:www\.)?roblox\.com\/games\/(\d+)(?:\/[^?]*)?\?privateserverlinkcode=([a-f0-9]+)/i.exec(normalized);

        const hasShare = Boolean(shareMatch);
        const hasPrivate = Boolean(privateMatch);

        // Ignore ambiguous messages with both link types
        if (hasShare && hasPrivate) return { ok: false, reason: "ambiguous" };

        const match = shareMatch ?? privateMatch;
        if (!match) return { ok: false, reason: "message-has-no-match" };

        return {
            ok: true,
            type: hasShare ? "share" : "private",
            link: match[0],
            code: hasShare ? match[1] : match[2],
            placeId: hasPrivate ? match[1] : undefined,
        };
    },

    isLinkCodeOnCooldown(code: string): { onCooldown: boolean; remaining: number; } {
        const now = Date.now();
        const cooldownMs = this.config!._dev_dedupe_link_cooldown_ms || 10000;
        const lastTime = this.linkCodeTimestamps!.get(code) ?? 0;
        let onCooldown = false;
        let remaining = 0;
        if (now - lastTime < cooldownMs) {
            onCooldown = true;
            remaining = cooldownMs - (now - lastTime);
        }
        return { onCooldown, remaining };
    },

    markLinkCodeAsProcessed(code: string): void {
        const now = Date.now();
        this.linkCodeTimestamps!.set(code, now);
    },

    isLinkProcessable(link: { link: string; code: string; type: "share" | "private"; placeId?: string; }): { isProcessable: boolean; cooldown: number | null; } {
        const { onCooldown, remaining } = this.isLinkCodeOnCooldown(link.code);

        if (onCooldown) {
            return { isProcessable: false, cooldown: remaining };
        }

        this.markLinkCodeAsProcessed(link.code);
        return { isProcessable: true, cooldown: null };
    },

    detectTriggerKeywords(text: string, logger: any = baselogger): string[] {
        const normalized = text.toLowerCase();
        return Object.entries(TriggerKeywords)
            .filter(([_, value]) =>
                value.keywords.some(kw => {
                    // eslint-disable-next-line @stylistic/quotes
                    const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, "i");
                    return pattern.test(normalized);
                })
            )
            .map(([biome]) => biome);
    },

    // true if join was successful, false otherwise (currently means join is unsafe)
    async joinLink(link: { link: string; code: string; type: "share" | "private"; placeId?: string; }, logger: any = baselogger): Promise<{ isSafe: boolean; joinHappened: boolean; }> {
        const log = logger.inherit("joinLink");
        const verifyMode = this.config!.verifyMode || "none";
        const fallbackActionDelayMs = this.config!.verifyAfterJoinFailFallbackDelayMs || 5000;
        const fallbackAction = this.config!.verifyAfterJoinFailFallbackAction || "joinSols";
        let isSafe = false;
        let joinHappened = false;

        log.debug(`Verification mode: ${verifyMode}}`);

        if (verifyMode === "before") {
            const { allowed, message } = await this.isSafeLink(link, log);
            if (!allowed) {
                log.warn(`⚠️ Link verification (before) failed: ${message}`);
                return { isSafe, joinHappened };
            }
            isSafe = true;
        }

        log.debug(`Joining link: ${link.link}`);
        await this.openRoblox(link, log);
        joinHappened = true;

        if (verifyMode === "after") {
            const { allowed, message } = await this.isSafeLink(link, log);
            if (!allowed) {
                log.warn(`⚠️ Link verification (after) failed: ${message}`);
                log.debug(`Waiting ${fallbackActionDelayMs}ms before fallback action...`);
                await new Promise(res => setTimeout(res, fallbackActionDelayMs));

                switch (fallbackAction) {
                    case "joinSols":
                        await this.openRoblox({ type: "public", placeId: "15532962292" });
                        break;
                    case "quit":
                        await this.closeRoblox();
                        break;
                    default:
                        log.error(`Unknown fallback action: ${fallbackAction}`);
                        break;
                }
                return { isSafe, joinHappened };
            }
            isSafe = true;
        }

        return { isSafe, joinHappened };
    },

    async closeRoblox(logger: any = baselogger): Promise<void> {
        const log = logger.inherit("closeRoblox");
        const Native = (VencordNative.pluginHelpers.SolsAutoJoiner as unknown) as {
            getProcess: (processName: string) => Promise<{ pid: number; name: string; path?: string; }[]>;
            killProcess: (pid: number) => Promise<void>;
        };

        const nativeStart = performance.now();
        try {
            log.debug("Attempting to close Roblox processes...");

            const processes = await Native.getProcess("RobloxPlayerBeta");
            if (!processes.length) {
                log.trace("No Roblox process found.");
            } else {
                // kill ALL processes!
                await Promise.all(
                    processes.map(proc => {
                        log.trace(`Killing Roblox process ${proc.pid} (${proc.name}) (path: ${proc.path})`);
                        return Native.killProcess(proc.pid);
                    })
                );
                log.debug(`Terminated ${processes.length} Roblox processes.`);
            }
        } catch (err) {
            log.error("⚠️ Failed to close Roblox processes:", err);
        } finally {
            log.perf(`Closed Roblox in ${(performance.now() - nativeStart).toFixed(2)}ms.`);
        }
    },

    async openRoblox(link: { link?: string; type: "share" | "private" | "public"; code?: string; placeId?: string; }, logger: any = baselogger): Promise<void> {
        const log = logger.inherit("openRoblox");
        const shouldCloseGameBefore = this.config!.joinCloseGameBefore || true;
        const Native = (VencordNative.pluginHelpers.SolsAutoJoiner as unknown) as {
            openUri: (uri: string) => Promise<void>;
        };

        if (!link?.type) {
            log.error("❌ Missing link type.");
            return;
        }

        let uri: string | null = null;

        switch (link.type) {
            case "public":
                if (!link.placeId) {
                    log.error("❌ Missing placeId for public link.");
                    return;
                }
                uri = `roblox://placeID=${link.placeId}`;
                break;

            case "share":
                if (!link.code) {
                    log.error("❌ Missing share code.");
                    return;
                }
                uri = `roblox://navigation/share_links?code=${link.code}&type=Server`;
                break;

            case "private":
                if (!link.placeId || !link.code) {
                    log.error("❌ Missing placeId or linkCode for private link.");
                    return;
                }
                uri = `roblox://placeID=${link.placeId}&linkCode=${link.code}`;
                break;
        }

        if (!uri) {
            log.error("❌ Failed to construct URI.");
            return;
        }

        try {
            const nativeStart = performance.now();
            if (shouldCloseGameBefore) await this.closeRoblox(log);
            await Native.openUri(uri);
            // please forgive me for this
            log.perf(`${shouldCloseGameBefore ? "Closed and l" : "L"}aunched Roblox in ${(performance.now() - nativeStart).toFixed(2)}ms.`); // this fkn ternary is funny as hell for me lmfao
        } catch (err) {
            log.error("⚠️ Failed to open Roblox link:", err);
        }
    },

    async resolveShareCode(shareCode: string, logger = baselogger): Promise<{ placeId: string; } | undefined> {
        const log = logger.inherit("resolveShareCode");
        const resolveStart = performance.now();
        try {
            log.debug(`Resolving share code ${shareCode}`);

            const token = this.config!.verifyRoblosecurityToken;
            if (!token) {
                log.warn("No .ROBLOSECURITY token set.");
                return undefined;
            }

            // Pega o Native do plugin
            const Native = VencordNative.pluginHelpers.SolsAutoJoiner as {
                fetchRobloxCsrf: (token: string) => Promise<{ status: number; csrf: string | null; }>;
                resolveRobloxShareLink: (token: string, csrf: string, shareCode: string) => Promise<{ status: number; data: any; }>;
            };

            // 1️⃣ Busca CSRF token
            const { status: csrfStatus, csrf } = await Native.fetchRobloxCsrf(token);
            // status 403 expected
            log.trace(`CSRF - Status: ${csrfStatus || null}`);

            if (!csrf) {
                log.warn(`Failed to fetch CSRF token for share code ${shareCode}`);
                return undefined;
            }

            // 2️⃣ Resolve o share link usando o CSRF
            const { status, data } = await Native.resolveRobloxShareLink(token, csrf, shareCode);
            log.trace(` Status: ${status}, Data:`, data);

            if (!data || status !== 200) {
                log.error(` Failed to resolve share code ${shareCode}`);
                log.error(` ${data}}`);
                // if the word "auth" is mentioned in the error, it probably means we need a new token
                if (data?.includes("auth")) {
                    log.warn("⚠️ Your .ROBLOSECURITY token is probably expired. Try setting a new one.");
                    this.sendNotification("⚠️ Your .ROBLOSECURITY token is probably expired.", "Try setting a new one for SolsAutoJoiner to continue validating your links, or disable link validation.");
                }
                return undefined;
            }

            const serverData = data?.privateServerInviteData;
            log.trace("Server data:", serverData);

            if (serverData?.status !== "Valid") {
                log.trace(`Share code ${shareCode} is not valid.`);
                return undefined;
            }

            log.trace(`Share code ${shareCode} resolved successfully: placeId=${serverData.placeId}`);
            log.perf(`Resolved share code ${shareCode} in ${(performance.now() - resolveStart).toFixed(2)}ms.`);
            const stringifiedPlaceId = serverData.placeId.toString();
            return { placeId: stringifiedPlaceId };
        } catch (err) {
            log.error(`Error resolving share code ${shareCode}:`, err);
            return undefined;
        }
    },

    async isSafeLink(link: { link: string; type: "share" | "private" | "public"; code: string; placeId?: string; }, logger = baselogger): Promise<{ allowed: boolean; message: string; }> {
        let { placeId } = link;
        const log = logger.inherit("isSafeLink");

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
            const resolved = await this.resolveShareCode(link.code, log);
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
        const normalized = placeId.toString().toLowerCase().trim();
        const allowedIds = this.config!.verifyAllowedPlaceIds.split(",").map(id => id.trim()).filter(Boolean);
        if (allowedIds.length === 0) return true;
        return allowedIds.includes(normalized);
    },

    isBlockedPlaceId(placeId: string): boolean {
        const normalized = placeId.toString().toLowerCase().trim();
        const blockedIds = this.config!.verifyBlockedPlaceIds.split(",").map(id => id.trim()).filter(Boolean);
        if (blockedIds.length === 0) return false;
        return blockedIds.includes(normalized);
    },

    extractEmbedContentFromMessage(message: any): string {
        const embeds = message?.embeds;
        if (!embeds || !Array.isArray(embeds) || embeds.length === 0) return "";

        const parts: string[] = [];

        for (const embed of embeds) {
            if (!embed || typeof embed !== "object") continue;

            const title = embed.title ?? "";
            const description = embed.description ?? "";
            const footer = embed.footer?.text ?? "";

            // Combina os fields (name + value)
            const fieldsText = Array.isArray(embed.fields)
                ? embed.fields
                    .map(f => `${f?.name ?? ""} ${f?.value ?? ""}`.trim())
                    .filter(Boolean)
                    .join(" ")
                : "";

            parts.push(title, description, fieldsText, footer);
        }

        if (parts.length === 0) return "";

        return parts
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    },

    /*
    * Message Handler
    */

    async handleNewMessage(data: { channelId: string; message: any; optimistic?: boolean; }) {
        const log = baselogger.inherit(`${data?.message?.id}.handleNewMessage`);
        const msgStart = performance.now();
        const timeTaken = () => `${(performance.now() - msgStart).toFixed(2)}ms`;

        // Is it a valid message?
        const { channelId, optimistic, message } = data;
        const authorId = message.author?.id ?? "Unknown ID";

        if (optimistic || message.state === "SENDING") {
            log.trace(`[MessageTest:${message.id}] Ignoring local/optimistic message.`);
            return;
        }

        if (!message.guild_id) {
            log.trace(`[MessageTest:${message.id}] Ignoring message without guild.`);
            return;
        }

        // log.trace(`[MessageTest:${message.id}] Valid message (most likely)`);  // too granular, will make too much spam on console
        if (!this.channelIsBeingMonitored(channelId)) return;
        if (this.userIsBlocked(authorId)) return;

        let content: string = (message.content ?? "");
        const embed_content: string = this.extractEmbedContentFromMessage(message);
        if (embed_content) {
            log.trace("Merging the following embed data to content: ", embed_content);
            content += ` ${embed_content}`;
        }

        // log.info("Message:", content, embed_contents);
        log.perf("Author: message.author", message.author);
        const authorUsername = message.author?.username ?? "Unknown User";
        const channelName = ChannelStore.getChannel(channelId)?.name ?? "Unknown Channel";
        const guildId = message.guild_id;
        const guildName = GuildStore.getGuild(guildId)?.name ?? "Unknown Guild";

        // What is the server link?
        const link = this.getLinkFromMessageContent(content);
        if (!link.ok) {
            log.warn(`⚠️ Not valid because ${link.reason}. (at +${timeTaken()})`);
            return;
        }

        // Can we process it? (deduplication/cooldown)
        const { isProcessable, cooldown } = this.isLinkProcessable(link);
        if (!isProcessable) {
            log.debug(`❌ ${link.code} on cooldown (${cooldown}ms) (at +${timeTaken()})`);
            return;
        }

        // What biome is it?
        const triggerWordsMatched = this.detectTriggerKeywords(content);
        const match = triggerWordsMatched?.[0];
        const matchName = TriggerKeywords[match as keyof typeof TriggerKeywords]?.name ?? "KEYWORD_MATCH_FAILED";
        if (triggerWordsMatched.length === 0) {
            log.info(`❌ ${link.code} (${link.type}) did not match any enabled. (at +${timeTaken()})`);
            return;
        }
        if (triggerWordsMatched.length > 1) {
            log.warn(`⚠️ ${link.code} (${link.type}) matched multiple: ${triggerWordsMatched.join(", ")} — ignoring due to ambiguity. (at +${timeTaken()})`);
            return;
        }

        // Is the biome enabled?
        const isBiomeEnabled = Boolean(this.config?.[match as keyof ITriggerSettings]);
        if (!isBiomeEnabled) {
            log.info(`🚫 ${link.code} (${link.type}) matched  "${matchName}" but it is disabled in config. (at +${timeTaken()})`);
            return;
        }

        log.debug(`✅ Code ${link.code} (${link.type}) matched: ${matchName} (at +${timeTaken()})`);
        log.perf(`[MessageTest] [this is the one that passed] ${JSON.stringify(data)}`);

        const shouldNotifyThisMessage = this.config!.notifyEnabled; // snapshot the value before autojoin, because it MIGHT disable from this.config directly
        const snapshotJoinEnabled = this.config!.joinEnabled;

        // Should we join automatically?
        if (this.config!.joinEnabled) {
            log.info(`🎯 ${link.code} Starting join... (at +${timeTaken()})`);
            const { isSafe, joinHappened } = await this.joinLink(link, log);
            const wasVerified = this.config!.verifyMode !== "none";

            // se o join aconteceu, e o servidor era inseguro, entao o usuário foi movido
            // se o join aconteceu, e o servidor era seguro, tudo bem, continue
            // se o join nao aconteceu, e o servidor era seguro, tudo bem, continue (nao tem como isso acontecer atualmente)
            // se o join nao aconteceu, e o servidor era inseguro, tudo bem, continue

            if (wasVerified && !isSafe && this.config!.monitorBlockUnsafeServerMessageAuthors) {
                this.config!.monitorBlockedUserList += `,${authorId}`;
            }

            if (joinHappened) {
                const trigger = TriggerKeywords[match as keyof typeof TriggerKeywords];
                this.addRecentJoin({
                    title: trigger.name,
                    image: trigger.iconUrl || "https://discord.com/assets/881ed827548f38c6.svg", // fallback question mark
                    description: `On channel #${channelName} (${guildName})`, // base; o "X ago" é computado no render
                    author: {
                        name: authorUsername,
                        avatar: `https://cdn.discordapp.com/avatars/${message.author?.id}/${message.author?.avatar}.png`,
                    },
                    message: {
                        id: message.id,
                        jumpUrl: `https://discord.com/channels/${ChannelStore.getChannel(channelId)?.guild_id}/${channelId}/${message.id}`,
                    },
                    channel: {
                        id: channelId,
                        name: channelName,
                    },
                    guild: {
                        id: ChannelStore.getChannel(channelId)?.guild_id,
                        name: guildName,
                    },
                    link: {
                        code: link.code,
                        type: link.type,
                        joinHappened: joinHappened,
                        wasVerified: wasVerified,
                        isSafe: isSafe
                    }
                });
            }

            if (wasVerified && joinHappened && !isSafe) {
                const title = "⚠️ SAJ :: Bad server!";
                const body = [
                    "The link you just tried to join was unsafe. You have been moved to a safe server. Click on this notification to copy the message link.",
                    `In channel: ${channelName} (${guildName})`,
                    `Sent by: ${authorUsername} (${authorId})`
                ].join("\n");
                const onClick = async () => {
                    const messageUrl = `https://discord.com/channels/${ChannelStore.getChannel(channelId)?.guild_id}/${channelId}/${message.id}`;
                    await copyToClipboard(messageUrl);
                };
                this.sendNotification(title, body, onClick);
                log.warn(`⚠️ ${link.code} was a bad server... (at +${timeTaken()})`);
                return;
            }

            if (wasVerified && !joinHappened && !isSafe) {
                log.warn(`⚠️ ${link.code} was blocked.`);
                return;
            }

            if (this.config!.joinDisableAfterAutoJoin) settings.store.joinEnabled = false;
            if (this.config!.notifyDisableAfterAutoJoin) settings.store.notifyEnabled = false;
        }

        // Should we notify it?
        if (shouldNotifyThisMessage) {

            // @FIXME ugly but will do for now. should verify before attempting joins/notifications, instead
            if (this.config!.verifyMode !== "none" && !snapshotJoinEnabled) {
                const { allowed, message } = await this.isSafeLink(link, log);
                if (!allowed) {
                    log.warn(`⚠️ ${link.code} Link verification failed: ${message}`);
                    return;
                }
            }

            const title = `🎯 SAJ :: Detected ${matchName}`;
            const body = [
                `Server: ${link.code} (${link.type})`,
                `In channel: ${channelName} (${guildName})`,
                `Sent by: ${authorUsername} (${authorId})`
            ].join("\n");
            const onClick = () => {
                this.joinLink(link, log);
            };
            this.sendNotification(title, body, onClick);
            log.info(`✅ ${link.code} Notification sent. (at +${timeTaken()})`);
        }
        log.trace(`Finished (at +${timeTaken()})`);
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
