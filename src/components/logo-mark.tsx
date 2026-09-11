import type { ComponentPropsWithoutRef } from "react";

import CostWise from "@/assets/cost-wise.svg";
import Cursor from "@/assets/cursor.svg";
import DeepSwe from "@/assets/deep-swe.svg";
import Frontier from "@/assets/frontier.svg";

const logoMarks = {
  "cost-wise": { src: CostWise, label: "Cost Wise" },
  cursor: { src: Cursor, label: "Cursor" },
  "deep-swe": { src: DeepSwe, label: "Deep SWE" },
  frontier: { src: Frontier, label: "Frontier" },
} as const;

/**
 * Properties for a benchmark or product logo image.
 *
 * @property name - Registered logo to render.
 * @property alt - Optional accessible text; defaults to the logo label.
 * Standard image attributes are supported except `src` and `srcSet`.
 */
export type LogoMarkProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "srcSet"
> & {
  name: keyof typeof logoMarks;
};

/**
 * Renders a registered logo with a default accessible label.
 *
 * @param props - Logo name and standard image attributes.
 * @returns The selected logo image.
 */
export const LogoMark = ({ name, alt, ...props }: LogoMarkProps) => {
  const { src, label } = logoMarks[name];

  return <img {...props} src={src} alt={alt ?? label} />;
};
