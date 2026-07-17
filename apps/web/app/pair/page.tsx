import PairAppLaunch from "../../components/PairAppLaunch";

export const dynamic = "force-dynamic";

export default async function PairPage({ searchParams }: { searchParams: Promise<{ url?: string; token?: string }> }) {
  const { url = "", token = "" } = await searchParams;
  return <PairAppLaunch dashboardUrl={url} pairingToken={token} />;
}
