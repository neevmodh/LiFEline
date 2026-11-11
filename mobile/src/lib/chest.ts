// Whether today's chest has been opened, kept on the phone (it reveals today's real totals, so there
// is nothing to protect on the server). The key holds the India-time day it was last opened.
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getItem, setItem } from "@/lib/storage";

const KEY = "nidhi.chestOpened";

export function useChestOpened(day: string): [boolean, () => void] {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["chest-opened"], queryFn: async () => (await getItem(KEY)) ?? "" });
  const open = () => {
    qc.setQueryData(["chest-opened"], day);
    void setItem(KEY, day);
  };
  return [q.data === day, open];
}
