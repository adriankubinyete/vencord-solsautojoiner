/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { CheckedTextInput } from "@components/CheckedTextInput";
import { FormSwitch } from "@components/FormSwitch";
import { Margins } from "@components/margins";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { OptionType } from "@utils/types";
import { ChannelRouter, ChannelStore, Forms, SearchableSelect, SelectedChannelStore, Toasts } from "@webpack/common";

import { settings, TriggerKeywords, TriggerKeywordSettings } from "./settings";
import { cl, getSettingMeta } from "./utils";

function Note({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    const defaultStyle: React.CSSProperties = {
        borderLeft: "2px solid #888",
        paddingLeft: 8,
        color: "#aaa",
        fontSize: 13,
        lineHeight: 1.4,
        marginTop: -15,
        marginBottom: 4,
    };

    return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

function SectionHorizontalLine() {
    return (
        <hr
            style={{
                border: "none",
                borderTop: "1px solid #555",
                marginTop: 12,
                marginBottom: 12,
                width: "100%",
            }}
        />
    );
}

function SectionMessage({ children }: { children: React.ReactNode; }) {
    return (
        <div style={{
            color: "#aaa",
            fontSize: 13,
            margin: "8px 0",
            lineHeight: 1.4,
        }}>
            {children}
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode; }) {
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

type SettingProps<K extends keyof typeof settings.def> = {
    setting: K;
    customTitle?: string;
    className?: string;
    style?: React.CSSProperties;
};

export function Setting<K extends keyof typeof settings.def>({
    setting,
    customTitle,
    className,
    style,
}: SettingProps<K>) {
    const meta = getSettingMeta(setting);
    const reactive = settings.use([setting]);
    const value = reactive[setting];

    const title =
        customTitle ?? meta.key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

    let content: React.ReactNode;

    switch (meta.type) {
        case OptionType.BOOLEAN:
            content = (
                <FormSwitch
                    title={title}
                    description={meta.description ?? ""}
                    value={Boolean(value)}
                    onChange={v => settings.store[setting] = Boolean(v) as any}
                    hideBorder
                />
            );
            break;

        // case OptionType.STRING:
        //     content = (
        //         <>
        //             <div style={{ fontWeight: 500, color: "#ccc", marginBottom: 8 }}>{title}</div>
        //             <CheckedTextInput
        //                 value={value !== undefined ? String(value) : ""}
        //                 onChange={v => settings.store[setting] = String(v) as never}
        //                 validate={() => true}
        //             />
        //             {meta.description && (
        //                 <div style={{ marginTop: 6, color: "#ccc", fontSize: 12 }}>
        //                     {meta.description}
        //                 </div>
        //             )}
        //         </>
        //     );
        //     break;
        case OptionType.STRING: {
            const state = settings.use([setting]);
            const currentValue = state[setting] ?? "" as any;

            content = (
                <>
                    <div style={{ fontWeight: 500, color: "#ccc", marginBottom: 8 }}>{title}</div>
                    <CheckedTextInput
                        value={currentValue}
                        onChange={v => (settings.store[setting] = String(v) as never)}
                        validate={() => true}
                    />
                    {meta.description && (
                        <div style={{ marginTop: 6, color: "#ccc", fontSize: 12 }}>
                            {meta.description}
                        </div>
                    )}
                </>
            );
            break;
        }

        case OptionType.NUMBER:
            content = (
                <>
                    <div style={{ fontWeight: 500, color: "#ccc", marginBottom: 8 }}>{title}</div>
                    <CheckedTextInput
                        value={value !== undefined ? String(value) : ""}
                        onChange={v => settings.store[setting] = Number(Number(v)) as any}
                        validate={v => (isNaN(Number(v)) ? "Invalid number" : true)}
                    />
                    {meta.description && (
                        <div style={{ marginTop: 6, color: "#ccc", fontSize: 12 }}>
                            {meta.description}
                        </div>
                    )}
                </>
            );
            break;

        case OptionType.SELECT: {
            const options = meta.options?.map(o => ({ value: o.value, label: o.label })) ?? [];
            content = (
                <>
                    <div style={{ fontWeight: 500, color: "#ccc", marginBottom: 8 }}>{title}</div>
                    {meta.description && (
                        <div style={{ marginBottom: 8, color: "#ccc", fontSize: 12 }}>
                            {meta.description}
                        </div>
                    )}
                    <SearchableSelect
                        options={options}
                        value={options.find(o => o.value === value)}
                        placeholder="Select an option"
                        maxVisibleItems={5}
                        closeOnSelect={true}
                        onChange={v => settings.store[setting] = v}
                    />
                </>
            );
            break;
        }

        default:
            content = (
                <div style={{ color: "red" }}>
                    Unsupported setting type for {meta.key}: {meta.type}
                </div>
            );
    }

    return (
        <div
            className={className ?? Margins.bottom20}
            style={{ ...(style || {}) }}>
            {content}
        </div>
    );
}

// -------------------------------

function ForceLoadChannelsButton() {
    const handleClick = async () => {
        try {
            const monitoredCsv = settings.store.monitorChannelList ?? "";
            const monitored = monitoredCsv.split(",").map(s => s.trim()).filter(Boolean);

            if (!Array.isArray(monitored) || monitored.length === 0) {
                const toast = Toasts.create("No monitored channels found.", Toasts.Type.MESSAGE, {
                    duration: 1000,
                    position: Toasts.Position.BOTTOM,
                });
                Toasts.show(toast);
                return;
            }

            const currentChannel = SelectedChannelStore.getChannelId();
            let successCount = 0;

            for (const channelId of monitored) {
                try {
                    const channel = ChannelStore.getChannel(channelId);
                    if (!channel) continue;

                    console.log(`[SolsAutoJoiner] Loading channel via navigation: ${channelId}`);
                    ChannelRouter.transitionToChannel(channelId);

                    // Dá um tempo pra o Discord carregar o canal
                    await new Promise(res => setTimeout(res, 100));

                    successCount++;
                } catch (err) {
                    console.warn(`[SolsAutoJoiner] Failed to load channel ${channelId}:`, err);
                }
            }

            // Volta pro canal original
            if (currentChannel) {
                ChannelRouter.transitionToChannel(currentChannel);
            }

            const message =
                successCount === 0
                    ? "No monitored channels loaded."
                    : `Loaded ${successCount} monitored channel${successCount !== 1 ? "s" : ""}.`;

            const toastType = successCount > 0 ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE;

            const toast = Toasts.create(message, toastType, {
                duration: 1000,
                position: Toasts.Position.BOTTOM,
            });
            Toasts.show(toast);
        } catch (err) {
            console.error("[SolsAutoJoiner] Force-load failed:", err);
            const toast = Toasts.create("Error while loading channels.", Toasts.Type.FAILURE, {
                duration: 2000,
                position: Toasts.Position.BOTTOM,
            });
            Toasts.show(toast);
        }
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <Button
                onClick={handleClick}
                style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 8,
                }}
            >
                Force-load Monitored Channels
            </Button>
            <div style={{ color: "#ccc", fontSize: 12 }}>
                Navigates to all monitored channels sequentially to force-load their data, then returns to the original channel.
            </div>
        </div>
    );
}

function CloseRobloxButton() {
    const handleClick = async () => {
        try {
            const Native = (VencordNative.pluginHelpers.SolsAutoJoiner as unknown) as {
                getRobloxProcess: () => Promise<void>;
                closeRoblox: () => Promise<void>;
            };
            const proc = await Native.getRobloxProcess() as any;

            if (!proc) {
                const toast = Toasts.create("Roblox is not running.", Toasts.Type.MESSAGE, {
                    duration: 1000,
                    position: Toasts.Position.BOTTOM,
                });
                Toasts.show(toast);
                return;
            }

            await Native.closeRoblox();

            const toast = Toasts.create(
                `Closed Roblox process (${proc.name} - PID ${proc.pid}).`,
                Toasts.Type.SUCCESS,
                {
                    duration: 1500,
                    position: Toasts.Position.BOTTOM,
                }
            );
            Toasts.show(toast);
        } catch (err) {
            const toast = Toasts.create("Failed to close Roblox.", Toasts.Type.FAILURE, {
                duration: 2000,
                position: Toasts.Position.BOTTOM,
            });
            Toasts.show(toast);
        }
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <Button
                onClick={handleClick}
                style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 8,
                    backgroundColor: "#e5534b",
                    color: "#fff",
                }}
            >
                Close Roblox
            </Button>
            <div style={{ color: "#ccc", fontSize: 12 }}>
                Attempts to gracefully close the Roblox process if it’s running. Works only on Windows.
            </div>
        </div>
    );
}

function GetRobloxButton() {
    const handleClick = async () => {
        try {
            const Native = (VencordNative.pluginHelpers.SolsAutoJoiner as unknown) as {
                getRobloxProcess: () => Promise<void>;
            };
            const proc = await Native.getRobloxProcess() as any;

            if (!proc) {
                Toasts.show(
                    Toasts.create("Roblox is not running.", Toasts.Type.MESSAGE, {
                        duration: 1000,
                        position: Toasts.Position.BOTTOM,
                    })
                );
                return;
            }

            Toasts.show(
                Toasts.create(
                    `Roblox is running (${proc.name} - PID ${proc.pid})`,
                    Toasts.Type.SUCCESS,
                    {
                        duration: 1500,
                        position: Toasts.Position.BOTTOM,
                    }
                )
            );
        } catch (err) {
            Toasts.show(
                Toasts.create("Failed to get Roblox process.", Toasts.Type.FAILURE, {
                    duration: 2000,
                    position: Toasts.Position.BOTTOM,
                })
            );
        }
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <Button
                onClick={handleClick}
                style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 8,
                    backgroundColor: "#4c8ae8",
                    color: "#fff",
                }}
            >
                Get Roblox
            </Button>
            <div style={{ color: "#ccc", fontSize: 12 }}>
                Checks if the Roblox process is running and shows basic info.
            </div>
        </div>
    );
}

function DebugButton() {
    const handleClick = async () => {
        try {
            console.log("a");
        } catch (err) {
            Toasts.show(
                Toasts.create("Failed to log...?", Toasts.Type.FAILURE, {
                    duration: 2000,
                    position: Toasts.Position.BOTTOM,
                })
            );
        }
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <Button
                onClick={handleClick}
                style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 8,
                    backgroundColor: "#4c8ae8",
                    color: "#fff",
                }}
            >
                Debug
            </Button>
            <div style={{ color: "#ccc", fontSize: 12 }}>
                Debug button which does something.
            </div>
        </div>
    );
}


// -------------------------------

export function JoinerModal({ rootProps }: { rootProps: ModalProps; }) {
    // make uiShowKeywords dynamic
    const reactive = settings.use(["uiShowKeywords"]);
    return (
        <ModalRoot {...rootProps}>
            <ModalHeader className={cl("modal-header")}>
                <Forms.FormTitle tag="h2" className={cl("modal-title")}>
                    SolsAutoJoiner Settings
                </Forms.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                <SectionTitle>On link detection</SectionTitle>
                <Setting setting="joinEnabled" />
                <Setting setting="notifyEnabled" />

                <SectionTitle>Triggers</SectionTitle>
                {(Object.keys(TriggerKeywords) as (keyof TriggerKeywordSettings)[]).map((triggerKey, index) => {
                    const keywords = TriggerKeywords[triggerKey].join(", ");

                    const style = !reactive.uiShowKeywords && index > 0 ? { marginTop: -10 } : undefined;

                    return reactive.uiShowKeywords ? (
                        <>
                            <Setting
                                setting={triggerKey}
                                customTitle={triggerKey}
                            />
                            <Note style={{ marginTop: -20, marginBottom: 8 }}>
                                {keywords}
                            </Note>
                        </>
                    ) : (
                        <Setting
                            style={style}
                            setting={triggerKey}
                            customTitle={triggerKey}
                        />
                    );
                })}
                <SectionHorizontalLine />
                <Setting setting="uiShowKeywords" />

                <SectionTitle>Pre-Join Behavior</SectionTitle>
                <Setting setting="joinCloseGameBefore" />
                <Note>
                    This makes your join about 1 second slower, but ✨hopefully✨ prevents the game from simply not launching at all. If you want faster joins, disable this and close your game manually before every join.
                </Note>

                <SectionTitle>Post-Join Behavior</SectionTitle>
                <Setting setting="joinDisableAfterAutoJoin" />
                <Setting setting="notifyDisableAfterAutoJoin" />

                <SectionTitle>Link Verification</SectionTitle>
                <SectionMessage>All configurations listed here will only work if you have set a Roblosecurity token to resolve links. To configure a Roblosecurity token, navigate to the plugin's settings page.</SectionMessage>
                <SectionHorizontalLine />
                <Setting setting="verifyMode" />
                <Note>Requires a Roblosecurity token set. Otherwise, does nothing.</Note>
                <Setting setting="verifyAllowedPlaceIds" />
                <Setting setting="verifyBlockedPlaceIds" />
                <Setting setting="monitorBlockUnsafeServerMessageAuthors" />
                <Setting setting="verifyAfterJoinFailFallbackAction" />
                <Setting setting="verifyAfterJoinFailFallbackDelayMs" />

                <SectionTitle>Monitored Channels</SectionTitle>
                <Setting setting="monitorChannelList" />
                <Setting setting="monitorBlockedUserList" />
                <ForceLoadChannelsButton />

                <SectionTitle>Other Settings</SectionTitle>
                <Setting setting="uiShortcutAction" />


                <SectionTitle>Developer Settings</SectionTitle>
                <Setting setting="_dev_logging_level" />
                <Setting setting="_dev_dedupe_link_cooldown_ms" />
                {/* <Setting setting="_dev_verification_fail_fallback_delay_ms" /> */}
                <SectionHorizontalLine />
                <DebugButton />
                <GetRobloxButton />
                <CloseRobloxButton />

            </ModalContent>

        </ModalRoot>
    );
}
