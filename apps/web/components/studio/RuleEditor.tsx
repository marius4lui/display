"use client";

import type { ConditionalRule, RuleOperator } from "../../lib/dashboard";
import { Icon } from "./Icons";

const operators: Array<{ value: RuleOperator; label: string }> = [
  { value: ">", label: "größer als" },
  { value: ">=", label: "größer/gleich" },
  { value: "<", label: "kleiner als" },
  { value: "<=", label: "kleiner/gleich" },
  { value: "=", label: "ist gleich" },
  { value: "!=", label: "ist nicht gleich" },
  { value: "contains", label: "enthält" },
  { value: "exists", label: "ist vorhanden" },
];

export function RuleEditor({ rules, onChange }: { rules: ConditionalRule[]; onChange: (rules: ConditionalRule[]) => void }) {
  const patch = (index: number, value: Partial<ConditionalRule>) =>
    onChange(rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...value } : rule));

  return <div className="rule-editor">
    {rules.length === 0 && <div className="section-empty">Noch keine Regeln. Regeln werden von oben nach unten ausgewertet.</div>}
    {rules.map((rule, index) => <article className="rule-row" key={index}>
      <div className="rule-order">{index + 1}</div>
      <div className="rule-fields">
        <div className="control-pair">
          <label>Wenn Wert
            <select value={rule.operator} onChange={(event) => patch(index, { operator: event.target.value as RuleOperator })}>
              {operators.map((operator) => <option value={operator.value} key={operator.value}>{operator.label}</option>)}
            </select>
          </label>
          {rule.operator !== "exists" && <label>Vergleich
            <input value={rule.value ?? ""} onChange={(event) => patch(index, { value: event.target.value })}/>
          </label>}
        </div>
        <label>Ersatzanzeige
          <input placeholder="Optionaler Text" value={rule.text ?? ""} onChange={(event) => patch(index, { text: event.target.value || undefined })}/>
        </label>
        <div className="rule-colors">
          {([
            ["background", "Fläche", "#151b2b"],
            ["foreground", "Text", "#f6f7fb"],
            ["accent", "Akzent", "#7c5cff"],
          ] as const).map(([key, label, fallback]) => <label key={key} title={label}>
            <input type="color" value={rule[key] ?? fallback} onChange={(event) => patch(index, { [key]: event.target.value })}/>
            <span>{label}</span>
          </label>)}
          <label className="rule-icon">Icon
            <input placeholder="Optional" value={rule.icon ?? ""} onChange={(event) => patch(index, { icon: event.target.value || undefined })}/>
          </label>
        </div>
      </div>
      <button className="icon-button subtle-danger" aria-label={`Regel ${index + 1} löschen`} onClick={() => onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}><Icon name="trash"/></button>
    </article>)}
    <button className="secondary-button rule-add" onClick={() => onChange([...rules, { operator: ">", value: "" }])}><Icon name="plus"/> Regel hinzufügen</button>
    {rules.length > 0 && <div className="rule-preview"><span>Vorschau</span><div style={{ background: rules[0].background ?? "#151b2b", color: rules[0].foreground ?? "#f6f7fb", borderColor: rules[0].accent ?? "#7c5cff" }}>{rules[0].icon} {rules[0].text || "Beispielwert"}</div></div>}
    <details className="raw-rules">
      <summary>Raw JSON</summary>
      <textarea readOnly spellCheck={false} value={JSON.stringify(rules, null, 2)}/>
    </details>
  </div>;
}
