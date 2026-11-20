import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5";

function HeaderSkeleton({ withAction }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      {withAction ? <Skeleton className="h-12 w-full rounded-xl sm:w-44" /> : null}
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className={cn(card, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <SkeletonText lines={2} />
      <Skeleton className="h-3.5 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="size-6 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Скелетон страницы на время загрузки (для loading.tsx). Нужен на медленной мобильной сети —
 * без него после нажатия ничего не меняется, пока сервер не ответит, и люди жмут повторно.
 * list — список заявок; card — карточка заявки; form — форма; table — список с плитками (админка, распределитель).
 */
export function PageLoading({ variant = "list" }: { variant?: "list" | "card" | "form" | "table" }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span role="status" className="sr-only">
        Загружаем…
      </span>
      {variant === "list" ? (
        <>
          <HeaderSkeleton withAction />
          <Skeleton className="h-12 w-full rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </>
      ) : variant === "table" ? (
        <>
          <HeaderSkeleton withAction />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn(card, "flex flex-col gap-3 p-3.5 sm:p-3.5")}>
                <div className="flex justify-between">
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="size-9 rounded-xl" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </>
      ) : variant === "card" ? (
        <>
          <Skeleton className="h-5 w-24" />
          <div className={cn(card, "flex flex-col gap-4")}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <SkeletonText lines={3} />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </div>
          <div className={cn(card, "flex flex-col gap-3")}>
            <Skeleton className="h-5 w-32" />
            <SkeletonText lines={2} />
          </div>
          <div className={cn(card, "flex flex-col gap-3")}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </>
      ) : (
        <>
          <HeaderSkeleton />
          <div className={cn(card, "flex flex-col gap-5")}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-xl sm:w-48" />
        </>
      )}
    </div>
  );
}
