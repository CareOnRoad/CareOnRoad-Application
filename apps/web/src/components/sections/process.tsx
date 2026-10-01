import type { ProcessStep } from "@/types";

export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <section className="bg-surface py-20">
      <div className="container-page">
        <div className="mb-10 flex flex-col gap-3 md:max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
            Quy trình 4 bước
          </span>
          <h2 className="text-3xl font-bold text-ink md:text-4xl">
            Từ yêu cầu đến hoàn tất trong một quy trình minh bạch
          </h2>
        </div>

        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.index}
              className="relative flex h-full flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-6"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-surface">
                {String(step.index).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
              <p className="text-sm text-ink-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
