"use client";

import { Icon } from "@iconify/react";
import type { ComponentType } from "react";
import { SOLAR } from "./solar-data";

// Centralina icone (fonte UNICA). Espone le icone col set SOLAR (lineare),
// offline (dati in ./solar-data, nessuna chiamata di rete). I nomi sono gli
// stessi che usavamo con lucide, così i call-site non cambiano: <Dumbbell
// className="size-5" /> continua a funzionare. Cambiare un'icona = un punto solo.

// Prop accettati (quelli che usiamo davvero): evita di passare l'intero set di
// attributi SVG a Iconify, che confligge sul prop `mode`.
type IconProps = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  title?: string;
};
export type IconType = ComponentType<IconProps>;
// Alias per i consumatori che tipavano le icone come `LucideIcon`.
export type LucideIcon = IconType;

const make = (key: string): IconType => {
  const data = SOLAR[key];
  function SolarIcon(props: IconProps) {
    return <Icon icon={data} {...props} />;
  }
  return SolarIcon;
};

export const Home = make("home-smile-linear");
export const Users = make("users-group-rounded-linear");
export const ClipboardCheck = make("clipboard-check-linear");
export const Salad = make("plate-linear");
export const MessageCircle = make("chat-round-line-linear");
export const Dumbbell = make("dumbbell-linear");
export const Plus = make("add-circle-linear");
export const ChevronRight = make("alt-arrow-right-linear");
export const Sparkles = make("magic-stick-3-linear");
export const TriangleAlert = make("danger-triangle-linear");
export const CreditCard = make("card-linear");
export const Receipt = make("bill-list-linear");
export const LineChart = make("graph-up-linear");
export const Play = make("play-linear");
export const UtensilsCrossed = make("cup-hot-linear");
export const SmilePlus = make("smile-circle-linear");
export const CircleCheck = make("check-circle-linear");
export const ArrowUp = make("alt-arrow-up-linear");
export const ArrowDown = make("alt-arrow-down-linear");
export const X = make("close-circle-linear");
export const Copy = make("copy-linear");
export const Check = make("check-circle-linear");
