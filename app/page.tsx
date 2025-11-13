import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/verify", label: "Email Verification" },
  { href: "/data-ingestion", label: "Data Ingestion" },
  { href: "/public-dashboard", label: "Public Dashboard" },
  { href: "/calendar", label: "Review Calendar" }
]

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-12">
        <section className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Open Working Hours</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
            Verification, ingestion and review in one workspace
          </h1>
          <p className="text-slate-600 text-lg">
            Placeholder home/about page. Use the navigation or cards below to jump into the individual flows.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-5 py-4 shadow-sm transition hover:border-slate-400 hover:shadow"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{link.label}</p>
                <p className="text-xs text-slate-500">Open {link.label.toLowerCase()}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900" />
            </Link>
          ))}
        </section>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild>
            <Link href="/verify">Get verified</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/calendar">Open calendar</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

