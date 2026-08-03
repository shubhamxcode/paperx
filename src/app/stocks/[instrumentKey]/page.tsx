import { StockDetailClient } from "@/components/stocks/StockDetailClient";

export default async function StockDetailPage({ params }: { params: Promise<{ instrumentKey: string }> }) {
  const { instrumentKey } = await params;
  return <StockDetailClient instrumentKey={decodeURIComponent(instrumentKey)} />;
}
