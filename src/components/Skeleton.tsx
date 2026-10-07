export function BoardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-64 rounded-[22px] bg-white" />
        <div className="h-64 rounded-[22px] bg-[#d4f3e4] border-[3px] border-black" />
      </div>
      <div className="h-[28rem] rounded-[22px] bg-white" />
    </div>
  );
}
