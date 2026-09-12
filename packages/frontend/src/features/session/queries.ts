import { queryOptions } from "@tanstack/react-query";
import { sessionGetQueue } from "./api";

export const sessionQueueOptions = () =>
  queryOptions({
    queryKey: ["session", "queue"],
    queryFn: ({ signal }) => sessionGetQueue(signal),
    staleTime: 60_000,
  });
