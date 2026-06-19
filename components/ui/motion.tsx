"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

// =============================================================================
// Coach AI — Sistema di MOTION (premium). Tutto client-side, rispetta sempre
// prefers-reduced-motion. Le schermate (server) passano i figli a questi wrapper.
//   Reveal/Stagger  entrate fluide in stagger
//   TapScale        feedback al tocco (scala)
//   AnimatedNumber  contatore che sale
//   ProgressRing    anello di progresso animato (verde accento)
//   PageTransition  transizione tra rotte (usata nei template.tsx)
//   Confetti        momento celebrativo (verde) — es. allenamento completato
// =============================================================================

const EASE = [0.22, 0.61, 0.36, 1] as const;

// Entrata singola: opacità + slide-up. `delay` per scaglionare a mano.
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// Contenitore che fa entrare i figli diretti uno dopo l'altro (stagger).
export function Stagger({
  children,
  gap = 0.07,
  className = "",
}: {
  children: ReactNode;
  gap?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

// Figlio di <Stagger>: entra secondo la cadenza del contenitore.
export function StaggerItem({
  children,
  y = 14,
  className = "",
}: {
  children: ReactNode;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

// Feedback tattile: l'elemento si comprime leggermente al tocco/click.
export function TapScale({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} whileTap={{ scale: 0.97 }}>
      {children}
    </motion.div>
  );
}

// Numero che conta fino al valore (tabular). Mostra subito il valore finale in
// SSR (niente layout shift), poi anima al mount.
export function AnimatedNumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value}
    </span>
  );
}

// Anello di progresso animato. value 0..1. `color`/`trackColor` sono opzionali:
// i default mantengono l'aspetto scuro del coach; l'area cliente (tema chiaro)
// passa una traccia scura e un colore dati (es. verde/blu).
export function ProgressRing({
  value,
  size = 56,
  stroke = 4,
  color = "var(--accent)",
  trackColor = "rgba(255,255,255,0.08)",
  className = "",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  className?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const off = c * (1 - clamped);
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? off : c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
        />
      </svg>
      {children != null && (
        <span className="absolute inset-0 flex items-center justify-center">
          {children}
        </span>
      )}
    </div>
  );
}

// Transizione di rotta: usata nei template.tsx delle aree (entrata leggera).
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// Momento celebrativo: scoppio di coriandoli verdi al mount (one-shot).
export function Confetti() {
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    import("canvas-confetti")
      .then((m) => {
        if (cancelled) return;
        const confetti = m.default;
        const colors = ["#2fe08a", "#4ff0a3", "#f7f8f8"];
        confetti({ particleCount: 90, spread: 72, origin: { y: 0.3 }, colors });
        timers.push(
          setTimeout(
            () =>
              confetti({
                particleCount: 60,
                spread: 110,
                startVelocity: 38,
                origin: { y: 0.35 },
                colors,
              }),
            220,
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
