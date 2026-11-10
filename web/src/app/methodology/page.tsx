import type { Metadata } from "next";
import MethodologyView from "./view";

export const metadata: Metadata = { title: "How we calculate · Nidhi" };

export default function Page() {
  return <MethodologyView />;
}
