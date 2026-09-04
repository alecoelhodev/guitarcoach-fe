import { Checkbox, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';

export type ChecklistRowProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

/**
 * Canvas 1g's "task checklist row" — a `.tick` box beside its label. Completed rows
 * strike the label through and drop it to neutral-700 (canvas 07 and 09).
 */
export function ChecklistRow({ label, checked, onToggle }: ChecklistRowProps) {
  return (
    <Checkbox
      value={label}
      isChecked={checked}
      onChange={onToggle}
      accessibilityLabel={label}
      className="py-2"
    >
      <CheckboxIndicator />
      <CheckboxLabel className={checked ? 'line-through text-neutral-700' : undefined}>
        {label}
      </CheckboxLabel>
    </Checkbox>
  );
}
