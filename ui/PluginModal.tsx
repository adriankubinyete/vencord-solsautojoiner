/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { Forms, React } from "@webpack/common";

import { ITriggerSettings, settings, TriggerKeywords } from "../settings";
import { cl } from "../utils";
import { recentJoinStore } from "../utils/RecentJoinStore";
import { BaseButton, Line, Note, Section, SectionMessage, SectionTitle, Setting } from "./BasicComponents";
import { JoinedServerList } from "./JoinerServerList";

export function PluginModal({ rootProps }: { rootProps: ModalProps; }) {
    const [joins, setJoins] = React.useState(recentJoinStore.all);
    const reactive = settings.use(["uiShowKeywords"]);

    // Atualiza ao mudar o store (caso o store emita eventos no futuro)
    // React.useEffect(() => {
    //     const interval = setInterval(() => setJoins([...recentJoinStore.all]), 500);
    //     return () => clearInterval(interval);
    // }, []);

    const addFakeJoin = () => {
        const id = Math.random().toString(36).substring(2, 8);
        const fakeJoin = {
            id: Date.now(),
            title: `Test Server ${id.toUpperCase()}`,
            description: "Automatically generated test join",
            iconUrl: "https://cdn.discordapp.com/icons/222078108977594368/a_f6959b1f2cb9.gif",
            authorName: "TestUser",
            authorAvatarUrl: "https://cdn.discordapp.com/embed/avatars/4.png",
            timestamp: Date.now(),
            joinStatus: {
                verified: Math.random() > 0.5,
                joined: Math.random() > 0.5,
                safe: Math.random() > 0.5,
            },
            messageJumpUrl: "https://discord.com/channels/0/0",
        };
        recentJoinStore.all.unshift(fakeJoin);
        setJoins([...recentJoinStore.all]);
    };

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader className={cl("modal-header")}>
                <Forms.FormTitle tag="h2" className={cl("modal-title")}>
                    SolsRadar Settings
                </Forms.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                <SectionTitle>Recent Joins</SectionTitle>
                <JoinedServerList joins={joins} onClose={rootProps.onClose} />

                <Section title="Main Options" defaultOpen>
                    <Setting setting="joinEnabled" customTitle="🎯 Automatic Join" />
                    <Setting setting="notifyEnabled" customTitle="📩 Notifications" />
                </Section>

                <Section title="Triggers" defaultOpen>
                {Object.entries(TriggerKeywords)
                    .map(([triggerKey, trigger], index) => {
                        const keywords = trigger.keywords.join(", ");
                        const displayName = trigger.name; // usa nome pretty como "Glitched"

                        const style = !reactive.uiShowKeywords && index > 0 ? { marginTop: -10 } : undefined;

                        return reactive.uiShowKeywords ? (
                            <>
                                <Setting
                                    setting={triggerKey as keyof ITriggerSettings}
                                    customTitle={displayName}
                                />
                                <Note style={{ marginTop: -20, marginBottom: 8 }}>
                                    {keywords}
                                </Note>
                            </>
                        ) : (
                            <Setting
                                style={style}
                                setting={triggerKey as keyof ITriggerSettings}
                                customTitle={displayName}
                            />
                        );
                    })}
                </ Section>

                <Section title="Join Options" defaultOpen>
                    <Setting setting="joinDisableAfterAutoJoin" customTitle="🟦 Disable auto-join after a successful join" />
                    <Setting setting="notifyDisableAfterAutoJoin" customTitle="🟦 Disable notifications after a successful join" />
                    <Setting setting="joinCloseGameBefore" customTitle="🟦 Close game before joining" />
                    <Note>
                        This makes your join about 1 second slower, but ✨hopefully✨ prevents the game from simply not launching at all. If you want faster joins, disable this and close your game manually before every join.
                    </Note>

                </Section>

                <Section title="Link Verification Options" defaultOpen>
                    <SectionMessage>
                        ⚠️⚠️⚠️⚠️<br />All configurations listed here will only work if you have set a Roblosecurity token to resolve links. To configure a Roblosecurity token, navigate to the plugin's settings page.
                    </SectionMessage>
                    <Line />
                    <Setting setting="verifyMode" customTitle="🟦 Server Link Verification Mode" />
                    <Setting setting="verifyAfterJoinFailFallbackAction" customTitle="🟦 Verification Fail Action" />
                    <Setting setting="verifyAllowedPlaceIds" customTitle="✅ Allowed Place IDs" />
                    <Setting setting="verifyBlockedPlaceIds" customTitle="🚫 Blocked Place IDs" />
                </Section>

                <Section title="UI Options" defaultOpen>
                    <Setting setting="uiShowChatBarIcon" customTitle="🟦 Show Chat Bar Button" />
                    <Setting
                        setting="uiShortcutAction"
                        customTitle="🟦 Chat Bar Button Shortcut Action"
                    />
                    <Setting setting="uiShowKeywords" customTitle="🟦 Show trigger keywords" />
                </Section>

                <Section title="Other Options" defaultOpen>
                    <Setting setting="monitorNavigateToChannelsOnStartup" customTitle="🟦 Load Channels on Startup" />
                    <Setting setting="monitorGreedyMode" customTitle="🟦 Greedy Mode" />
                    <Setting setting="monitorGreedyExceptionList" customTitle="🟦 Greedy Mode Exception List" />
                </Section>

                <Section title="Developer Options" defaultOpen>
                    <Setting setting="loggingLevel" customTitle="Console Logging Level" />
                    <Setting setting="_dev_verification_fail_fallback_delay_ms" customTitle="Verification Fail Fallback Delay (ms)" />
                    <BaseButton onClick={addFakeJoin}>➕ Add Fake Join</BaseButton>
                </Section>

            </ModalContent>
        </ModalRoot>
    );
}
