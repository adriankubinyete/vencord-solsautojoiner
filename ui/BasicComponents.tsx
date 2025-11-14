/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CheckedTextInput } from "@components/CheckedTextInput";
import { FormSwitch } from "@components/FormSwitch";
import { Margins } from "@components/margins";
import { OptionType } from "@utils/types";
import { Button, React, SearchableSelect } from "@webpack/common";

import { settings } from "../settings";
import { getSettingMeta } from "../utils";

type BaseButtonProps = {
    onClick: () => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
};

export function BaseButton({ onClick, children, style }: BaseButtonProps) {
    return (
        <div style={{ width: "100%" }}>
            <Button
                width="100%"
                size={Button.Sizes.SMALL}
                onClick={onClick}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontWeight: 500,
                    transition: "background 0.2s ease",
                    marginBottom: 12,
                    width: "100%",
                    ...style,
                }}
            >
                {children}
            </Button>
        </div>
    );
}

export function Note({
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
        marginBottom: 15,
    };

    return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

export function Line() {
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

export function SectionMessage({ children }: { children: React.ReactNode; }) {
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

export function SectionTitle({ children }: { children: React.ReactNode; }) {
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

export function Section({
    title,
    defaultOpen = false,
    children
}: {
    title: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <div style={{ width: "100%", margin: "20px 0" }}>
            {/* Header */}
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    cursor: "pointer",
                    userSelect: "none",
                    opacity: 0.9,
                    transition: "opacity 0.15s",
                }}
            >
                <hr
                    style={{
                        flex: 1,
                        border: "none",
                        borderTop: "1px solid #555",
                        marginRight: 12,
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#ccc",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                    }}
                >
                    {/* Pequena seta animada */}
                    <span
                        style={{
                            display: "inline-block",
                            transition: "transform 0.25s ease",
                            transform: open ? "rotate(90deg)" : "rotate(0deg)",
                            fontSize: 12,
                            opacity: 0.7,
                        }}
                    >
                        ▶
                    </span>

                    {title}
                </div>

                <hr
                    style={{
                        flex: 1,
                        border: "none",
                        borderTop: "1px solid #555",
                        marginLeft: 12,
                    }}
                />
            </div>

            {/* Conteúdo suavemente animado */}
            <div
                style={{
                    maxHeight: open ? "2000px" : "0px",
                    overflow: "hidden",
                    transition: "max-height 0.35s ease",

                    // Fade + leve movimento vertical
                    opacity: open ? 1 : 0,
                    transform: open ? "translateY(0px)" : "translateY(-4px)",
                    transitionProperty: "max-height, opacity, transform, padding",
                    transitionDuration: "0.35s",

                    paddingTop: open ? 10 : 0,
                }}
            >
                {children}
            </div>
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
