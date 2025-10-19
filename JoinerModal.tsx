/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { ChannelStore, Forms, MessageStore, Toasts } from "@webpack/common";

import { BiomesConfig, settings } from "./settings";

// Componente para título de seção decorado com linha
function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            margin: "24px 0 12px",
        }}>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #555", marginRight: 12 }} />
            <span style={{ whiteSpace: "nowrap", color: "#ccc", fontWeight: 500 }}>{children}</span>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #555", marginLeft: 12 }} />
        </div>
    );
}

function AutoJoinToggle() {
    const { AutoJoin } = settings.use(["AutoJoin"]);

    return (
        <div style={{ marginBottom: 24 }}>
            <FormSwitch
                title="Enable AutoJoin"
                description="Automatically join valid Roblox share links detected."
                value={AutoJoin}
                onChange={v => settings.store.AutoJoin = v}
                hideBorder
            />
        </div>
    );
}

function NotificationsToggle() {
    const { Notifications } = settings.use(["Notifications"]);

    return (
        <div style={{ marginBottom: 24 }}>
            <FormSwitch
                title="Enable Notifications"
                description="Send a desktop notification when a valid Roblox share link is detected. You can click the notification to join."
                value={Notifications}
                onChange={v => settings.store.Notifications = v}
                hideBorder
            />
        </div>
    );
}

function DisableAutoJoinAfterSuccessToggle() {
    const { disableAutoJoinAfterSuccess } = settings.use(["disableAutoJoinAfterSuccess"]);

    return (
        <div style={{ marginBottom: 24 }}>
            <FormSwitch
                title="Disable AutoJoin After Success"
                description="Automatically disable AutoJoin after a successful join to avoid joining another link while in-game."
                value={disableAutoJoinAfterSuccess}
                onChange={v => settings.store.disableAutoJoinAfterSuccess = v}
                hideBorder
            />
        </div>
    );
}

function DisableNotificationsAfterSuccessToggle() {
    const { disableNotificationsAfterSuccess } = settings.use(["disableNotificationsAfterSuccess"]);

    return (
        <div style={{ marginBottom: 24 }}>
            <FormSwitch
                title="Disable Notifications After Success"
                description="Disable Notifications after a successful join. Only applies to automatic joins, not manual clicks on notifications."
                value={disableNotificationsAfterSuccess}
                onChange={v => settings.store.disableNotificationsAfterSuccess = v}
                hideBorder
            />
        </div>
    );
}

function ShiftClickAlsoToggleNotificationsToggle() {
    const { shiftClickAlsoToggleNotifications } = settings.use(["shiftClickAlsoToggleNotifications"]);

    return (
        <div style={{ marginBottom: 24 }}>
            <FormSwitch
                title="Shift-click also toggles Notifications"
                description="When shift-clicking this menu icon in the chat bar, also toggle Notifications together with AutoJoin."
                value={shiftClickAlsoToggleNotifications}
                onChange={v => settings.store.shiftClickAlsoToggleNotifications = v}
                hideBorder
            />
        </div>
    );
}

function ForceLoadChannelsButton() {
    const handleClick = async () => {
        try {
            const monitoredCsv = settings.store.MonitoredChannels ?? "";
            const monitored = monitoredCsv.split(",").map(s => s.trim()).filter(Boolean);

            if (!Array.isArray(monitored) || monitored.length === 0) {
                const toast = Toasts.create("No monitored channels found.", Toasts.Type.MESSAGE, {
                    duration: 1000,
                    position: Toasts.Position.BOTTOM,
                });
                Toasts.show(toast);
                return;
            }

            let successCount = 0;

            for (const channelId of monitored) {
                try {
                    const channel = ChannelStore.getChannel(channelId);
                    if (!channel) continue;

                    // Try the modern silent subscribe APIs used by clients
                    if (MessageStore?.startChannel) {
                        MessageStore.startChannel(channelId);
                    } else if (MessageStore?.subscribeToChannel) {
                        MessageStore.subscribeToChannel(channelId);
                    } else {
                        // Fallback: attempt a no-op dispatch that some clients accept as "start listening"
                        // (keep this minimal to avoid loading history)
                        try {
                            // @ts-ignore - some clients expose a channel subscription action
                            const ChannelActions = await import("@webpack/channels");
                            if (ChannelActions?.joinChannel) ChannelActions.joinChannel(channelId);
                        } catch {
                            // ignore fallback errors
                        }
                    }

                    successCount++;
                } catch (err) {
                    console.warn(`[SolsAutoJoiner] Failed to subscribe to ${channelId}:`, err);
                }
            }

            const message =
                successCount === 0
                    ? "No monitored channels subscribed."
                    : `Subscribed to ${successCount} monitored channel${successCount !== 1 ? "s" : ""}.`;

            const toastType = successCount > 0 ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE;

            const toast = Toasts.create(message, toastType, {
                duration: 1000,
                position: Toasts.Position.BOTTOM,
            });
            Toasts.show(toast);
        } catch (err) {
            console.error("[SolsAutoJoiner] Force-load failed:", err);
            const toast = Toasts.create("Error while subscribing to channels.", Toasts.Type.FAILURE, {
                duration: 2000,
                position: Toasts.Position.BOTTOM,
            });
            Toasts.show(toast);
        }
    };

    return (
        <div style={{ marginBottom: 24 }}>
            {/* Use a plain Button; adjust styles via style/className since Colors/Sizes props aren't present */}
            <Button
                onClick={handleClick}
                style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Force-load Monitored Channels
            </Button>

            <Forms.FormText style={{ marginTop: 6, color: "#ccc" }}>
                Force-subscribes to all monitored channels so new messages are received automatically.
            </Forms.FormText>
        </div>
    );
}

function BiomeToggle({ biomeKey, label, description }: { biomeKey: keyof BiomesConfig; label: string; description: string; }) {
    const { [biomeKey]: value } = settings.use([biomeKey]);

    return (
        <div style={{ marginBottom: 12 }}>
            <FormSwitch
                title={label}
                description={description}
                value={value}
                onChange={v => settings.store[biomeKey] = v}
                hideBorder
            />
        </div>
    );
}

export function JoinerModal({ rootProps }: { rootProps: ModalProps; }) {
    return (
        <ModalRoot {...rootProps}>
            <ModalHeader>
                <Forms.FormTitle tag="h2">
                    SolsAutoJoiner Settings
                </Forms.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent>
                {/* Seção AutoJoin */}
                <SectionTitle>On link detection</SectionTitle>
                <AutoJoinToggle />
                <NotificationsToggle />

                {/* Seção Disable After Success */}
                <SectionTitle>Post-Join Behavior</SectionTitle>
                <DisableAutoJoinAfterSuccessToggle />
                <DisableNotificationsAfterSuccessToggle />

                {/* Seção Biomes */}
                <SectionTitle>Biomes</SectionTitle>

                <BiomeToggle biomeKey="GLITCHED" label="GLITCHED" description="" />
                <BiomeToggle biomeKey="DREAMSPACE" label="DREAMSPACE" description="" />
                <BiomeToggle biomeKey="BLOODRAIN" label="BLOODRAIN" description="" />
                <BiomeToggle biomeKey="PUMPKINMOON" label="PUMPKINMOON" description="" />
                <BiomeToggle biomeKey="GRAVEYARD" label="GRAVEYARD" description="" />
                <BiomeToggle biomeKey="NULL" label="NULL" description="" />
                <BiomeToggle biomeKey="CORRUPTION" label="CORRUPTION" description="" />
                <BiomeToggle biomeKey="HELL" label="HELL" description="" />
                <BiomeToggle biomeKey="STARFALL" label="STARFALL" description="" />
                <BiomeToggle biomeKey="SANDSTORM" label="SANDSTORM" description="" />
                <BiomeToggle biomeKey="SNOWY" label="SNOWY" description=""/>
                <BiomeToggle biomeKey="WINDY" label="WINDY" description="" />
                <BiomeToggle biomeKey="RAINY" label="RAINY" description="" />

                {/* Seção Other Settings */}
                <SectionTitle>Other Settings</SectionTitle>
                <ShiftClickAlsoToggleNotificationsToggle />
                <ForceLoadChannelsButton />
            </ModalContent>
        </ModalRoot>
    );
}
