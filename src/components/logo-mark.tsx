import type { ComponentPropsWithoutRef } from "react";

import Cursor from "@/assets/cursor.svg";
import DeepSwe from "@/assets/deep-swe.svg";
import Frontier from "@/assets/frontier.svg";

const logoMarks = {
  cursor: { src: Cursor, label: "Cursor" },
  "deep-swe": { src: DeepSwe, label: "Deep SWE" },
  frontier: { src: Frontier, label: "Frontier" },
} as const;

export type LogoMarkProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "srcSet"
> & {
  name: keyof typeof logoMarks;
};

export const LogoMark = ({ name, alt, ...props }: LogoMarkProps) => {
  const { src, label } = logoMarks[name];

  return <img {...props} src={src} alt={alt ?? label} />;
};
