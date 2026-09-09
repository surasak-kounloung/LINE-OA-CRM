import { errorFor } from "../utils";

export default function FieldError({ errors, path }) {
  const msg = errorFor(errors, path);
  return msg ? <div className="field-error">{msg}</div> : null;
}
