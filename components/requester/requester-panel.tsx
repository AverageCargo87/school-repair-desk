import type { SessionUser } from "@/lib/auth";
import type { RequestDetail } from "@/lib/requests/queries";
import { CancelRequest } from "./cancel-request";

export type RequesterPanelProps = {
  /** Полные данные карточки; request.allowed.cancel — можно ли «Отменить». */
  request: RequestDetail;
  user: SessionUser;
};

/**
 * Панель действий заявителя на карточке /r/[id] — готовая карточка-секция (SectionCard).
 * Единственное действие — «Отменить заявку»: только автор и только пока заявка «Новая»
 * (request.allowed.cancel; сервер проверяет это ещё раз в cancelRequest).
 * Комментарии — общей формой карточки. Если действий нет — ничего не показываем.
 */
export function RequesterPanel({ request }: RequesterPanelProps) {
  if (!request.allowed.cancel) return null;
  return <CancelRequest requestId={request.id} />;
}
