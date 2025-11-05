/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CheckedTextInput } from "@components/CheckedTextInput";
import { FormSwitch } from "@components/FormSwitch";
import { Margins } from "@components/margins";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { OptionType } from "@utils/types";
import { Button, ChannelRouter, ChannelStore, Forms, NavigationRouter, React, SearchableSelect, SelectedChannelStore, Toasts } from "@webpack/common";

import { ITriggerSettings, recentJoinsStore, settings, TriggerKeywords } from "./settings";
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

function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    if (diff < minute) return "Just now";

    const units = [
        { label: "year", ms: year },
        { label: "month", ms: month },
        { label: "day", ms: day },
        { label: "hour", ms: hour },
        { label: "minute", ms: minute },
    ];

    for (const { label, ms } of units) {
        if (diff >= ms) {
            const value = Math.floor(diff / ms);
            return `${value} ${label}${value !== 1 ? "s" : ""} ago`;
        }
    }

    return "Just now";
}

type JoinedServerCardProps = {
    author: string;
    authorAvatar?: string; // novo: avatar do author (opcional)
    image?: string;
    title: string;
    description: string;
    timeAgo: string;
    safety?: boolean;
    onClick?: () => void;
};

export function JoinedServerCard({
    author,
    authorAvatar,
    image,
    title,
    description,
    timeAgo,
    safety,
    onClick,
}: JoinedServerCardProps) {
    const avatarUrl =
        authorAvatar || "https://discord.com/assets/881ed827548f38c6.svg"; // fallback interrogação
    const fallbackImage =
        "https://raw.githubusercontent.com/vexthecoder/OysterDetector/refs/heads/main/assets/unknown_biome.png";

    // Estilos base
    const isUnsafe = safety === false;
    const baseBackground = isUnsafe ? "rgba(237, 66, 69, 0.1)" : "rgba(255,255,255,0.08)";
    const baseBorder = isUnsafe ? "1px solid rgba(237, 66, 69, 0.4)" : "none";
    const hoverBackground = isUnsafe ? "rgba(237, 66, 69, 0.15)" : "rgba(255,255,255,0.12)";
    const hoverBorder = isUnsafe ? "1px solid rgba(237, 66, 69, 0.6)" : baseBorder;

    return (
        <div
            onClick={onClick}
            style={{
                display: "flex",
                flexDirection: "column",
                background: baseBackground,
                border: baseBorder,
                borderRadius: 8,
                marginBottom: 10,
                cursor: onClick ? "pointer" : "default",
                transition: "background 0.25s ease, transform 0.2s ease, border-color 0.25s ease",
                overflow: "hidden",
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = hoverBackground;
                (e.currentTarget as HTMLDivElement).style.borderColor = isUnsafe ? "rgba(237, 66, 69, 0.6)" : "inherit";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = baseBackground;
                (e.currentTarget as HTMLDivElement).style.borderColor = isUnsafe ? "rgba(237, 66, 69, 0.4)" : "inherit";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            }}
        >
            {/* Seção de conteúdo: textos à esquerda, imagem à direita */}
            <div style={{ padding: "12px", display: "flex", flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                {/* Textos à esquerda */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div
                        style={{
                            fontWeight: 600,
                            color: "#fff",
                            fontSize: 15,
                        }}
                    >
                        {title}
                    </div>

                    {description && (
                        <div style={{ fontSize: 13, color: "#ccc" }}>{description}</div>
                    )}
                </div>

                {/* Imagem thumbnail à direita */}
                <img
                    src={image || fallbackImage}
                    alt={title}
                    onError={e => {
                        (e.currentTarget as HTMLImageElement).src = fallbackImage;
                    }}
                    style={{
                        width: 80,
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 6,
                        flexShrink: 0, // Evita que a imagem encolha
                    }}
                />
            </div>

            {/* Linha inferior (abaixo da imagem e do conteúdo) */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px 10px",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    fontSize: 12,
                    color: "#999",
                    gap: 8,
                }}
            >
                {/* Author info à esquerda (autor truncado, tempo sempre visível) */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflow: "hidden",
                        maxWidth: "70%", // controla quanto espaço essa parte usa
                    }}
                >
                    <img
                        src={avatarUrl}
                        alt={`${author}'s avatar`}
                        onError={e => {
                            (e.currentTarget as HTMLImageElement).src = fallbackImage;
                        }}
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid rgba(255,255,255,0.1)",
                            flexShrink: 0,
                        }}
                    />

                    {/* Texto principal */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            minWidth: 0, // importante para truncamento flex funcionar
                        }}
                    >
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                                maxWidth: 130, // <-- controla truncamento do autor
                            }}
                        >
                            {author}
                        </span>
                        <span style={{ flexShrink: 0 }}>• {timeAgo}</span>
                    </div>
                </div>

                {/* Safe/Fake à direita */}
                <span
                    style={{
                        color:
                            safety === undefined
                                ? "#faa61a" // amarelo para "Not verified"
                                : safety
                                    ? "#3ba55c" // verde para Safe
                                    : "#ed4245", // vermelho para Fake
                        fontWeight: "bold",
                        flexShrink: 0,
                    }}
                >
                    {safety === undefined
                        ? "⚠️ Not verified"
                        : safety
                            ? "✅ Safe"
                            : "❌ Fake"}
                </span>
            </div>
        </div>
    );
}

export function RecentServersListButton({ onClose }: { onClose?: () => void; }) {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const toggleMenu = () => setMenuOpen(prev => !prev);

    const { recentJoins } = recentJoinsStore;

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                width: "100%",
                transition: "all 0.3s ease",
            }}
        >
            {/* Botão principal */}
            <Button
                width={"100%"}
                size={Button.Sizes.SMALL}
                onClick={toggleMenu}
            >
                {menuOpen ? "Hide recent joins ▲" : "Show recent joins ▼"}
            </Button>

            {/* Menu expansível abaixo do botão */}
            <div
                style={{
                    marginTop: menuOpen ? 10 : 0,
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    padding: menuOpen ? 10 : 0,
                    overflowY: menuOpen ? "auto" : "hidden",
                    overflowX: "hidden",
                    opacity: menuOpen ? 1 : 0,
                    maxHeight: menuOpen ? 300 : 0,
                    transform: menuOpen ? "translateY(0)" : "translateY(-6px)",
                    transition:
                        "max-height 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), " +
                        "opacity 0.3s ease, " +
                        "padding 0.3s ease, " +
                        "margin-top 0.3s ease, " +
                        "transform 0.35s ease-out",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.2) transparent",
                }}
            >
                <Forms.FormTitle tag="h4" style={{ marginBottom: 6 }}>
                    Recently Joined Servers ({recentJoins.length})
                </Forms.FormTitle>

                {recentJoins.length === 0 ? (
                    <div style={{ color: "#aaa", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                        No recent joins yet.
                    </div>
                ) : (
                    recentJoins.map((srv, index) => (
                        <div
                            key={srv.id}
                            style={{
                                transform: menuOpen
                                    ? "translateY(0)"
                                    : "translateY(10px)",
                                opacity: menuOpen ? 1 : 0,
                                transitionDelay: menuOpen
                                    ? `${index * 0.05}s`
                                    : "0s",
                                transition:
                                    "transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease",
                            }}
                        >
                            <JoinedServerCard
                                title={srv.title}
                                author={srv.author.name}
                                authorAvatar={srv.author.avatar}
                                image={srv.image} // servir https://raw.githubusercontent.com/vexthecoder/OysterDetector/refs/heads/main/assets/unknown_biome.png se tiver quebrado
                                description={srv.description}
                                timeAgo={formatTimeAgo(srv.timestamp)}
                                safety={srv.link.wasVerified ? srv.link.isSafe : undefined}
                                onClick={() => {
                                    setMenuOpen(false); // fecha o menu expansível primeiro
                                    const channelId = srv.channel.id;
                                    const messageId = srv.message.id;
                                    const guildId = srv.guild.id;
                                    NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${messageId}`);
                                    onClose?.(); // fecha o modal
                                }}
                            />
                        </div>
                    ))
                )}
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
                <RecentServersListButton onClose={rootProps.onClose} />
                <SectionTitle>On link detection</SectionTitle>
                <Setting setting="joinEnabled" />
                <Setting setting="notifyEnabled" />

                <SectionTitle>Triggers</SectionTitle>
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
