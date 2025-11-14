/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, NavigationRouter, React, Toasts } from "@webpack/common";

import { formatTimeAgo, showToast } from "../utils";
import { recentJoinStore } from "../utils/RecentJoinStore";

type JoinedServer = {
    id?: number;
    timestamp?: number;
    title?: string;
    description?: string;
    iconUrl?: string;
    authorAvatarUrl?: string;
    authorName?: string;
    messageJumpUrl?: string;
    joinStatus?: {
        joined: boolean;
        verified: boolean;
        safe: boolean | undefined;
    };
};

type JoinedServerListProps = {
    joins: JoinedServer[];
    onClose?: () => void;
};

export function JoinedServerList({ joins, onClose }: JoinedServerListProps) {
    const [expanded, setExpanded] = React.useState(false);
    const [localJoins, setLocalJoins] = React.useState(joins || []); // Estado local pra sync
    const toggleExpanded = () => setExpanded(prev => !prev);
    const count = localJoins.length;

    // Sync com prop inicial (caso venha de fora)
    React.useEffect(() => {
        setLocalJoins(joins || []);
    }, [joins]);

    // Opcional: Poll simples pra checar store a cada 1s (se add() for chamado em outro lugar)
    // Mas pra clear, vamos forçar no handler abaixo
    React.useEffect(() => {
        const interval = setInterval(() => {
            const current = recentJoinStore.all;
            if (JSON.stringify(current) !== JSON.stringify(localJoins)) {
                setLocalJoins(current);
            }
        }, 1000); // 1s é leve, ajusta se quiser

        return () => clearInterval(interval);
    }, [localJoins]);

    const handleCardClick = (join: JoinedServer) => {
        try {
            if (!join.messageJumpUrl) {
                showToast("Message jump URL not found!", Toasts.Type.FAILURE);
                return;
            }
            NavigationRouter.transitionTo(join.messageJumpUrl.split("discord.com")[1]);
            showToast("Jumped to message!", Toasts.Type.FORWARD);
            setExpanded(false);
            onClose?.();
        } catch (err) {
            showToast("Something went wrong!", Toasts.Type.FAILURE);
            console.error("[SolsRadar] Failed to jump to message:", err);
        }
    };

    const handleClearJoins = () => {
        recentJoinStore.clear();
        setLocalJoins([]); // FORÇA o update imediato no estado local
        showToast("Cleared recent joins!", Toasts.Type.SUCCESS);
    };

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
                width="100%"
                size={Button.Sizes.SMALL}
                onClick={toggleExpanded}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontWeight: 500,
                    transition: "background 0.2s ease",
                }}
            >
                <span>{expanded ? `Hide recents (${count})` : `Show recents (${count})`}</span>
                <span
                    style={{
                        display: "inline-block",
                        transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
                        transition: "transform 0.45s ease",
                        opacity: 0.7,
                        fontSize: 20,
                    }}
                >
                    ▴
                </span>
            </Button>


            {/* Conteúdo expansível */}
            <div
                style={{
                    marginTop: expanded ? 10 : 0,
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    padding: expanded ? 10 : 0,
                    overflowY: expanded ? "auto" : "hidden",
                    overflowX: "hidden",
                    opacity: expanded ? 1 : 0,
                    maxHeight: expanded ? 300 : 0,
                    transform: expanded ? "translateY(0)" : "translateY(-6px)",
                    transition:
                        "max-height 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), " +
                        "opacity 0.3s ease, " +
                        "padding 0.3s ease, " +
                        "margin-top 0.3s ease, " +
                        "transform 0.35s ease-out",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.2) transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: expanded ? 8 : 0,
                }}
            >
                {expanded && count > 0 && (
                    <Button
                        width="100%"
                        size={Button.Sizes.SMALL}
                        onClick={handleClearJoins}
                        color={Button.Colors.RED}
                        style={{
                            marginBottom: 8,
                            fontWeight: 500,
                            transition: "background 0.2s ease",
                        }}
                    >
                        Clear recent joins
                    </Button>
                )}

                {count === 0 ? (
                    <div
                        style={{
                            color: "#aaa",
                            fontSize: 12,
                            textAlign: "center",
                            padding: "20px 0",
                        }}
                    >
                        No recent joins yet.
                    </div>
                ) : (
                    localJoins.map((join, index) => (
                        <div
                            key={join.messageJumpUrl || join.id}
                            style={{
                                transform: expanded ? "translateY(0)" : "translateY(10px)",
                                opacity: expanded ? 1 : 0,
                                transitionDelay: expanded ? `${index * 0.05}s` : "0s",
                                transition:
                                    "transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease",
                            }}
                        >
                            <JoinedServerCard
                                join={join}
                                onCardClick={() => handleCardClick(join)}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const avatarFallback = "https://discord.com/assets/881ed827548f38c6.svg";

type JoinedServerCardProps = {
    join: JoinedServer;
    onCardClick?: (join: JoinedServer) => void;
};

function JoinedServerCard({ join, onCardClick }: JoinedServerCardProps) {
    const authorAvatarUrl = join.authorAvatarUrl || avatarFallback;
    const serverIconUrl = join.iconUrl || avatarFallback;
    const { joinStatus } = join;

    // Estilos base
    const wasVerified = joinStatus?.verified ?? false;
    const isUnsafe = joinStatus?.safe === false && wasVerified;
    const baseBackground = isUnsafe ? "rgba(237, 66, 69, 0.1)" : "rgba(255,255,255,0.08)";
    const baseBorder = isUnsafe ? "1px solid rgba(237, 66, 69, 0.4)" : "none";
    const hoverBackground = isUnsafe ? "rgba(237, 66, 69, 0.15)" : "rgba(255,255,255,0.12)";
    const hoverBorder = isUnsafe ? "1px solid rgba(237, 66, 69, 0.6)" : baseBorder;

    // Status text based on joinStatus
    const getStatusText = () => {
        if (!joinStatus) return "⚠️ Unknown";
        if (!joinStatus.joined) return "❌ Failed to join";
        if (!wasVerified) return "⚠️ Link not verified";
        return joinStatus.safe ? "✅ Sol's RNG" : "❌ Not Sol's RNG";
    };

    const getStatusColor = () => {
        if (!joinStatus) return "#faa61a"; // yellow for unknown
        if (!joinStatus.joined) return "#ed4245"; // red for failed join
        if (!wasVerified) return "#faa61a"; // yellow for not verified
        return joinStatus.safe ? "#3ba55c" : "#ed4245"; // green/red for safe/unsafe
    };

    return (
        <div
            onClick={() => onCardClick?.(join)}
            style={{
                display: "flex",
                flexDirection: "column",
                background: baseBackground,
                border: baseBorder,
                borderRadius: 8,
                cursor: "pointer",
                transition: "background 0.25s ease, transform 0.2s ease, border-color 0.25s ease",
                overflow: "hidden",
                minHeight: 140
            }}
            onMouseEnter={e => {
                const target = e.currentTarget as HTMLDivElement;
                target.style.background = hoverBackground;
                target.style.borderColor = isUnsafe ? "rgba(237, 66, 69, 0.6)" : "inherit";
                target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
                const target = e.currentTarget as HTMLDivElement;
                target.style.background = baseBackground;
                target.style.borderColor = isUnsafe ? "rgba(237, 66, 69, 0.4)" : "inherit";
                target.style.transform = "translateY(0)";
            }}
        >
            {/* Seção de conteúdo: textos à esquerda, ícone do servidor à direita */}
            <div style={{ padding: "12px", display: "flex", flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                {/* Textos à esquerda */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div
                        style={{
                            fontWeight: 600,
                            color: "#fff",
                            fontSize: 15,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {join.title}
                    </div>

                    {join.description && (
                        <div
                            style={{
                                fontSize: 13,
                                color: "#ccc",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                                maxHeight: "4em",
                                overflow: "hidden",
                            }}
                        >
                            {join.description}
                        </div>
                    )}
                </div>

                {/* Ícone do servidor à direita */}
                <img
                    src={serverIconUrl}
                    alt=""
                    onError={e => {
                        (e.currentTarget as HTMLImageElement).src = avatarFallback;
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
                {/* Assinatura do usuário + Tempo à esquerda */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Avatar pequeno do autor */}
                    <img
                        src={authorAvatarUrl}
                        alt=""
                        onError={e => {
                            (e.currentTarget as HTMLImageElement).src = avatarFallback;
                        }}
                        style={{
                            width: 24,
                            height: 24,
                            objectFit: "cover",
                            borderRadius: "50%",
                        }}
                    />
                    {/* Nome do autor */}
                    {join.authorName && (
                        <span
                            style={{
                                color: "#ccc",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "120px",
                            }}
                        >
                            {join.authorName}
                        </span>
                    )}
                    {/* Tempo */}
                    {join.timestamp && (
                        <span style={{ color: "#999" }}>
                            {formatTimeAgo(join.timestamp)}
                        </span>
                    )}
                </div>

                {/* Status à direita */}
                <span
                    style={{
                        color: getStatusColor(),
                        fontWeight: "bold",
                        flexShrink: 0,
                    }}
                >
                    {getStatusText()}
                </span>
            </div>
        </div>
    );
}
