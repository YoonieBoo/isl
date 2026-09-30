import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDownIcon } from "@/components/icons";

export function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const fieldClasses =
  "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-isl-blue disabled:bg-surface-pale disabled:text-foreground-muted";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`${fieldClasses} appearance-none bg-none pr-10 ${props.className ?? ""}`}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-isl-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-isl-blue-dark disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

const BADGE_TONES = {
  neutral: "bg-surface-pale text-foreground-muted",
  blue: "bg-isl-blue-pale text-isl-blue-dark",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-muted">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-danger">{children}</p>;
}

export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
  iconClassName = "bg-isl-blue-pale text-isl-blue",
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function LabelText(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={`text-xs font-medium uppercase tracking-wide text-foreground-muted ${props.className ?? ""}`}
    />
  );
}

type IconComponent = React.ComponentType<{ className?: string }>;

export const ACCENT_STYLES = {
  blue: { border: "border-l-isl-blue", badge: "bg-isl-blue-pale text-isl-blue" },
  orange: { border: "border-l-orange-400", badge: "bg-orange-50 text-orange-600" },
  purple: { border: "border-l-violet-400", badge: "bg-violet-50 text-violet-600" },
  green: { border: "border-l-emerald-400", badge: "bg-emerald-50 text-emerald-600" },
  red: { border: "border-l-red-400", badge: "bg-red-50 text-danger" },
} as const;

export type Accent = keyof typeof ACCENT_STYLES;

/** Neutral card: icon badge + title + divider + content. Used for grouped info sections. */
export function IconCard({
  icon: Icon,
  iconClassName = "bg-isl-blue-pale text-isl-blue",
  title,
  action,
  children,
  className = "",
}: {
  icon: IconComponent;
  iconClassName?: string;
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children && <div className="mt-4 border-t border-border pt-4">{children}</div>}
    </Card>
  );
}

/** Card with a colored left border + matching icon badge, for categorised content (strengths/needs/etc). */
export function AccentCard({
  icon: Icon,
  accent,
  title,
  action,
  children,
}: {
  icon?: IconComponent;
  accent: Accent;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { border, badge } = ACCENT_STYLES[accent];
  return (
    <Card className={`border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badge}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4 border-t border-border pt-4">{children}</div>
    </Card>
  );
}

/** Small stat tile with an icon badge, label, and big number — for dashboards/summary rows. */
export function StatCard({
  icon: Icon,
  iconClassName = "bg-isl-blue-pale text-isl-blue",
  label,
  value,
  href,
}: {
  icon: IconComponent;
  iconClassName?: string;
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  const content = (
    <Card className={href ? "transition-colors hover:border-isl-blue hover:bg-surface-pale" : ""}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function decorativeWavePaths() {
  return (
    <>
      <path
        fill="currentColor"
        fillOpacity="0.6"
        d="M0,80 C150,120 300,20 450,60 C600,100 700,40 800,70 L800,120 L0,120 Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.9"
        d="M0,100 C180,60 320,110 480,80 C640,50 720,90 800,90 L800,120 L0,120 Z"
      />
    </>
  );
}

/** Hero header for a top-level entity (learner, environment, run): decorative wave, avatar/icon, title, badge, actions. */
export function EntityHero({
  avatarText,
  avatarIcon: AvatarIcon,
  title,
  subtitle,
  badge,
  actions,
  href,
}: {
  avatarText?: string;
  avatarIcon?: IconComponent;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border bg-surface p-8 ${href ? "transition-colors hover:border-isl-blue/40" : ""}`}>
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-isl-blue-pale"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {decorativeWavePaths()}
      </svg>
      <svg className="pointer-events-none absolute right-10 top-8 h-20 w-28 text-border" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 7 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={col * 16 + 4} cy={row * 16 + 4} r="1.6" fill="currentColor" />
          )),
        )}
      </svg>

      {href && (
        <Link href={href} className="absolute inset-0 z-0" aria-label={`${title} profile`}>
          <span className="sr-only">{title} profile</span>
        </Link>
      )}

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-isl-blue-pale text-2xl font-bold text-isl-blue-dark">
            {AvatarIcon ? <AvatarIcon className="h-7 w-7" /> : avatarText}
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-3xl font-bold text-foreground ${href ? "group-hover:underline" : ""}`}>{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="relative z-10 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
