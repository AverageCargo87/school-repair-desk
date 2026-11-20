/**
 * Правила жизненного цикла (SPEC «Жизненный цикл»): кто какое действие может сделать
 * в каком статусе. Чистый модуль — используется сервисом (проверки) и UI (какие кнопки показать).
 */
import type { RequestStatus, Role } from "@/db/schema";
import { isDispatcherRole } from "@/lib/roles";

export type RequestActionName =
  | "cancel"
  | "assign"
  | "accept"
  | "complete"
  | "reportProblem"
  | "comment"
  | "resolveProblem"
  | "reject"
  | "reopen";

export type AllowedActions = Record<RequestActionName, boolean>;

/** Кем текущий пользователь приходится заявке. */
export type ViewerRelation = {
  role: Role;
  /** Распределитель или админ. */
  isDispatcher: boolean;
  /** Автор заявки. */
  isAuthor: boolean;
  /** Основной исполнитель. */
  isExecutor: boolean;
  /** Соисполнитель. */
  isCoexecutor: boolean;
  /** Здание заявки закреплено за пользователем (user_buildings). */
  inMyBuildings: boolean;
};

export type RequestStateForRules = {
  status: RequestStatus;
  problemOpen: boolean;
};

const ACTIVE = new Set<RequestStatus>(["new", "assigned", "in_progress"]);
const WORK = new Set<RequestStatus>(["assigned", "in_progress"]);

export function buildRelation(
  user: { id: number; role: Role },
  req: { authorId: number; executorId: number | null },
  extra: { isCoexecutor: boolean; inMyBuildings: boolean },
): ViewerRelation {
  return {
    role: user.role,
    isDispatcher: isDispatcherRole(user.role),
    isAuthor: req.authorId === user.id,
    isExecutor: user.role === "executor" && req.executorId === user.id,
    isCoexecutor: user.role === "executor" && extra.isCoexecutor,
    inMyBuildings: user.role === "requester" && extra.inMyBuildings,
  };
}

/**
 * Видимость: распределитель/админ — всё; заявитель — заявки своих зданий (и свои);
 * исполнитель — где он основной исполнитель или соисполнитель.
 */
export function canView(rel: ViewerRelation): boolean {
  if (rel.isDispatcher) return true;
  if (rel.role === "requester") return rel.inMyBuildings || rel.isAuthor;
  if (rel.role === "executor") return rel.isExecutor || rel.isCoexecutor;
  return false;
}

/** Какие действия доступны пользователю над заявкой в её текущем состоянии. */
export function allowedActions(rel: ViewerRelation, req: RequestStateForRules): AllowedActions {
  const visible = canView(rel);
  const s = req.status;
  return {
    cancel: visible && rel.role === "requester" && rel.isAuthor && s === "new",
    assign: rel.isDispatcher && ACTIVE.has(s),
    accept: rel.isExecutor && s === "assigned",
    complete: rel.isExecutor && s === "in_progress",
    reportProblem: (rel.isExecutor || rel.isCoexecutor) && WORK.has(s),
    comment: visible,
    resolveProblem: rel.isDispatcher && req.problemOpen,
    reject: rel.isDispatcher && ACTIVE.has(s),
    reopen: rel.isDispatcher && s === "done",
  };
}

export const NO_ACTIONS: AllowedActions = {
  cancel: false,
  assign: false,
  accept: false,
  complete: false,
  reportProblem: false,
  comment: false,
  resolveProblem: false,
  reject: false,
  reopen: false,
};
