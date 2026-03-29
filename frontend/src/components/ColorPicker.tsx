interface Props {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

export default function ColorPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5"
      />
      <span className="text-sm text-gray-500 font-mono">{value}</span>
    </div>
  )
}
