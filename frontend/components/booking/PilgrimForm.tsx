"use client";

import Input from "@/components/ui/Input";
import AppSelect from "@/components/ui/AppSelect";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";

export interface PilgrimFormData {
  full_name: string;
  date_of_birth: string;
  gender: "MALE" | "FEMALE";
  nationality: string;
  passport_number: string;
  passport_issue_date: string;
  passport_expiry_date: string;
  phone: string;
  email: string;
}

export const emptyPilgrim = (): PilgrimFormData => ({
  full_name: "",
  date_of_birth: "",
  gender: "MALE",
  nationality: "Bangladeshi",
  passport_number: "",
  passport_issue_date: "",
  passport_expiry_date: "",
  phone: "",
  email: "",
});

interface PilgrimFormProps {
  index: number;
  data: PilgrimFormData;
  errors?: Partial<Record<keyof PilgrimFormData, string>>;
  onChange: (next: PilgrimFormData) => void;
  onRemove?: () => void;
  removable?: boolean;
}

export default function PilgrimForm({
  index,
  data,
  errors,
  onChange,
  onRemove,
  removable,
}: PilgrimFormProps) {
  function update<K extends keyof PilgrimFormData>(
    key: K,
    value: PilgrimFormData[K],
  ) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div className="rounded-card border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-default font-semibold text-text">
          Pilgrim #{index + 1}
        </h3>
        {removable && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`p-${index}-name`}
          label="Full name"
          value={data.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          error={errors?.full_name}
          placeholder="As on passport"
          required
        />
        <DatePicker
          label="Date of birth"
          value={data.date_of_birth}
          onChange={(v) => update("date_of_birth", v)}
          error={errors?.date_of_birth}
        />
        <AppSelect
          label="Gender"
          value={data.gender}
          onValueChange={(v) => update("gender", v as "MALE" | "FEMALE")}
          options={[
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
          ]}
        />
        <Input
          id={`p-${index}-nationality`}
          label="Nationality"
          value={data.nationality}
          onChange={(e) => update("nationality", e.target.value)}
          error={errors?.nationality}
          placeholder="Bangladeshi"
          required
        />
        <Input
          id={`p-${index}-passport`}
          label="Passport number"
          value={data.passport_number}
          onChange={(e) => update("passport_number", e.target.value)}
          error={errors?.passport_number}
          placeholder="A1234567"
          required
        />
        <DatePicker
          label="Passport issue date"
          value={data.passport_issue_date}
          onChange={(v) => update("passport_issue_date", v)}
        />
        <DatePicker
          label="Passport expiry date"
          value={data.passport_expiry_date}
          onChange={(v) => update("passport_expiry_date", v)}
          hint="Must be valid for the entire trip"
        />
        <Input
          id={`p-${index}-phone`}
          type="tel"
          label="Phone (optional)"
          value={data.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+8801XXXXXXXXX"
        />
      </div>
    </div>
  );
}
