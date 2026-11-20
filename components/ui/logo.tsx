import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/** Знак-логотип: скруглённый квадрат с градиентом индиго→фиолетовый и белым гаечным ключом. */
export function LogoMark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = {
    sm: "size-7 rounded-lg [&_svg]:size-4",
    md: "size-8 rounded-[10px] [&_svg]:size-[18px]",
    lg: "size-12 rounded-2xl [&_svg]:size-6",
    xl: "size-16 rounded-[20px] [&_svg]:size-8",
  }[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-linear-to-br from-logo-from to-logo-to text-white shadow-brand",
        s,
        className,
      )}
    >
      <Wrench strokeWidth={2.25} />
    </span>
  );
}

/** Логотип со словами: «Заявки · Школа». */
export function Logo({ className, hideSchoolOnMobile }: { className?: string; hideSchoolOnMobile?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] leading-tight font-semibold tracking-tight text-text">
        Заявки
        <span className={cn("font-normal text-muted", hideSchoolOnMobile && "max-sm:hidden")}>
          {" "}
          · Школа
        </span>
      </span>
    </span>
  );
}
