/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { localStorage } from "@utils/localStorage";

const LOCAL_STORAGE_KEY = "solsRadarRecentJoins";

export interface RecentJoin {
    id: number;
    timestamp: number;
    title: string;
    description: string;
    iconUrl?: string;
    authorName?: string;
    authorAvatarUrl?: string;
    messageJumpUrl?: string; // https://discord.com/channels/{guildId}/{channelId}/{messageId}
    joinStatus?: {
        joined: boolean;
        verified: boolean;
        safe: boolean | undefined;
    }
}

class RecentJoinStore {
    private _recentJoins: RecentJoin[] = [];

    constructor() {
        // In-memory only, no persistence
    }

    get all() {
        return this._recentJoins;
    }

    save() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this._recentJoins));
        console.log(`[RoSniper] Saved ${this._recentJoins.length} recent joins.`);
    }

    load() {
        this._recentJoins = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        console.log(`[RoSniper] Loaded ${this._recentJoins.length} recent joins.`);
    }

    add(join: Omit<RecentJoin, "id" | "timestamp">) {
        const now = Date.now();
        const entry = { id: now, timestamp: now, ...join };
        this._recentJoins.unshift(entry);

        if (this._recentJoins.length > 10) this._recentJoins.pop();
    }

    clear() {
        this._recentJoins = [];
    }
}

// Singleton export
export const recentJoinStore = new RecentJoinStore();
