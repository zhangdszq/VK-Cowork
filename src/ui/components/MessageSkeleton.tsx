/**
 * 消息加载骨架屏组件
 * 在切换 Task 加载历史消息时显示
 */
export function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* 系统消息骨架 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative h-3 w-20 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-surface-secondary p-4">
          <div className="flex flex-col gap-2">
            <div className="relative h-3 w-1/3 overflow-hidden rounded-full bg-ink-900/10">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
            </div>
            <div className="relative h-3 w-1/2 overflow-hidden rounded-full bg-ink-900/10">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* 用户消息骨架 */}
      <div className="flex flex-col gap-2">
        <div className="relative h-3 w-12 overflow-hidden rounded-full bg-ink-900/10">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-3/4 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Assistant 思考骨架 */}
      <div className="flex flex-col gap-2">
        <div className="relative h-3 w-16 overflow-hidden rounded-full bg-ink-900/10">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-2/3 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* 工具调用骨架 */}
      <div className="rounded-[1rem] bg-surface-tertiary px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-2 overflow-hidden rounded-full bg-ink-900/15">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-16 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-32 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Assistant 回复骨架 */}
      <div className="flex flex-col gap-2">
        <div className="relative h-3 w-20 overflow-hidden rounded-full bg-ink-900/10">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
          <div className="relative h-3 w-4/5 overflow-hidden rounded-full bg-ink-900/10">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
