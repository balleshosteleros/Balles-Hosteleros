import type { Metadata } from "next";
import { QrListView } from "@/features/marketing/qr/components/admin/QrListView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Códigos QR",
};

export default function QrPage() {
  return <QrListView />;
}
