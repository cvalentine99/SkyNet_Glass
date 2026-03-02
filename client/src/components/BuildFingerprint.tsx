/**
 * BuildFingerprint — Visible build identity badge.
 * Shows: short commit SHA • build timestamp • environment label
 * Example: "Build: abc1234 • 2026-03-02 19:14 • prod"
 *
 * Injected via Vite `define` in vite.config.ts at build time.
 * If the browser shows this badge, the running code IS the build you see.
 */
export function BuildFingerprint() {
  const sha = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "unknown";
  const time = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "unknown";
  const env = typeof __BUILD_ENV__ !== "undefined" ? __BUILD_ENV__ : "unknown";

  return (
    <div
      className="fixed bottom-2 right-2 z-[9999] px-2.5 py-1 rounded-md
        text-[10px] font-mono tracking-wide
        bg-black/60 text-amber-400/90 border border-amber-500/20
        backdrop-blur-sm select-all cursor-default
        hover:bg-black/80 hover:text-amber-300 transition-colors"
      title={`Build: ${sha} • ${time} • ${env}`}
    >
      Build: {sha} &bull; {time} &bull; {env}
    </div>
  );
}
