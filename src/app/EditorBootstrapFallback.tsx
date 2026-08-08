export function EditorBootstrapFallback() {
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      role="status"
      aria-label="正在启动托盘编辑器"
    >
      <header className="relative h-[58px] shrink-0 border-b-2 border-[#2e2a24] bg-[#0e0d0b] lg:h-[68px]">
        <div className="absolute left-3 top-3 h-8 w-52 bg-[#1c1a16] lg:left-6 lg:h-10" />
        <div className="gold-trim absolute bottom-0 left-0 right-0 h-[2px]" />
      </header>
      <div className="h-12 shrink-0 border-b border-[#2e2a24] bg-[#15130f]" />
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="h-[46%] w-full shrink-0 bg-[#0e0d0b] md:h-full md:w-[380px]" />
        <div className="h-[3px] w-full shrink-0 bg-[#2e2a24] md:h-full md:w-[3px]" />
        <div className="min-h-0 min-w-0 flex-1 bg-[#0a0908]" />
      </main>
      <span className="sr-only">正在启动托盘编辑器</span>
    </div>
  );
}
