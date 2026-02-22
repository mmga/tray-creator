"use client";

import type { LucideIcon } from "lucide-react";

/** 带金色装饰线的帝国风格分区标题 */
export function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
    return (
        <div className="relative pb-3 mb-1">
            <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-6 h-6 border border-primary/40 bg-[#1c1a16]">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-xs font-bold text-primary/90 tracking-[0.2em] uppercase parchment-glow">
                    {title}
                </h3>
            </div>
            {/* Gold underline */}
            <div className="absolute bottom-0 left-0 right-0 h-px gold-trim opacity-40" />
        </div>
    );
}
