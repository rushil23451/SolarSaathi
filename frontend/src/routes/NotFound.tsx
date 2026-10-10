import { useT } from "../i18n";
import { ButtonLink } from "../ui/controls";
import { useTitle } from "../lib/useTitle";

export function NotFound() {
  const t = useT();
  useTitle(t.notFound.title);
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-8 py-24">
      <h1 tabIndex={-1} className="type-h1 focus:outline-none">{t.notFound.title}</h1>
      <p className="type-prose text-ink-2">{t.notFound.text}</p>
      <ButtonLink to="/">{t.notFound.home}</ButtonLink>
    </div>
  );
}
