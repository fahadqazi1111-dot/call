import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Mail,
  Bug,
  Lightbulb,
  Briefcase,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { LegalLayout, LegalSection, LegalList, LegalItem, LegalCallout } from '../LegalLayout'

export const metadata: Metadata = {
  title: 'Contact and Support — CALL',
  description:
    'How to get help with CALL — support email, response times, bug reports, feature requests, business inquiries and our support hours.',
}

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'support', label: 'Support email' },
  { id: 'response-times', label: 'Response times' },
  { id: 'bugs', label: 'Bug reports' },
  { id: 'features', label: 'Feature requests' },
  { id: 'business', label: 'Business inquiries' },
  { id: 'safety', label: 'Safety & moderation' },
  { id: 'hours', label: 'Support hours' },
  { id: 'address', label: 'Mailing address' },
]

const CHANNELS = [
  {
    icon: Mail,
    title: 'General support',
    desc:
      'Account access, sign-in problems, payment or wallet issues, calls & chats not working, app crashes.',
    contact: 'fahadqazi1111@gmail.com',
    href: 'mailto:fahadqazi1111@gmail.com',
  },
  {
    icon: Bug,
    title: 'Bug reports',
    desc:
      'Something broken in calls, messages, stories, voice rooms, live, gifts or wallet? Send us steps to reproduce.',
    contact: 'fahadqazi1111@gmail.com',
    href: 'mailto:fahadqazi1111@gmail.com',
  },
  {
    icon: Lightbulb,
    title: 'Feature requests',
    desc:
      'Ideas to improve CALL — new call effects, gift animations, wallet features, AI assistant behaviour.',
    contact: 'fahadqazi1111@gmail.com',
    href: 'mailto:fahadqazi1111@gmail.com',
  },
  {
    icon: Briefcase,
    title: 'Business inquiries',
    desc:
      'Partnerships, advertising packages, integration opportunities, press, legal notices.',
    contact: 'fahadqazi1111@gmail.com',
    href: 'mailto:fahadqazi1111@gmail.com',
  },
] as const

export default function ContactPage() {
  return (
    <LegalLayout
      title="Contact and Support"
      intro="We are here to help. This page lists every way you can reach the CALL team, what to expect when you contact us, and where to go for urgent safety issues."
      toc={TOC}
    >
      <LegalSection id="overview" title="Overview">
        <p>
          CALL is a small team building global calls, chats, stories, voice
          rooms, live video, gifts and a wallet — without borders. We read
          every message you send us. To help us help you quickly, please
          include your username or the email / phone number on your account
          when you write in.
        </p>
      </LegalSection>

      <LegalSection id="support" title="Support email">
        <p>
          For all support matters — sign-in trouble, account recovery,
          wallet and payments, calls not connecting, app crashes — email
          our team at{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>
          .
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={c.href}
              className="group rounded-xl border border-cline bg-white p-4 transition-all hover:border-cbrand/40 hover:shadow-[0_4px_14px_rgba(47,91,234,0.08)]"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-csoft text-cbrand">
                <c.icon size={18} />
              </div>
              <p className="text-[14px] font-semibold text-cink">{c.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-cmut">
                {c.desc}
              </p>
              <p className="mt-2 text-[12.5px] font-medium text-cbrand group-hover:underline">
                {c.contact}
              </p>
            </a>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="response-times" title="Response time expectations">
        <p>
          We aim to respond to every verified request as quickly as
          possible. Typical response windows:
        </p>
        <LegalList>
          <LegalItem>
            Account access issues (can&apos;t sign in, lost device): within 24 hours.
          </LegalItem>
          <LegalItem>
            Wallet &amp; payment issues (failed top-up, missing withdrawal,
            gift dispute): within 2 business days.
          </LegalItem>
          <LegalItem>
            General bug reports and feature requests: within 5 business
            days.
          </LegalItem>
          <LegalItem>
            Privacy and data-protection requests (access, deletion,
            export): within 30 days, as required by applicable law.
          </LegalItem>
          <LegalItem>
            Business and partnership inquiries: within 5 business days.
          </LegalItem>
        </LegalList>
        <p>
          Response times may be longer during public holidays. If your
          request is urgent, mark the email subject with{' '}
          <span className="font-medium">[URGENT]</span> and a short reason.
        </p>
      </LegalSection>

      <LegalSection id="bugs" title="Reporting a bug">
        <p>
          The more detail you give us, the faster we can fix it. A good bug
          report includes:
        </p>
        <LegalList>
          <LegalItem>
            Your device (e.g. iPhone 13, Samsung Galaxy S22, Chrome on
            Windows 11).
          </LegalItem>
          <LegalItem>
            The CALL app version (shown in Profile → Settings → About).
          </LegalItem>
          <LegalItem>
            What you expected to happen, and what actually happened.
          </LegalItem>
          <LegalItem>
            Step-by-step instructions to reproduce the issue.
          </LegalItem>
          <LegalItem>
            A screenshot or short screen recording, if possible.
          </LegalItem>
          <LegalItem>
            The username or phone number of any other account involved.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="features" title="Feature requests">
        <p>
          We love hearing how CALL could be better. Send us your ideas for
          calls, chats, stories, voice rooms, live video, gifts, the
          wallet or the AI assistant. We cannot commit to building every
          request, but we log and prioritise the most popular ones.
        </p>
      </LegalSection>

      <LegalSection id="business" title="Business inquiries">
        <p>
          For partnerships, advertising packages, integration
          opportunities, press inquiries, or formal legal notices, email{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          with the subject &quot;Business&quot; or &quot;Legal&quot; as
          appropriate.
        </p>
      </LegalSection>

      <LegalSection id="safety" title="Safety and moderation">
        <LegalCallout title="In immediate danger?">
          <p>
            If you believe someone is in immediate physical danger,
            contact your local emergency services first, then report the
            incident to CALL through the in-app report button or by email.
          </p>
        </LegalCallout>
        <p>
          For harassment, hate speech, illegal content, or wallet/gift
          fraud, use the in-app report button next to the offending
          content or profile — that is the fastest path to our moderation
          team. You can read how we handle reports in our{' '}
          <Link
            href="/legal/community"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Community Guidelines
          </Link>
          .
        </p>
        <p>
          For privacy or data-protection questions specifically, see our{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="hours" title="Support hours">
        <p>
          <span className="inline-flex items-center gap-2 align-middle">
            <Clock size={16} className="text-cbrand" />
            <span className="font-medium text-cink">
              Monday – Friday, 09:00 – 18:00 (UTC+05:00)
            </span>
          </span>
        </p>
        <p>
          Emails received outside these hours are read on the next business
          day. The CALL app itself runs 24/7; urgent safety reports are
          reviewed as soon as a moderator is on shift.
        </p>
        <p>
          <ShieldAlert size={16} className="mr-1.5 inline align-middle text-cbrand" />
          For critical account or wallet security issues (suspected
          hijack, fraudulent payment), mark your email{' '}
          <span className="font-medium">[URGENT]</span>.
        </p>
      </LegalSection>

      <LegalSection id="address" title="Mailing address">
        <p>
          For formal notices that require a postal address, please write to:
        </p>
        <div className="rounded-xl border border-cline bg-white p-4 text-[14.5px] leading-relaxed text-cink">
          <p className="font-semibold">CALL — Support Team</p>
          <p>c/o Legal &amp; Compliance</p>
          <p>[Registered business address on file]</p>
          <p className="mt-1 text-cmut">
            To request the exact registered address for a specific legal
            notice, email{' '}
            <Link
              href="mailto:fahadqazi1111@gmail.com"
              className="font-medium text-cbrand underline-offset-2 hover:underline"
            >
              fahadqazi1111@gmail.com
            </Link>
            .
          </p>
        </div>
        <p>
          We recommend contacting us by email first — most issues are
          resolved without needing to send physical mail.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
