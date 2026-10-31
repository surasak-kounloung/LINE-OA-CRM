import { errorsFor } from "../utils";

export default function FieldError({ errors, path }) {
  const messages = errorsFor(errors, path);
  if (!messages.length) return null;
  return (
    <div className="field-error">
      {messages.map((m, i) => <div key={i}>{m}</div>)}
    </div>
  );
}
