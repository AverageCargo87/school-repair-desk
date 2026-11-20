"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openProblemForm } from "@/components/requests/comment-form";

/**
 * Кнопка «Сообщить о проблеме» в панели исполнителя.
 *
 * Отдельной формы проблемы здесь нет — чтобы не дублировать интерфейс, используется общая
 * форма комментария карточки (CommentForm): у неё для исполнителя/соисполнителя есть
 * переключатель «Это проблема — нужна помощь распределителя». Кнопка открывает эту форму
 * в режиме проблемы (openProblemForm): включает переключатель, прокручивает и ставит курсор.
 */
export function ProblemShortcut({
  requestId,
  label = "Сообщить о проблеме",
}: {
  requestId: number;
  /** Подпись кнопки (например, «Дописать о проблеме», если проблема уже открыта). */
  label?: string;
}) {
  const [notFound, setNotFound] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        icon={<TriangleAlert />}
        className="w-full"
        onClick={() => setNotFound(!openProblemForm(requestId))}
      >
        {label}
      </Button>
      {notFound ? (
        <p role="status" className="text-[13px] leading-snug text-muted">
          Напишите о проблеме в форме комментария на этой странице и включите «Это проблема».
        </p>
      ) : null}
    </div>
  );
}
