import { notFound } from "next/navigation";
import { Checkout } from "@/components/pay/checkout";
import { getPublicInvoiceById } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ invoiceId: string }> };

export default async function PayInvoicePage({ params }: Props) {
  const { invoiceId } = await params;
  const invoice = await getPublicInvoiceById(invoiceId);
  if (!invoice) notFound();
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#eef2f7_50%,_#e2e8f0_100%)]">
      <Checkout initialInvoice={invoice} />
    </main>
  );
}
