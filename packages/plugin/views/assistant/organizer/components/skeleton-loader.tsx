import * as React from "react";
import { motion } from "framer-motion";

interface SkeletonLoaderProps {
  count?: number;
  rows?: number;
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  count = 3,
  rows = 1,
  width = "60px",
  height = "24px",
  style = {},
}) => {
  const itemsPerRow = Math.ceil(count / rows);

  return (
    <motion.div
      className=""
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        ...style,
      }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: "8px" }}>
          {Array.from({ length: itemsPerRow }).map((_, colIndex) => {
            const itemIndex = rowIndex * itemsPerRow + colIndex;
            if (itemIndex < count) {
              return <SkeletonItem key={itemIndex} width={width} height={height} />;
            }
            return null;
          })}
        </div>
      ))}
    </motion.div>
  );
};

const SkeletonItem: React.FC<{ width: string; height: string }> = ({
  width,
  height,
}) => (
  <motion.div
    style={{
      width,
      height,
      background: "linear-gradient(90deg, #191621 25%, rgba(14,210,247,0.06) 50%, #191621 75%)",
      backgroundSize: "200% 100%",
      borderRadius: "12px",
    }}
    animate={{
      backgroundPosition: ["200% 0", "-200% 0"],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    }}
  />
);
