import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

/**
 * Sin esto, al pulsar en el menú no pasa nada hasta que la pantalla está lista
 * y parece que el software se ha quedado colgado.
 */
export default function Loading() {
  return <LoadingSpinner size="lg" />;
}
