"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

const DropdownMenu = Primitive.Root;
const DropdownMenuTrigger = Primitive.Trigger;

function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content sideOffset={sideOffset} className={cn("z-[70] min-w-56 overflow-hidden rounded-sm border border-[#4a4030] bg-[#15130f] p-1.5 text-foreground shadow-2xl shadow-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0", className)} {...props} />
    </Primitive.Portal>
  );
}

function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof Primitive.Item> & { inset?: boolean }) {
  return <Primitive.Item className={cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2.5 py-2 text-xs outline-none transition-colors focus:bg-[#2a2518] focus:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-40", inset && "pl-8", className)} {...props} />;
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof Primitive.CheckboxItem>) {
  return (
    <Primitive.CheckboxItem checked={checked} className={cn("relative flex cursor-default select-none items-center rounded-sm py-2 pr-2.5 pl-8 text-xs outline-none focus:bg-[#2a2518] focus:text-primary", className)} {...props}>
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center"><Primitive.ItemIndicator><Check className="size-3.5" /></Primitive.ItemIndicator></span>{children}
    </Primitive.CheckboxItem>
  );
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof Primitive.Label> & { inset?: boolean }) {
  return <Primitive.Label className={cn("px-2.5 py-1.5 text-[10px] font-bold tracking-[0.18em] text-primary/70 uppercase", inset && "pl-8", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("-mx-1 my-1 h-px bg-[#2e2a24]", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator };
