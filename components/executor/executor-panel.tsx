import {
  Ban,
  CalendarX,
  Camera,
  CircleCheck,
  LifeBuoy,
  ThumbsUp,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { RequestDetail } from "@/lib/requests/queries";
import { deadlineHint, formatDateShortMsk, formatWhenMsk } from "@/lib/time";
import { cn, shortName } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { SectionCard } from "@/components/ui/section-card";
import { AcceptForm } from "./accept-form";
import { CompleteForm } from "./complete-form";
import { ProblemShortcut } from "./problem-shortcut";

export type ExecutorPanelProps = {
  /**
   * Полные данные карточки; request.viewer.isExecutor / isCoexecutor,
   * request.allowed.{accept,complete,reportProblem}.
   */
  request: RequestDetail;
  user: SessionUser;
};

/** Короткая подсказка «что делать дальше»: иконка, жирная первая строка, пояснение. */
function NextStep({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary-soft px-3.5 py-3 text-primary-soft-fg">
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-card [&_svg]:size-4"
      >
        {icon}
      </span>
      <div className="min-w-0 self-center text-sm leading-snug">
        <div className="text-[15px] font-semibold">{title}</div>
        {children ? <div className="mt-0.5 opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * Панель действий исполнителя на карточке /r/[id].
 *  - основной исполнитель: «Принял» (Назначена) → «Выполнено» (В работе: фото 1..5 + комментарий);
 *  - основной и соисполнитель: «Сообщить о проблеме» (через общую форму комментария);
 *  - соисполнитель не видит «Принял»/«Выполнено».
 * Все проверки прав — на сервере (app/r/actions.ts → lib/requests/service.ts),
 * здесь кнопки показываются по request.allowed.
 */
export function ExecutorPanel({ request }: ExecutorPanelProps) {
  const { viewer, allowed: a, status } = request;
  if (!viewer.isExecutor && !viewer.isCoexecutor) return null;

  // Заявка закрыта — коротко объясняем, что делать ничего не нужно.
  if (status !== "assigned" && status !== "in_progress") {
    if (status === "done") {
      return (
        <Alert tone="success" icon={<CircleCheck />} title="Работа сдана">
          Заявка выполнена{request.completedAt ? ` ${formatWhenMsk(request.completedAt)}` : ""}. Если
          распределитель вернёт её в работу, она снова появится у вас в «Активных».
        </Alert>
      );
    }
    if (status === "rejected") {
      return (
        <Alert tone="neutral" icon={<Ban />} title="Делать ничего не нужно">
          Распределитель отклонил заявку.
        </Alert>
      );
    }
    return null;
  }

  const isMain = viewer.isExecutor;
  const hasMainAction = a.accept || a.complete;

  return (
    <SectionCard
      id="executor-actions"
      tone="brand"
      icon={<Wrench />}
      title="Ваши действия"
      description={isMain ? "Вы — основной исполнитель" : "Вы — соисполнитель"}
      contentClassName="flex flex-col gap-4"
    >
      {request.isOverdue && request.deadline ? (
        <Alert
          tone="danger"
          icon={<CalendarX />}
          title={`Срок был ${formatDateShortMsk(request.deadline)} — ${deadlineHint(request.deadline)}`}
        >
          Не успеваете — сообщите о проблеме, распределитель перенесёт срок.
        </Alert>
      ) : null}

      {/* Основной исполнитель, «Назначена» */}
      {a.accept ? (
        <>
          <NextStep icon={<ThumbsUp />} title="Прочитайте заявку и нажмите «Принял»">
            Так распределитель увидит, что вы взялись за работу.
          </NextStep>
          <AcceptForm requestId={request.id} />
        </>
      ) : null}

      {/* Основной исполнитель, «В работе» */}
      {a.complete ? (
        <>
          <NextStep icon={<Camera />} title="Закончили? Сфотографируйте результат">
            и нажмите «Выполнено». Дата поставится сама.
          </NextStep>
          <CompleteForm requestId={request.id} />
        </>
      ) : null}

      {/* Соисполнитель */}
      {!isMain ? (
        <NextStep icon={<Users />} title="Помогите основному исполнителю">
          «Принял» и «Выполнено» нажимает основной исполнитель
          {request.executor ? <> — {shortName(request.executor.fullName)}</> : "."}
        </NextStep>
      ) : null}

      {/* Проблема — основной исполнитель и соисполнитель */}
      {a.reportProblem ? (
        <div className={cn("flex flex-col gap-3", hasMainAction && "border-t border-border pt-4")}>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
                request.problemOpen ? "bg-danger-bg text-danger" : "bg-surface-2 text-muted",
              )}
            >
              {request.problemOpen ? <TriangleAlert /> : <LifeBuoy />}
            </span>
            <div className="min-w-0 self-center text-sm leading-snug">
              {request.problemOpen ? (
                <>
                  <div className="text-[15px] font-semibold text-danger-fg">О проблеме уже сообщили</div>
                  <p className="mt-0.5 text-muted">Распределитель разберётся. Можно дописать подробности.</p>
                </>
              ) : (
                <>
                  <div className="text-[15px] font-semibold text-text">Что-то мешает?</div>
                  <p className="mt-0.5 text-muted">
                    Нет материалов, нужна закупка или помощь, не успеваете к сроку — напишите
                    распределителю.
                  </p>
                </>
              )}
            </div>
          </div>
          <ProblemShortcut
            requestId={request.id}
            label={request.problemOpen ? "Дописать о проблеме" : "Сообщить о проблеме"}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
