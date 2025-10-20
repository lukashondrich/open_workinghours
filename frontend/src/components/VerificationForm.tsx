import { FormEvent, useState } from "react";

import { confirmVerification, requestVerification } from "../lib/api";

interface Props {
  onToken: (token: string) => void;
}

type Step = "email" | "code" | "done";

export function VerificationForm({ onToken }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const message = await requestVerification(email.trim());
      setStatusMessage(message);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request verification");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { affiliation_token } = await confirmVerification(code.trim());
      onToken(affiliation_token);
      setStatusMessage("Verified. You can now submit reports.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Verify Hospital Email</h2>
      {statusMessage && <p>{statusMessage}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {step === "email" && (
        <form onSubmit={handleEmailSubmit}>
          <label htmlFor="email">Hospital Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="name@hospital.de"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send verification email"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleCodeSubmit}>
          <label htmlFor="code">Verification Code</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            placeholder="Enter the code from your email"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </section>
  );
}
