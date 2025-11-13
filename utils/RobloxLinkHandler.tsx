/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "../settings";
import { createLogger } from "./index";

interface ValidServerLink {
    ok: true;
    type: "share" | "private" | "public";
    link: string;
    code: string;
    placeId?: string;
}

interface InvalidServerLink {
    ok: false;
    reason: "no-content" | "ambiguous" | "message-has-no-match";
}

type ServerLink = ValidServerLink | InvalidServerLink;

export interface IJoinData {
    verified: boolean;
    joined: boolean;
    safe: boolean;
    message?: string;
}

interface RobloxCloseResult {
    ok: boolean;
    message: string;
    closedCount?: number;
}

interface ShareCodeResolutionResult {
    ok: boolean;
    expired: boolean;
    placeId?: string;
    message?: string;
}

export class RobloxLinkHandler {
    private logger;

    constructor(private settings: any, logger?: ReturnType<typeof createLogger>) {
        this.logger = logger ?? createLogger("RoSniper:RobloxLinkHandler");
    }

    private sublogger(prefix: string) {
        const make = (level: keyof typeof this.logger) => (...args: any[]) => {
            if (typeof this.logger[level] === "function") {
                const [first, ...rest] = args;
                // sempre prefixa a primeira parte da mensagem
                if (typeof first === "string") {
                    this.logger[level](`[${prefix}] ${first}`, ...rest);
                } else {
                    this.logger[level](`[${prefix}]`, first, ...rest);
                }
            }
        };

        return {
            trace: make("trace"),
            debug: make("debug"),
            info: make("info"),
            warn: make("warn"),
            error: make("error"),
        };
    }

    extract(content: string): ServerLink {
        if (!content?.trim()) return { ok: false, reason: "no-content" };

        const normalized = content.toLowerCase();
        const shareMatch = /https?:\/\/(?:www\.)?roblox\.com\/share\?code=([a-f0-9]+)/i.exec(normalized);
        const privateMatch = /https?:\/\/(?:www\.)?roblox\.com\/games\/(\d+)(?:\/[^?]*)?\?privateserverlinkcode=([a-f0-9]+)/i.exec(normalized);

        const hasShare = Boolean(shareMatch);
        const hasPrivate = Boolean(privateMatch);

        if (hasShare && hasPrivate) return { ok: false, reason: "ambiguous" };
        if (!hasShare && !hasPrivate) return { ok: false, reason: "message-has-no-match" };

        if (hasShare && shareMatch) {
            return { ok: true, type: "share", link: shareMatch[0], code: shareMatch[1] };
        }

        if (hasPrivate && privateMatch) {
            return { ok: true, type: "private", link: privateMatch[0], code: privateMatch[2], placeId: privateMatch[1] };
        }

        return { ok: false, reason: "message-has-no-match" };
    }

    async safelyJoin(link: ServerLink): Promise<IJoinData> {
        const mode = settings.store.verifyMode || "none";
        let verified = false;
        let safe = false;
        let joined = false;
        let message: string | undefined;

        // cria um sublogger específico para esta execução
        const log = this.sublogger("safelyJoin");
        log.debug("Starting join process");
        log.trace(`Mode: ${mode}`, link);

        try {
            if (mode === "before") {
                log.debug("Verifying safety before joining...");
                const { ok, message: msg } = await this.isSafe(link);
                verified = true;

                if (!ok) {
                    log.warn(`Safety check failed before join: ${msg}`);
                    return { joined, verified, safe, message: msg };
                }

                safe = true;
                log.debug("Link marked safe before joining.");
            }

            log.debug("Attempting to join the server...");
            await this.executeJoin(link);
            joined = true;
            log.info("Successfully joined server link.");

            if (mode === "after") {
                log.debug("Performing safety verification after join...");
                const { ok, message: msg } = await this.isSafe(link);
                verified = true;

                if (!ok) {
                    log.warn(`Safety verification failed after join: ${msg}`);
                    return { joined, verified, safe, message: msg };
                }

                safe = true;
                log.debug("Link marked safe after join.");
            }

            log.info(`Completed join. V.Mode=${mode}, Joined=${joined}, Verified=${verified}, Safe=${safe}`);
            return { joined, verified, safe, message };

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error(`Unexpected error: ${errMsg}`);
            message = errMsg;
            return { joined, verified, safe, message };
        }
    }

    async isSafe(link: ServerLink): Promise<{ ok: boolean; message: string; }> {
        if (!link.ok) return { ok: false, message: "Invalid link." };
        let { placeId } = link;

        if (link.type === "private") {
            if (!placeId) return { ok: false, message: "No placeId found in private server link." };
            if (this.isBlocked(placeId)) return { ok: false, message: `PlaceId ${placeId} is blocked.` };
            if (!this.isAllowed(placeId)) return { ok: false, message: `PlaceId ${placeId} is not allowed.` };
            return { ok: true, message: "Private link is allowed." };
        }

        if (link.type === "share") {
            const resolved = await this.resolveShareCode(link.code);
            placeId = resolved.placeId;
            if (!placeId) return { ok: false, message: "Failed to resolve placeId from share link." };
            if (this.isBlocked(placeId)) return { ok: false, message: `PlaceId ${placeId} is blocked.` };
            if (!this.isAllowed(placeId)) return { ok: false, message: `PlaceId ${placeId} is not allowed.` };
            return { ok: true, message: "Share link is allowed." };
        }

        return { ok: false, message: "Unknown link type." };
    }

    private isAllowed(placeId: string): boolean {
        const ids = (settings.store.verifyAllowedPlaceIds || "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);
        if (ids.length === 0) return true;
        return ids.includes(placeId.toLowerCase());
    }

    private isBlocked(placeId: string): boolean {
        const ids = (settings.store.verifyBlockedPlaceIds || "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);
        if (ids.length === 0) return false;
        return ids.includes(placeId.toLowerCase());
    }

    async executeJoin(link: ServerLink) {
        const log = this.sublogger("executeJoin");

        const shouldClose = this.settings.store.closeGameBeforeJoin ?? true;
        const Native = VencordNative.pluginHelpers.RoSniper as {
            openUri: (uri: string) => Promise<void>;
        };

        if (!link.ok) {
            log.warn("Received invalid link:", link);
            return { ok: false, message: "Invalid link." };
        }

        let uri: string | null = null;

        log.debug(`Preparing Roblox URI for link type: ${link.type}`);

        switch (link.type) {
            case "public":
                if (!link.placeId) {
                    log.warn("Missing placeId for public link.");
                    return { ok: false, message: "Missing placeId for public link." };
                }
                uri = `roblox://placeID=${link.placeId}`;
                break;

            case "share":
                uri = `roblox://navigation/share_links?code=${link.code}&type=Server`;
                break;

            case "private":
                if (!link.placeId) {
                    log.warn("Missing placeId for private link.");
                    return { ok: false, message: "Missing placeId for private link." };
                }
                uri = `roblox://placeID=${link.placeId}&linkCode=${link.code}`;
                break;

            default:
                log.error("Unexpected link type:", link);
                return { ok: false, message: "Unexpected link type." };
        }

        if (!uri) {
            log.error("Failed to construct Roblox URI for link:", link);
            return { ok: false, message: "Failed to construct Roblox URI." };
        }

        try {
            if (shouldClose) {
                log.debug("Closing Roblox before joining...");
                await this.closeRoblox();
            }

            log.info(`Launching Roblox with URI: ${uri}`);
            await Native.openUri(uri);

            return { ok: true, message: "Launched." };
        } catch (err: any) {
            const errMsg = err?.message ?? String(err);
            log.error("Failed to open Roblox link:", errMsg);
            return { ok: false, message: `Failed to open Roblox link: ${errMsg}` };
        }
    }


    async closeRoblox(): Promise<RobloxCloseResult> {
        const Native = (VencordNative.pluginHelpers.RoSniper as unknown) as {
            getProcess: (processName: string) => Promise<{ pid: number; name: string; path?: string; }[]>;
            killProcess: (pid: number) => Promise<void>;
        };
        try {
            const processes = await Native.getProcess("RobloxPlayerBeta");
            if (processes.length === 0) return { ok: true, message: "No Roblox process found.", closedCount: 0 };
            await Promise.all(processes.map(p => Native.killProcess(p.pid)));
            return { ok: true, message: `Closed ${processes.length} Roblox processes.`, closedCount: processes.length };
        } catch (err: any) {
            return { ok: false, message: `Failed to close Roblox processes: ${err?.message ?? err}` };
        }
    }

    async resolveShareCode(code: string): Promise<ShareCodeResolutionResult> {
        try {
            const token = settings.store.verifyRoblosecurityToken || "";
            if (!token) return { ok: false, expired: false, message: "Missing .ROBLOSECURITY token." };

            const Native = VencordNative.pluginHelpers.RoSniper as {
                fetchRobloxCsrf: (token: string) => Promise<{ status: number; csrf: string | null; }>;
                resolveRobloxShareLink: (token: string, csrf: string, shareCode: string) => Promise<{ status: number; data: any; }>;
            };

            const { status: csrfStatus, csrf } = await Native.fetchRobloxCsrf(token);
            if (!csrf) return { ok: false, expired: csrfStatus === 401 || csrfStatus === 403, message: "Failed to fetch CSRF token." };

            const { status, data } = await Native.resolveRobloxShareLink(token, csrf, code);
            if (status === 401 || status === 403) return { ok: false, expired: true, message: "Token expired or invalid." };

            const serverData = data?.privateServerInviteData;
            if (!serverData || serverData.status !== "Valid")
                return { ok: false, expired: false, message: `Invalid or expired share link (status: ${serverData?.status ?? "unknown"}).` };

            return { ok: true, expired: false, placeId: serverData.placeId.toString() };
        } catch (e: any) {
            return { ok: false, expired: false, message: e?.message ?? "Unexpected error resolving share code." };
        }
    }
}
