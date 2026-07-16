import Builder from "../components/Builder";
import AuthGate from "../components/AuthGate";

export default function Home() {
  return <AuthGate><Builder /></AuthGate>;
}
