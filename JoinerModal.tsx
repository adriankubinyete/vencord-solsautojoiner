/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FormSwitch } from "@components/FormSwitch";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { Forms } from "@webpack/common";

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

function DisableAfterSuccessToggle() {
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
                <DisableAfterSuccessToggle />

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
            </ModalContent>
        </ModalRoot>
    );
}
