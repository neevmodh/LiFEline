import TrackView from "./view";

// Rendered client-side after the auth check, so instant-navigation validation can't see it.
export const instant = false;

export default function Page() {
  return <TrackView />;
}
