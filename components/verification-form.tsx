"use client"

import { FormEvent, useState } from "react"
import { confirmVerification, requestVerification } from "@/lib/backend-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  onToken: (token: string) => void
}

type Step = "email" | "code" | "done"

export function VerificationForm({ onToken }: Props) {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const message = await requestVerification(email.trim())
      setStatusMessage(message)
      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request verification")
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { affiliation_token } = await confirmVerification(code.trim())
      onToken(affiliation_token)
      setStatusMessage("Verified. You can now submit reports.")
      setStep("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Schritt 1</p>
        <h2 className="text-xl font-semibold text-slate-900">Verify hospital email</h2>
        <p className="text-sm text-slate-600">We never store the email address; only the hashed affiliation token.</p>
      </header>

      {statusMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{statusMessage}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Hospital email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="name@hospital.de"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Send verification email"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleCodeSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter the code from your email"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>
      )}

      {step === "done" && (
        <p className="text-sm text-slate-600">Verification complete. Continue with data ingestion below.</p>
      )}
    </section>
  )
}

