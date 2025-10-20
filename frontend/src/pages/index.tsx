import Head from "next/head";
import Link from "next/link";

import { ReportForm } from "../components/ReportForm";
import { VerificationForm } from "../components/VerificationForm";
import { useAffiliationToken } from "../hooks/useAffiliationToken";

export default function Home() {
  const { token, saveToken, clearToken } = useAffiliationToken();

  return (
    <>
      <Head>
        <title>Open Working Hours</title>
        <meta name="description" content="Anonymous physician working-hours reporting" />
      </Head>

      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem", lineHeight: 1.6 }}>
        <header>
          <h1>Open Working Hours</h1>
          <p>
            Verify your hospital affiliation once, then submit anonymised reports of worked hours. We only publish
            aggregated data and never store your email address.
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            <Link href="/dashboard">Zu den aggregierten Auswertungen</Link>
          </p>
        </header>

        {!token && <VerificationForm onToken={saveToken} />}

        {token && <ReportForm token={token} onLogout={clearToken} />}
      </main>
    </>
  );
}
