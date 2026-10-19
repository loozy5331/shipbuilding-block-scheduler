interface Props {
  /** 버튼·입력의 접근성 이름 */
  label: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  onChange(v: number): void;
}

/** − 값 + 단위. 이름은 바깥(목록의 왼쪽 칸)에 둔다. */
export function Stepper({ label, unit, value, min = 0, max = 999, onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <span className="stepper-ctrl">
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
    </span>
  );
}
