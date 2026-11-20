import { RotateCcw, TriangleAlert, UserCog, UserPlus } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { ExecutorOption, RequestDetail } from "@/lib/requests/queries";
import { formatWhenMsk } from "@/lib/time";
import { shortName } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SectionCard } from "@/components/ui/section-card";
import { PhotoGrid } from "@/components/requests/photo-grid";
import { AssignForm } from "./assign-form";
import { RejectForm } from "./reject-form";
import { ReopenForm } from "./reopen-form";
import { ResolveProblemForm } from "./resolve-problem-form";

export type DispatcherPanelProps = {
  /** Полные данные карточки; request.allowed.{assign,resolveProblem,reject,reopen}. */
  request: RequestDetail;
  user: SessionUser;
  /** Активные исполнители (listExecutors()) — для выбора исполнителя и соисполнителей. */
  executors: ExecutorOption[];
  /** Сегодня по Москве 'YYYY-MM-DD' — min для поля срока. */
  today: string;
};

/**
 * Панель действий распределителя/админа на карточке /r/[id].
 * Показывает только допустимые сейчас действия (request.allowed):
 * «Проблема от исполнителя» (красная карточка) → назначение / «Изменить назначение» и «Отклонить»
 * (карточка с рамкой бренда) → «Вернуть в работу» (для выполненной).
 */
export function DispatcherPanel({ request, executors, today }: DispatcherPanelProps) {
  const a = request.allowed;
  const showResolve = a.resolveProblem && request.problemOpen;
  if (!a.assign && !showResolve && !a.reject && !a.reopen) return null;

  const isFirst = request.status === "new";
  const problem = request.lastProblem;
  const activeExecutors = executors.filter((e) => e.active);

  return (
    <div id="dispatcher-actions" className="flex scroll-mt-20 flex-col gap-4">
      {showResolve ? (
        <SectionCard
          tone="danger"
          icon={<TriangleAlert />}
          title="Исполнитель сообщил о проблеме"
          description="Заявка стоит первой в вашем списке, пока проблема не решена."
        >
          <div className="flex flex-col gap-4">
            {problem ? (
              <div className="rounded-xl bg-danger-bg p-3.5">
                <div className="flex items-center gap-2 text-[13px] text-danger-fg">
                  {problem.actor ? <Avatar name={problem.actor.fullName} size="sm" /> : null}
                  <span className="font-semibold">
                    {problem.actor ? shortName(problem.actor.fullName) : "Исполнитель"}
                  </span>
                  <span className="opacity-80 tabular-nums">· {formatWhenMsk(problem.createdAt)}</span>
                </div>
                {problem.text ? (
                  <p className="mt-2 text-[15px] leading-snug whitespace-pre-wrap wrap-anywhere text-danger-fg">
                    {problem.text}
                  </p>
                ) : null}
                {problem.photos.length ? (
                  <PhotoGrid photos={problem.photos} size="sm" className="mt-3" />
                ) : null}
              </div>
            ) : null}
            <p className="text-sm leading-snug text-muted">
              {a.assign
                ? "Нужно сменить исполнителя или срок — нажмите «Изменить назначение» ниже, отметка «Проблема» снимется сама. Уладили на словах — нажмите «Проблема решена»."
                : "Если всё уладили — нажмите «Проблема решена»."}
            </p>
            <ResolveProblemForm requestId={request.id} />
          </div>
        </SectionCard>
      ) : null}

      {a.assign || a.reject ? (
        <SectionCard
          tone="brand"
          icon={isFirst ? <UserPlus /> : <UserCog />}
          title={isFirst ? "Назначить исполнителя" : "Управление заявкой"}
          description={
            isFirst
              ? "Выберите, кто сделает и к какому сроку."
              : "Можно сменить исполнителя, соисполнителей, срок или отклонить заявку."
          }
        >
          {a.assign ? (
            <AssignForm
              requestId={request.id}
              isFirst={isFirst}
              problemOpen={request.problemOpen}
              executors={activeExecutors.map((e) => ({
                id: e.id,
                fullName: e.fullName,
                activeCount: e.activeCount,
              }))}
              current={{
                executor: request.executor,
                coexecutors: request.coexecutors,
                deadline: request.deadline,
                dispatcherComment: request.dispatcherComment,
              }}
              today={today}
            />
          ) : null}

          {a.reject ? (
            <div
              className={
                a.assign
                  ? "mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
                  : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              }
            >
              <p className="text-sm text-muted">Это дубль, не ремонт или сделать нельзя?</p>
              <RejectForm requestId={request.id} />
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {a.reopen ? (
        <SectionCard
          tone="brand"
          icon={<RotateCcw />}
          title="Вернуть в работу"
          description={
            request.executor
              ? `Сделано не полностью или плохо — верните заявку исполнителю: ${shortName(request.executor.fullName)}`
              : "Сделано не полностью или плохо — верните заявку прежнему исполнителю."
          }
        >
          <ReopenForm
            requestId={request.id}
            executorName={request.executor?.fullName ?? null}
            executorActive={executors.some((e) => e.id === request.executor?.id && e.active)}
            currentDeadline={request.deadline}
            today={today}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
