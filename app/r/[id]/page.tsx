import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  CalendarClock,
  CalendarX,
  ChevronLeft,
  CircleCheck,
  CircleX,
  History,
  Hourglass,
  Image as ImageIcon,
  MapPin,
  MessageSquareQuote,
  Play,
  UserCheck,
} from "lucide-react";
import type { RequestStatus } from "@/db/schema";
import { requireUser, type SessionUser } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import {
  getRequestDetail,
  listExecutors,
  type RequestDetail,
  type RequestEventView,
} from "@/lib/requests/queries";
import { homeForRole, isDispatcherRole } from "@/lib/roles";
import {
  deadlineHint,
  formatDateMsk,
  formatDateShortMsk,
  formatDateTimeMsk,
  formatWhenMsk,
  todayMsk,
} from "@/lib/time";
import { cn, pluralRu, requestNo, shortName } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { Stepper } from "@/components/ui/stepper";
import { RequestBadges, StatusBadge } from "@/components/requests/badges";
import { CommentForm } from "@/components/requests/comment-form";
import { PhotoGrid } from "@/components/requests/photo-grid";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { RequesterPanel } from "@/components/requester/requester-panel";
import { DispatcherPanel } from "@/components/dispatcher/dispatcher-panel";
import { ExecutorPanel } from "@/components/executor/executor-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Заявка ${requestNo(Number(id) || 0)}` };
}

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

// ─── Степпер ─────────────────────────────────────────────────

const STEP_LABELS = ["Новая", "Назначена", "В работе", "Выполнена"] as const;
const STEP_INDEX: Partial<Record<RequestStatus, number>> = {
  new: 0,
  assigned: 1,
  in_progress: 2,
  done: 3,
};

function lastEvent(
  events: RequestEventView[],
  match: (e: RequestEventView) => boolean,
): RequestEventView | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (match(events[i])) return events[i];
  return undefined;
}

/** Шаги с датами под пройденными: «Новая · 7 октября», «Назначена · 9 октября»… */
function stepItems(r: RequestDetail, current: number) {
  // Последнее (пере)назначение до принятия — дата шага «Назначена».
  const limit = r.acceptedAt ?? r.completedAt;
  const assigned = lastEvent(
    r.events,
    (e) =>
      (e.type === "assigned" || e.type === "reassigned" || e.type === "reopened") &&
      (!limit || e.createdAt <= limit),
  );
  const dates = [r.createdAt, assigned?.createdAt, r.acceptedAt, r.completedAt];
  return STEP_LABELS.map((label, i) => ({
    label,
    hint: i <= current && dates[i] ? formatDateShortMsk(dates[i]) : undefined,
  }));
}

/** Вместо степпера у отклонённой/отменённой: серый баннер с причиной. */
function ClosedBanner({ request }: { request: RequestDetail }) {
  const rejected = request.status === "rejected";
  const ev = lastEvent(request.events, (e) => e.type === request.status);
  const who = ev?.actor
    ? `${shortName(ev.actor.fullName)} · ${roleLabels[ev.actor.role].toLowerCase()}`
    : null;
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-quiet-bg text-quiet-fg [&_svg]:size-[18px]"
      >
        {rejected ? <Ban /> : <CircleX />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug font-semibold text-text">
          {rejected ? "Заявка отклонена" : "Заявка отменена"}
        </div>
        <div className="mt-0.5 text-[13px] text-muted tabular-nums">
          {[who, ev ? formatWhenMsk(ev.createdAt) : null].filter(Boolean).join(" · ")}
        </div>
        {ev?.text ? (
          <p className="mt-2 text-[15px] leading-snug whitespace-pre-wrap wrap-anywhere text-text">
            <span className="text-muted">Причина: </span>
            {ev.text}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Причину не указали.</p>
        )}
      </div>
    </div>
  );
}

// ─── Мелкие блоки ────────────────────────────────────────────

function PersonRow({ name, role, you }: { name: string; role: string; you?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar name={name} size="lg" />
      <div className="min-w-0">
        <div className="text-[15px] leading-snug font-medium wrap-anywhere text-text">
          {name}
          {you ? (
            <Badge variant="primary" size="sm" className="ml-1.5 align-[1px]">
              вы
            </Badge>
          ) : null}
        </div>
        <div className="text-[13px] text-muted">{role}</div>
      </div>
    </li>
  );
}

function InfoRow({
  icon,
  label,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]",
          tone === "danger" ? "bg-danger-bg text-danger" : "bg-surface-2 text-muted",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-muted">{label}</div>
        <div className="text-[15px] leading-snug text-text">{children}</div>
      </div>
    </div>
  );
}

function Quote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        <MessageSquareQuote aria-hidden className="size-4" />
        {label}
      </div>
      <p className="mt-1 text-[15px] leading-snug whitespace-pre-wrap wrap-anywhere text-text">
        {children}
      </p>
    </div>
  );
}

/**
 * Подсказка под комментарием: уведомлений нет, комментарий видят только в карточке —
 * поэтому подсказываем, что делать, если нужна реакция.
 */
function commentHint(user: SessionUser, closed: boolean, canReportProblem: boolean): React.ReactNode {
  if (closed) {
    if (isDispatcherRole(user.role)) return null;
    return user.role === "requester" ? (
      <>
        Заявка закрыта — комментарий увидят, только если откроют её. Если поломка осталась,{" "}
        <Link href="/new" className="font-medium text-primary underline underline-offset-2">
          создайте новую заявку
        </Link>
        .
      </>
    ) : (
      "Заявка закрыта — комментарий увидят, только если откроют её."
    );
  }
  if (user.role === "requester") {
    return "Распределитель увидит комментарий, когда откроет заявку. Если срочно — скажите ему лично.";
  }
  if (canReportProblem) {
    return "Комментарий распределитель увидит в карточке. Если нужна его помощь — включите «Это проблема», тогда заявка поднимется у него наверх.";
  }
  return null;
}

async function ActionPanel({ request, user }: { request: RequestDetail; user: SessionUser }) {
  if (isDispatcherRole(user.role)) {
    const executors = await listExecutors();
    return (
      <DispatcherPanel request={request} user={user} executors={executors} today={todayMsk()} />
    );
  }
  if (user.role === "executor") return <ExecutorPanel request={request} user={user} />;
  if (user.role === "requester") return <RequesterPanel request={request} user={user} />;
  return null;
}

// ─── Страница ────────────────────────────────────────────────

/**
 * Карточка заявки (общая для всех ролей; доступ проверяет getRequestDetail).
 *
 * Телефон и планшет — одна колонка: шапка → назначение → результат → панель действий →
 * история → комментарий (панель — сразу под назначением, чтобы не листать через историю).
 * Компьютер (≥ xl) — две колонки: слева содержание, история и комментарий; справа назначение
 * и панель действий. Колонки — обёртки с display: contents на узком экране, порядок блоков
 * в одной колонке задают order-классы (у панели ролей — order 0, её разметку не трогаем).
 * Если справа показать нечего (закрытая заявка без исполнителя), остаётся одна колонка.
 */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) notFound();
  const request = await getRequestDetail(user, id);
  if (!request) notFound();

  const closed = ["done", "rejected", "cancelled"].includes(request.status);
  const stopped = request.status === "rejected" || request.status === "cancelled";
  const emergency = request.urgency === "emergency" && !closed;
  const hasAssignment = Boolean(request.executor);
  const showResult = request.status === "done" || Boolean(request.completedAt);
  const showWaiting = request.status === "new" && !hasAssignment && !isDispatcherRole(user.role);
  // После «Вернуть в работу» старые фото результата остаются в истории; здесь — только последние.
  const lastCompleted = lastEvent(request.events, (e) => e.type === "completed");
  const resultPhotos = lastCompleted ? lastCompleted.photos : request.photos.result;
  const completedBy = lastCompleted?.actor?.fullName ?? request.executor?.fullName ?? null;
  const longText = request.description.length > 140;
  const step = STEP_INDEX[request.status] ?? 0;
  const eventsCount = request.events.length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 xl:max-w-none xl:[&:has([data-aside]:empty)]:max-w-2xl">
      <Link
        href={homeForRole(user.role)}
        className="-my-1.5 -ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-xl pr-3 pl-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden className="size-[18px]" />
        К списку
      </Link>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,8fr)_minmax(0,7fr)] xl:items-start xl:gap-6 xl:[&:has(>[data-aside]:empty)]:flex">
        {/* ── Левая колонка: содержание, результат, история, комментарий ── */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
          {/* Шапка-карточка */}
          <article className="relative -order-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {emergency ? (
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-danger" />
            ) : null}

            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-muted tabular-nums">
                  <span className="font-semibold text-text">{requestNo(request.id)}</span>
                  <span aria-hidden> · </span>
                  <span>от {formatDateTimeMsk(request.createdAt)}</span>
                </div>
                <StatusBadge status={request.status} size="lg" />
              </div>

              <h1
                className={cn(
                  "mt-3 whitespace-pre-wrap wrap-anywhere text-text",
                  longText
                    ? "text-[17px] leading-relaxed font-medium"
                    : "text-xl leading-snug font-semibold tracking-tight sm:text-[22px]",
                )}
              >
                <span className="sr-only">Заявка {requestNo(request.id)}: </span>
                {request.description}
              </h1>

              <RequestBadges
                className="mt-3 empty:hidden"
                status={request.status}
                urgency={request.urgency}
                isOverdue={request.isOverdue}
                problemOpen={request.problemOpen && !closed}
                hideStatus
              />

              <div className="mt-4 flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5 text-[15px] leading-snug">
                  <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
                  <div className="min-w-0 wrap-anywhere">
                    <span className="font-medium text-text">{request.building.address}</span>
                    {request.location ? (
                      <span className="text-muted"> · {request.location}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-muted">
                  <Avatar name={request.author.fullName} size="xs" className="mx-px" />
                  <span className="min-w-0">
                    <span className="text-text">{shortName(request.author.fullName)}</span> ·{" "}
                    {roleLabels[request.author.role].toLowerCase()}
                  </span>
                </div>
              </div>

              {request.photos.problem.length ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-muted">
                    <ImageIcon aria-hidden className="size-4" />
                    Фото от заявителя
                    <span className="tabular-nums">· {request.photos.problem.length}</span>
                  </div>
                  <PhotoGrid photos={request.photos.problem} />
                </div>
              ) : null}
            </div>

            {/* Ход выполнения (или серый баннер у отклонённой/отменённой) */}
            <div className="border-t border-border bg-surface-2/60 px-3 py-4 sm:px-5">
              {stopped ? (
                <div className="px-1 sm:px-0">
                  <ClosedBanner request={request} />
                </div>
              ) : (
                <Stepper
                  steps={stepItems(request, step)}
                  current={step}
                  complete={request.status === "done"}
                />
              )}
            </div>
          </article>

          {/* Результат */}
          {showResult ? (
            <SectionCard
              className="-order-1"
              tone="success"
              icon={<CircleCheck />}
              title="Результат"
              description={
                request.completedAt
                  ? `Выполнена ${formatWhenMsk(request.completedAt)}${completedBy ? ` · ${shortName(completedBy)}` : ""}`
                  : undefined
              }
              contentClassName="flex flex-col gap-3"
            >
              {request.completionComment || resultPhotos.length ? (
                <>
                  {request.completionComment ? (
                    <Quote label="Комментарий исполнителя">{request.completionComment}</Quote>
                  ) : null}
                  {resultPhotos.length ? <PhotoGrid photos={resultPhotos} /> : null}
                </>
              ) : null}
            </SectionCard>
          ) : null}

          {/* История */}
          <SectionCard
            className="order-1"
            icon={<History />}
            title="История и комментарии"
            description={`${eventsCount} ${pluralRu(eventsCount, ["запись", "записи", "записей"])}, новые внизу`}
          >
            <RequestTimeline
              events={request.events}
              coexecutorIds={request.coexecutors.map((c) => c.id)}
            />
          </SectionCard>

          {request.allowed.comment ? (
            <CommentForm
              className="order-2"
              requestId={request.id}
              canReportProblem={request.allowed.reportProblem}
              hint={commentHint(user, closed, request.allowed.reportProblem)}
            />
          ) : null}
        </div>

        {/* ── Правая колонка: назначение и действия текущей роли ── */}
        <div data-aside className="contents empty:hidden xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
          {hasAssignment ? (
            <SectionCard className="-order-2" icon={<UserCheck />} title="Назначение">
              <ul className="flex flex-col gap-3">
                {request.executor ? (
                  <PersonRow
                    name={request.executor.fullName}
                    role="Исполнитель"
                    you={request.executor.id === user.id}
                  />
                ) : null}
                {request.coexecutors.map((c) => (
                  <PersonRow key={c.id} name={c.fullName} role="Соисполнитель" you={c.id === user.id} />
                ))}
              </ul>

              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                {request.deadline ? (
                  <InfoRow
                    icon={request.isOverdue ? <CalendarX /> : <CalendarClock />}
                    label="Срок"
                    tone={request.isOverdue ? "danger" : "default"}
                  >
                    <span
                      className={cn(
                        "tabular-nums",
                        request.isOverdue ? "font-semibold text-danger" : "font-medium",
                      )}
                    >
                      {formatDateMsk(request.deadline)}
                    </span>
                    {!closed ? (
                      <span className={cn("text-sm", request.isOverdue ? "text-danger" : "text-muted")}>
                        {" "}
                        · {deadlineHint(request.deadline)}
                      </span>
                    ) : null}
                  </InfoRow>
                ) : null}
                {request.acceptedAt ? (
                  <InfoRow icon={<Play />} label="Принята в работу">
                    <span className="tabular-nums">{formatWhenMsk(request.acceptedAt)}</span>
                  </InfoRow>
                ) : request.status === "assigned" ? (
                  <InfoRow icon={<Hourglass />} label="Принята в работу">
                    <span className="text-muted">ещё нет — ждём «Принял»</span>
                  </InfoRow>
                ) : null}
              </div>

              {request.dispatcherComment ? (
                <div className="mt-4">
                  <Quote label="Комментарий распределителя">{request.dispatcherComment}</Quote>
                </div>
              ) : null}
            </SectionCard>
          ) : showWaiting ? (
            <div className="-order-2 flex items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 p-4 sm:p-5">
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info [&_svg]:size-[18px]"
              >
                <Hourglass />
              </span>
              <div className="min-w-0 self-center">
                <div className="text-base leading-snug font-semibold tracking-tight text-text">
                  Ждёт распределителя
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  Он назначит исполнителя и срок — это появится здесь, на карточке.
                </p>
              </div>
            </div>
          ) : null}

          {/* Действия текущей роли — на телефоне сразу после назначения/результата,
              чтобы не листать до них через всю историю (order 0 между -1 и 1). */}
          <ActionPanel request={request} user={user} />
        </div>
      </div>
    </div>
  );
}
