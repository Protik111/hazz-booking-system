"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const TYPE_OPTIONS = [
  { value: "HAJJ", label: "Hajj" },
  { value: "RAMADAN_UMRAH", label: "Ramadan Umrah" },
  { value: "OFF_SEASON_UMRAH", label: "Off-Season Umrah" },
  { value: "ZIYARAH", label: "Ziyarah" },
];

export default function PackageFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "";
  const currentFrom = searchParams.get("departure_from") ?? "";
  const currentTo = searchParams.get("departure_to") ?? "";

  function update(value: string, key: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    router.push(`/packages?${sp.toString()}`);
  }

  function clearAll() {
    router.push("/packages");
  }

  const hasFilters = Boolean(currentType || currentFrom || currentTo);

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4">
      <div className="w-full sm:w-48">
        <Select
          id="type-filter"
          label="Package type"
          value={currentType}
          onChange={(e) => update(e.target.value, "type")}
          options={TYPE_OPTIONS}
          placeholder="All types"
        />
      </div>
      <div className="w-full sm:w-44">
        <Input
          id="from-filter"
          type="date"
          label="Departure from"
          value={currentFrom}
          onChange={(e) => update(e.target.value, "departure_from")}
        />
      </div>
      <div className="w-full sm:w-44">
        <Input
          id="to-filter"
          type="date"
          label="Departure to"
          value={currentTo}
          onChange={(e) => update(e.target.value, "departure_to")}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear
        </Button>
      )}
    </div>
  );
}