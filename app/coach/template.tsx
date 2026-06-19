import { PageTransition } from "@/components/ui/motion";

// Transizione d'ingresso a ogni navigazione nell'area coach (Next ri-monta il
// template a ogni cambio rotta → entrata fluida).
export default function CoachTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
