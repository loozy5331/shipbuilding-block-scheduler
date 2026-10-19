interface Props {
  label: string;
  hint?: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  onChange(v: number): void;
}

export function Stepper({ label, hint, unit, value, min = 0, max = 999, onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <div className="stepper-label">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <div className="stepper-ctrl">
        <button type="button" aria-label={`${label} 줄이기`} onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>
          −
        </button>
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(clamp(v));
          }}
        />
        <button type="button" aria-label={`${label} 늘리기`} onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>
          +
        </button>
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}
