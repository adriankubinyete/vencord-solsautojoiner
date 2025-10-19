/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { classNameFactory } from "@api/Styles";
import { openModal } from "@utils/modal";
import { Toasts, Tooltip, useEffect, useState } from "@webpack/common";

import { JoinerModal } from "./JoinerModal";
import { settings } from "./settings";

const cl = classNameFactory("vc-joiner-");

export function JoinerIcon({
    height = 20,
    width = 20,
    className
}: {
    height?: number;
    width?: number;
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            height={height}
            width={width}
            className={cl("icon", className)}
        >
            <path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.48 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.4h-3.84a.48.48 0 0 0-.48.4l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22l-1.92 3.32c-.12.22-.07.49.12.61l2.03 1.58c-.04.3-.06.62-.06.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.09.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
    );
}

export let setShouldShowJoinEnabledTooltip: undefined | ((show: boolean) => void);

export const JoinerChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const { AutoJoin: isEnabled, showIcon, showAutoJoinTooltip } = settings.use([
        "AutoJoin",
        "showIcon",
        "showAutoJoinTooltip"
    ]);

    const [shouldShowJoinEnabledTooltip, setter] = useState(false);
    useEffect(() => {
        setShouldShowJoinEnabledTooltip = setter;
        return () => setShouldShowJoinEnabledTooltip = undefined;
    }, []);

    if (!isMainChat || !showIcon) return null;

    const toggleAutoJoin = () => {
        const newState = !settings.store.AutoJoin;
        settings.store.AutoJoin = newState;

        Toasts.show(
            Toasts.create(
                newState ? "AutoJoin enabled" : "AutoJoin disabled",
                newState ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE,
                { duration: 3000, position: Toasts.Position.TOP }
            )
        );
    };

    const button = (
        <ChatBarButton
            tooltip="Open SolsAutoJoiner Modal"
            onClick={e => {
                if (e.shiftKey) {
                    toggleAutoJoin();
                    return;
                }

                openModal(props => <JoinerModal rootProps={props} />);
            }}
            buttonProps={{
                "aria-haspopup": "dialog",
                style: { position: "relative" }
            }}
        >
            <JoinerIcon
                className={cl({ "auto-join": isEnabled, "chat-button": true })}
            />

            {/* Indicador visual de AutoJoin desativado */}
            {isEnabled && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 2,
                        right: 2,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "green",
                    }}
                />
            )}
        </ChatBarButton>
    );

    if (shouldShowJoinEnabledTooltip && showAutoJoinTooltip)
        return (
            <Tooltip text="Auto Join Enabled" forceOpen>
                {() => button}
            </Tooltip>
        );

    return button;
};
