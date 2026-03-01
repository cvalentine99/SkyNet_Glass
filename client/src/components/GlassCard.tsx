/**
 * GlassCard — The signature Obsidian Glass component
 * Design: Glass Cockpit — aviation instrument panel aesthetic
 * Uses layered box-shadows, backdrop-blur, and gold accent hover
 */
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  bright?: boolean;
  noPadding?: boolean;
  delay?: number;
}

export function GlassCard({
  children,
  className,
  bright = false,
  noPadding = false,
  delay = 0,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        bright ? "glass-card-bright" : "glass-card",
        !noPadding && "p-5",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
