export function TatueiBotIcon({
  className = "",
  hero = false,
}: {
  className?: string;
  hero?: boolean;
}) {
  return (
    <span
      className={`${hero ? "tatuei-bot-mark" : "tatuei-bot-symbol"} ${className}`}
      aria-hidden="true"
    >
      <img src="/tatuei-logo-20261012.svg" alt="" draggable={false} />
    </span>
  );
}
