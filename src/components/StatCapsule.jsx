const joinClasses = (...values) => values.filter(Boolean).join(" ");

function StatCapsule({ label, value, className }) {
  return (
    <div
      className={joinClasses(
        "min-w-[124px] rounded-full border border-white/20 bg-white/12 px-3 py-2 backdrop-blur-xl shadow-glass",
        "transition duration-200 ease-out motion-reduce:transition-none",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}

export default StatCapsule;
