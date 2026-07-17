"use client";

import { Icon } from "../studio/Icons";

type Row = { key: string; value: string };

export function KeyValueEditor({ value, keyPlaceholder = "Key", valuePlaceholder = "Value", onChange }: {
  value: Record<string, string>;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onChange: (value: Record<string, string>) => void;
}) {
  const rows: Row[] = [...Object.entries(value).map(([key, rowValue]) => ({ key, value: rowValue })), { key: "", value: "" }];
  const commit = (next: Row[]) => onChange(Object.fromEntries(next.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])));
  return <div className="kv-editor">
    <div className="kv-head"><span>Key</span><span>Value</span><span/></div>
    {rows.map((row, index) => <div className="kv-row" key={`${index}-${index === rows.length - 1 ? "new" : row.key}`}>
      <input placeholder={keyPlaceholder} value={row.key} onChange={(event) => { const next = [...rows]; next[index] = { ...row, key: event.target.value }; commit(next); }}/>
      <input placeholder={valuePlaceholder} value={row.value} onChange={(event) => { const next = [...rows]; next[index] = { ...row, value: event.target.value }; commit(next); }}/>
      <button className="icon-button subtle-danger" disabled={index === rows.length - 1} aria-label="Zeile löschen" onClick={() => commit(rows.filter((_, rowIndex) => rowIndex !== index))}><Icon name="trash"/></button>
    </div>)}
  </div>;
}
