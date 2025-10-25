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
import { BiomeSettings, BiomesKeywords, JoinerSettings, settings } from "./settings";
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

    /**
     * Tenta forçar a subscrição nos canais monitorados, sem abrir o histórico.
     */

    async preloadMonitoredChannels(monitored: Set<string>) {
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

    start() {
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
        const log = baselogger.inherit("stop");
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

    markLinkCodeAsProcessed(code: string) {
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
    async joinLink(link: { link: string; code: string; type: "share" | "private"; placeId?: string; }, logger: any = createLogger("")): Promise<{ isSafe: boolean; joinHappened: boolean; }> {
        const log = logger.inherit("joinLink");
        const verifyMode = this.config!.verifyMode || "none";
        const fallbackActionDelayMs = this.config!.verifyAfterJoinFailFallbackDelayMs || 5000;
        const fallbackAction = this.config!.verifyAfterJoinFailFallbackAction || "joinSols";
        let isSafe = false;
        let joinHappened = false;

        log.debug(`Verification mode: ${verifyMode}}`);

        if (verifyMode === "before") {
            const { allowed, message } = await this.isSafeLink(link);
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
            const { allowed, message } = await this.isSafeLink(link);
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
            log.trace("Attempting to close Roblox processes...");

            const processes = await Native.getProcess("RobloxPlayerBeta");
            if (!processes.length) {
                log.debug("No Roblox process found.");
            } else {
                // kill ALL processes!
                await Promise.all(
                    processes.map(proc => {
                        log.debug(`Killing Roblox process ${proc.pid} (${proc.name}) (path: ${proc.path})`);
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

    async openRoblox(link: { link?: string; type: "share" | "private" | "public"; code?: string; placeId?: string; }, logger: any = createLogger("log")): Promise<void> {
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

    async resolveShareCode(shareCode: string, logger = createLogger("log")): Promise<{ placeId: string; } | undefined> {
        const log = logger.inherit("resolveShareCode");
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
            log.debug(`CSRF - Status: ${csrfStatus || null}`);

            if (!csrf) {
                log.warn(`Failed to fetch CSRF token for share code ${shareCode}`);
                return undefined;
            }

            // 2️⃣ Resolve o share link usando o CSRF
            const { status, data } = await Native.resolveRobloxShareLink(token, csrf, shareCode);
            log.debug(` Status: ${status}, Data:`, data);

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
            log.debug("server data:", serverData);

            if (serverData?.status !== "Valid") {
                log.warn(`Share code ${shareCode} is not valid.`);
                return undefined;
            }

            log.info(`Share code ${shareCode} resolved successfully: placeId=${serverData.placeId}`);
            const stringifiedPlaceId = serverData.placeId.toString();
            return { placeId: stringifiedPlaceId };
        } catch (err) {
            log.error(`Error resolving share code ${shareCode}:`, err);
            return undefined;
        }
    },

    async isSafeLink(link: { link: string; type: "share" | "private" | "public"; code: string; placeId?: string; }): Promise<{ allowed: boolean; message: string; }> {
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


    /*
    * Message Handler
    */

    async handleNewMessage(data: { channelId: string; message: any; }) {
        const log = baselogger.inherit(`${data?.message?.id}.handleNewMessage`);
        const msgStart = performance.now();
        const timeTaken = () => `${(performance.now() - msgStart).toFixed(2)}ms`;

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
        const biomesMatched = this.detectBiomeKeywords(content);
        const biome = biomesMatched?.[0];
        if (biomesMatched.length === 0) {
            log.info(`❌ ${link.code} (${link.type}) did not match any enabled biome. (at +${timeTaken()})`);
            return;
        }
        if (biomesMatched.length > 1) {
            log.warn(`⚠️ ${link.code} (${link.type}) matched multiple biomes: ${biomesMatched.join(", ")} — ignoring due to ambiguity. (at +${timeTaken()})`);
            return;
        }
        log.info(`✅ Code ${link.code} (${link.type}) matched biome: ${biome} (at +${timeTaken()})`);

        const shouldNotifyThisMessage = this.config!.notifyEnabled; // snapshot the value before autojoin, because it MIGHT disable from this.config directly

        // Should we join automatically?
        if (this.config!.joinEnabled) {
            const { isSafe, joinHappened } = await this.joinLink(link, log);
            const wasVerified = this.config!.verifyMode !== "none";

            // se o join aconteceu, e o servidor era inseguro, entao o usuário foi movido
            // se o join aconteceu, e o servidor era seguro, tudo bem, continue
            // se o join nao aconteceu, e o servidor era seguro, tudo bem, continue (nao tem como isso acontecer atualmente)
            // se o join nao aconteceu, e o servidor era inseguro, tudo bem, continue

            if (wasVerified && !isSafe && this.config!.monitorBlockUnsafeServerMessageAuthors) {
                this.config!.monitorBlockedUserList += `,${authorId}`;
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
                return;
            }

            if (wasVerified && !joinHappened && !isSafe) {
                log.warn(`⚠️ Link ${link.code} was blocked.`);
                return;
            }

            if (this.config!.joinDisableAfterAutoJoin) settings.store.joinEnabled = false;
            if (this.config!.notifyDisableAfterAutoJoin) settings.store.notifyEnabled = false;
        }

        // Should we notify it?
        if (shouldNotifyThisMessage) {

            // @FIXME ugly but will do for now. should verify before attempting joins/notifications, instead
            if (this.config!.verifyMode !== "none" && !this.config!.joinEnabled) {
                const { allowed, message } = await this.isSafeLink(link);
                if (!allowed) {
                    log.warn(`[handleNewMessage.shouldNotifyThisMessage] ⚠️ Link verification failed: ${message}`);
                    return;
                }
            }

            const title = `🎯 SAJ :: Detected ${biome}`;
            const body = [
                `Server: ${link.code} (${link.type})`,
                `In channel: ${channelName} (${guildName})`,
                `Sent by: ${authorUsername} (${authorId})`
            ].join("\n");
            const onClick = () => {
                this.joinLink(link, log);
            };
            this.sendNotification(title, body, onClick);
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
