export default function TopicToggle({
  title,
  active,
  disabled,
  onChange,
}: {
  title: string;
  active: boolean;
  disabled: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={`${title} aktiv`}
      aria-checked={active}
      disabled={disabled}
      className="topic-toggle"
      onClick={() => onChange(!active)}
    >
      <span className="topic-toggle-track" aria-hidden="true">
        <span />
      </span>
      <span>{active ? "Aktiv" : "Inaktiv"}</span>
    </button>
  );
}
