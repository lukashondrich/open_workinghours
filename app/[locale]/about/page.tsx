import { getTranslations } from 'next-intl/server';

const problemIssueKeys = ['fatigue', 'compliance', 'research', 'patients'] as const;
const solutionStepKeys = ['verification', 'shiftEntry', 'tracking', 'review'] as const;
const howItWorksKeys = ['architecture', 'mobile', 'privacy', 'api', 'contributions'] as const;
const whyItMattersKeys = ['staff', 'hospitals', 'researchers', 'patients'] as const;
const statusFeatureKeys = ['verification', 'dashboard', 'workflows', 'mobile'] as const;
const statusNeedKeys = ['developers', 'partners'] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  const problemIssues = problemIssueKeys.map((key) => ({
    key,
    text: t(`problem.issues.${key}`)
  }));
  const solutionSteps = solutionStepKeys.map((key) => ({
    title: t(`solution.steps.${key}`),
    description: t(`solution.steps.${key}Desc`)
  }));
  const howItWorksItems = howItWorksKeys.map((key) => ({
    key,
    text: t(`howItWorks.features.${key}`)
  }));
  const whyItMattersItems = whyItMattersKeys.map((key) => ({
    key,
    text: t(`whyItMatters.benefits.${key}`)
  }));
  const statusFeatures = statusFeatureKeys.map((key) => ({
    key,
    text: t(`status.features.${key}`)
  }));
  const statusNeeds = statusNeedKeys.map((key) => ({
    key,
    text: t(`status.needs.${key}`)
  }));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-12 text-slate-600">
        <section className="space-y-4">
          <h2 className="text-2xl font-medium text-slate-900">{t('problem.title')}</h2>
          <p className="font-light leading-relaxed">{t('problem.intro')}</p>
          <p className="font-medium text-slate-700">{t('problem.withoutData')}</p>
          <ul className="space-y-2.5 pl-6 text-[15px] leading-relaxed">
            {problemIssues.map(({ key, text }) => (
              <li key={key} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                {text}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 pt-2">{t('problem.conclusion')}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-medium text-slate-900">{t('solution.title')}</h2>
          <p className="font-light leading-relaxed">{t('solution.intro')}</p>
          <ul className="space-y-3 pl-6 text-[15px] leading-relaxed">
            {solutionSteps.map((step) => (
              <li key={step.title} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                <strong className="font-medium text-slate-700">{step.title}</strong> - {step.description}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 pt-2">{t('solution.result')}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-medium text-slate-900">{t('howItWorks.title')}</h2>
          <p className="font-light leading-relaxed">{t('howItWorks.intro')}</p>
          <ul className="space-y-2.5 pl-6 text-[15px] leading-relaxed">
            {howItWorksItems.map(({ key, text }) => (
              <li key={key} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-medium text-slate-900">{t('whyItMatters.title')}</h2>
          <p className="font-light leading-relaxed">{t('whyItMatters.intro')}</p>
          <ul className="space-y-2.5 pl-6 text-[15px] leading-relaxed">
            {whyItMattersItems.map(({ key, text }) => (
              <li key={key} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                {text}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 pt-2">{t('whyItMatters.conclusion')}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-medium text-slate-900">{t('status.title')}</h2>
          <p className="font-light leading-relaxed">{t('status.intro')}</p>
          <ul className="space-y-2.5 pl-6 text-[15px] leading-relaxed">
            {statusFeatures.map(({ key, text }) => (
              <li key={key} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                {text}
              </li>
            ))}
          </ul>
          <p className="font-medium text-slate-700 mt-6">{t('status.seeking')}</p>
          <ul className="space-y-2.5 pl-6 text-[15px] leading-relaxed">
            {statusNeeds.map(({ key, text }) => (
              <li key={key} className="relative before:content-['–'] before:absolute before:-left-6 before:text-slate-300">
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-medium text-slate-900">{t('getInvolved.title')}</h2>
          <p className="font-light leading-relaxed">
            <strong className="font-medium text-slate-700">{t('getInvolved.developers')}</strong>
            <br />
            {t('getInvolved.contribute')}{' '}
            <a
              href="https://github.com/lukashondrich/open_workinghours"
              className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-900 transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              {t('getInvolved.github')}
            </a>
          </p>
        </section>
      </div>
    </main>
  )
}
