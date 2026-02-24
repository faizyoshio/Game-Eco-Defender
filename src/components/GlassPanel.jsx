const joinClasses = (...values) => values.filter(Boolean).join(" ");

export default function GlassPanel({
  as: Tag = "section",
  title,
  subtitle,
  action,
  className,
  contentClassName,
  interactive = false,
  children
}) {
  return (
    <Tag
      className={joinClasses(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-glass",
        "text-white/90",
        interactive &&
          "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-floating motion-reduce:transform-none motion-reduce:transition-none",
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/25 via-white/8 to-transparent" />
        <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      </div>

      <div className="relative">
        {(title || subtitle || action) && (
          <header className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              {title && <h2 className="text-sm font-semibold tracking-wide text-white/95">{title}</h2>}
              {subtitle && <p className="mt-1 text-xs text-white/70">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </header>
        )}

        <div className={joinClasses("px-4 pb-4", !(title || subtitle || action) && "pt-4", contentClassName)}>
          {children}
        </div>
      </div>
    </Tag>
  );
}
