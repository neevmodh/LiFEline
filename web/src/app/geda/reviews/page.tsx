"use client";

import { useConsole } from "@/components/geda/ConsoleContext";
import { ReviewQueue } from "@/components/geda/Reviews";

export default function ReviewsPage() {
  const { refresh } = useConsole();
  return <ReviewQueue onChange={() => void refresh()} />;
}
