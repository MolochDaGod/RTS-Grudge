import { useQuery } from "@tanstack/react-query";
import {
  listObjectStoreModels,
  objectStoreHealth,
  type ListModelsParams,
} from "../library/ObjectStoreClient";

export function useObjectStoreHealth() {
  return useQuery({
    queryKey: ["objectstore", "health"],
    queryFn: objectStoreHealth,
    staleTime: 60_000,
  });
}

export function useObjectStoreModels(params: ListModelsParams & { enabled?: boolean }) {
  const { enabled = true, ...listParams } = params;
  return useQuery({
    queryKey: ["objectstore", "models", listParams],
    queryFn: () => listObjectStoreModels(listParams),
    enabled,
    staleTime: 5 * 60_000,
  });
}