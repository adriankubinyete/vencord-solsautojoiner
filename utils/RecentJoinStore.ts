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
    messageJumpUrl?: string;
    joinStatus?: {
        joined: boolean;
        verified: boolean;
        safe: boolean | undefined;
    };
}

class RecentJoinStore {
    private _recentJoins: RecentJoin[] = [];

    constructor() {}

    get all() {
        return this._recentJoins;
    }

    save() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this._recentJoins));
        console.log(`[RoSniper] Saved ${this._recentJoins.length} recent joins.`);
    }

    load() {
        this._recentJoins =
            JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]") ?? [];
        console.log(`[RoSniper] Loaded ${this._recentJoins.length} recent joins.`);
    }

    /**
     * Add a new join.
     * Returns: the created entry (or id if preferred)
     */
    add(join: Omit<RecentJoin, "id" | "timestamp">): RecentJoin {
        const now = Date.now();
        const entry: RecentJoin = { id: now, timestamp: now, ...join };

        this._recentJoins.unshift(entry);

        if (this._recentJoins.length > 10) {
            this._recentJoins.pop();
        }

        return entry; // or entry.id if you prefer
    }

    /**
     * Update an existing join by ID.
     */
    update(id: number, data: Partial<Omit<RecentJoin, "id" | "timestamp">>): RecentJoin | null {
        const idx = this._recentJoins.findIndex(j => j.id === id);
        if (idx === -1) return null;

        const updated = {
            ...this._recentJoins[idx],
            ...data,
        };

        this._recentJoins[idx] = updated;
        return updated;
    }

    /**
     * Delete a join by ID.
     */
    delete(id: number): boolean {
        const before = this._recentJoins.length;
        this._recentJoins = this._recentJoins.filter(j => j.id !== id);
        return this._recentJoins.length !== before;
    }

    clear() {
        this._recentJoins = [];
    }
}

export const recentJoinStore = new RecentJoinStore();
