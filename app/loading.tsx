export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white" aria-label="Loading" />
    </div>
  );
}
