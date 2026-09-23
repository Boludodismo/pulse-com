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
      <img src="/tatuei-bot-logo.png" alt="" draggable={false} />
    </span>
  );
}
