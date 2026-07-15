"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
    icon: LucideIcon;
    title: string;
    /** 是否可折叠 */
    collapsible?: boolean;
    /** 默认是否展开（仅 collapsible=true 时生效） */
    defaultOpen?: boolean;
    /** 折叠时显示的摘要文本 */
    summary?: string;
    /** 子内容（折叠区域） */
    children?: ReactNode;
}

/** 带金色装饰线的帝国风格分区标题，支持折叠 */
export function SectionHeader({
    icon: Icon,
    title,
    collapsible = false,
    defaultOpen = true,
    summary,
    children,
}: SectionHeaderProps) {
    const [isOpen, setIsOpen] = useState(() => {
        if (!collapsible) return true;
        return defaultOpen;
    });

    const canCollapse = collapsible;

    return (
        <div>
            {/* 标题行 */}
            <div
                className={`relative pb-3 mb-1 ${canCollapse ? 'cursor-pointer select-none active:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60' : ''}`}
                onClick={canCollapse ? () => setIsOpen(prev => !prev) : undefined}
                onKeyDown={canCollapse ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setIsOpen(prev => !prev);
                    }
                } : undefined}
                role={canCollapse ? "button" : undefined}
                tabIndex={canCollapse ? 0 : undefined}
                aria-expanded={canCollapse ? isOpen : undefined}
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 border border-primary/40 bg-[#1c1a16]">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold text-primary/90 tracking-[0.2em] uppercase parchment-glow flex-1">
                        {title}
                    </h3>
                    {canCollapse && (
                        <ChevronDown
                            className={`w-4 h-4 text-primary/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                        />
                    )}
                </div>
                {/* 折叠态摘要 */}
                {canCollapse && !isOpen && summary && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 ml-8.5 truncate">
                        {summary}
                    </p>
                )}
                {/* Gold underline */}
                <div className="absolute bottom-0 left-0 right-0 h-px gold-trim opacity-40" />
            </div>

            {/* 可折叠内容区 */}
            {children != null && (
                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${canCollapse && !isOpen ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                    <div className="min-h-0 overflow-hidden">{children}</div>
                </div>
            )}
        </div>
    );
}
