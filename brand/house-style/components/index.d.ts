// Procella House Style: every component is a plain function on window.Procella that returns an HTML or SVG string.

export interface IconProps { /** One of Procella.icons. */ name: string; size?: number; /** Set only when the icon carries meaning on its own. */ label?: string }

export interface StampProps {
  /** detected: p < 0.05 and at least 15 years. null: not detectable yet. short: under 15 years. */
  state: "detected" | "null" | "short";
  /** Only for detected. */
  direction?: "up" | "down";
  /** Bottom arc text, under 20 characters, e.g. "falling · 1984–2025". */
  detail?: string;
  size?: number;
  /** Play the press once. */
  press?: boolean;
}

export interface LuggageTagProps { name: string; unit?: string; source?: string; years?: string; icon?: string; button?: boolean; selected?: boolean }

export interface SeriesInput { years: number[]; values: number[]; sen?: number; intercept?: number }

export interface ChartPlateProps extends SeriesInput {
  eyebrow?: string; title: string; unit?: string;
  /** Start the Sen line at this year (start-year check). */
  from?: number;
  caption: string; source: string; badges?: SourceBadgeProps[];
  width?: number; height?: number; label?: string;
}

export interface DossierProps {
  place: string; coords: string; variable: string; unit: string; source: string; icon?: string;
  /** Sen's slope per year. */
  slope: number; p: number; years: string; n: number;
  state: "detected" | "null" | "short"; stampDetail?: string;
  series?: SeriesInput; badges?: SourceBadgeProps[]; digits?: number;
}

export interface DispatchProps { dateline: string; headline: string; standfirst: string; cta?: string; href?: string }

export interface FlapBoardProps { text: string; length?: number; size?: "sm" }

export interface CompassProps { bearing?: number; size?: number; label?: string }

export interface SourceBadgeProps { kind: "live" | "cached" | "crosscheck" | "model"; text: string }

export interface RouteLineProps { from: string; to: string; fromName?: string; toName?: string; variant?: "airmail"; drawn?: boolean }
