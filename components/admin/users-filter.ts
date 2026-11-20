/** Фильтр списка сотрудников (?role=…). Чистый модуль: и для сервера, и для клиента. */
import type { Role } from "@/db/schema";

export type DirectoryFilter = Role | "inactive" | "all";

export const DIRECTORY_FILTERS: DirectoryFilter[] = [
  "all",
  "requester",
  "executor",
  "dispatcher",
  "admin",
  "inactive",
];

export function parseDirectoryFilter(v: string | undefined): DirectoryFilter {
  return DIRECTORY_FILTERS.includes(v as DirectoryFilter) ? (v as DirectoryFilter) : "all";
}
