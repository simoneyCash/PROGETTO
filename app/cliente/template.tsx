import { PageTransition } from "@/components/ui/motion";

// Transizione d'ingresso a ogni navigazione nell'area cliente.
export default function ClienteTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
