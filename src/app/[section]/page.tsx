import { notFound } from "next/navigation";
import { OperationsPage } from "@/components/operations-page";
import { getOperationsRoute } from "@/lib/operations-routes";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section } = await params;
  if (!getOperationsRoute(section) || section === "overview") notFound();
  return <OperationsPage section={section} searchParams={await searchParams} />;
}
