import AuthGate from "../../../components/AuthGate";
import DeviceConnect from "../../../components/DeviceConnect";

export default async function ConnectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ state?: string }> }) {
  const { id } = await params; const { state = "" } = await searchParams;
  return <AuthGate><DeviceConnect displayId={id} state={state} /></AuthGate>;
}
