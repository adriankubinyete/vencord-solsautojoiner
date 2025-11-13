/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { openModal } from "@utils/modal";
import { Toasts } from "@webpack/common";

import { settings } from "../settings";
import { cl, showToast } from "../utils";
import { PluginModal } from "./PluginModal";

export function ChatBarIcon({
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
            {/* <path
                fill="currentColor"
                stroke="currentColor"
                d="M5.164 0 .16 18.928 18.836 24 23.84 5.072Zm8.747 15.354-5.219-1.417 1.399-5.29 5.22 1.418-1.4 5.29z"
            /> */}
            <path d="M12 11.9996L5.00197 6.33546C4.57285 5.98813 3.93869 6.05182 3.63599 6.5135C3.06678 7.38163 2.62413 8.35389 2.34078 9.41136C0.911364 14.746 4.07719 20.2294 9.41185 21.6588C14.7465 23.0882 20.2299 19.9224 21.6593 14.5877C23.0887 9.25308 19.9229 3.76971 14.5882 2.34029C11.9556 1.63489 9.28684 2.04857 7.0869 3.28972" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>

        </svg>
    );
}

export const CustomChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { joinEnabled, uiShowChatBarIcon, uiShortcutAction } = settings.use([
        "joinEnabled",
        "uiShowChatBarIcon",
        "uiShortcutAction",
    ]);

    if (!isMainChat || !uiShowChatBarIcon) return null;

    const toggleAutoJoin = () => {
        const newState = !settings.store.joinEnabled;
        settings.store.joinEnabled = newState;

        // Determine if notifications should also be toggled
        if (uiShortcutAction === "toggleJoinAndNotifications") {
            settings.store.notifyEnabled = newState;
        }

        const message = uiShortcutAction === "toggleJoinAndNotifications"
            ? `AutoJoin and Notifications ${newState ? "enabled" : "disabled"}`
            : `AutoJoin ${newState ? "enabled" : "disabled"}`;

        const toastType = newState ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE;

        showToast(message, toastType);
    };

    const handleClick = (e: React.MouseEvent) => {
        openModal(props => <PluginModal rootProps={props} />);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        toggleAutoJoin();
    };

    const indicatorStyle = {
        position: "absolute" as const,
        bottom: 2,
        right: 2,
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: "green"
    };

    return (
        <ChatBarButton
            tooltip="RoSniper Settings"
            onClick={handleClick}
            onContextMenu={handleContextMenu} // right click
            buttonProps={{
                "aria-haspopup": "dialog",
                style: { position: "relative" }
            }}
        >
            <ChatBarIcon
                className={cl({
                    "auto-join": joinEnabled,
                    "chat-button": true
                })}
            />

            {/* AutoJoin active indicator */}
            {joinEnabled && <div style={indicatorStyle} />}
        </ChatBarButton>
    );
};
