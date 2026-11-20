import Link from 'next/link'
import type { Metadata } from 'next'
import {
  LegalLayout,
  LegalSection,
  LegalList,
  LegalItem,
  LegalCallout,
} from '../LegalLayout'

export const metadata: Metadata = {
  title: 'Cookie Policy — CALL',
  description:
    'How and why CALL uses cookies, local storage and session storage to keep you signed in and to remember your preferences.',
}

const TOC = [
  { id: 'what', label: 'What are cookies' },
  { id: 'types', label: 'Types of cookies we use' },
  { id: 'storage', label: 'Local & session storage' },
  { id: 'third-party', label: 'Third-party cookies' },
  { id: 'manage', label: 'How to manage cookies' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact' },
]

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      intro="This Cookie Policy explains how CALL uses cookies and similar browser storage technologies (local storage and session storage) when you visit our web app, and how you can control them."
      toc={TOC}
    >
      <LegalSection id="what" title="What are cookies and similar technologies">
        <p>
          A cookie is a small text file placed on your device by a website.
          Cookies allow a service to remember things about your visit — for
          example that you are already signed in, or which theme you prefer.
          CALL also uses two closely related browser technologies for the same
          purpose: <span className="font-medium">localStorage</span>, which
          persists until you clear it, and{' '}
          <span className="font-medium">sessionStorage</span>, which is
          cleared when the tab or window is closed. In this policy, the word
          &quot;cookies&quot; covers all three unless we say otherwise.
        </p>
        <p>
          The CALL mobile applications (iOS and Android) do not use browser
          cookies. They use the platform&apos;s secure storage (Keychain /
          Keystore) to achieve the equivalent effect; this policy applies
          primarily to the CALL web app.
        </p>
      </LegalSection>

      <LegalSection id="types" title="Types of cookies we use">
        <p>We use four categories of cookies:</p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Strictly necessary cookies</span> —
            required for the CALL web app to function at all. They let you
            sign in, stay signed in across reloads, and load balanced content
            (for example, the right chat room). These cannot be turned off
            without breaking the service.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">
              Authentication &amp; security cookies / tokens
            </span>{' '}
            — store your signed-in session and CSRF / anti-fraud tokens. We
            use these to verify that requests to CALL are genuinely coming
            from you, and to detect session hijacking or abnormal access
            patterns.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Preference cookies</span> — remember
            choices you make on CALL, such as theme (light / dark),
            language, the country dial code you selected last time, and
            whether you have dismissed an onboarding banner.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">
              Analytics &amp; performance cookies
            </span>{' '}
            — used by our analytics provider to understand in aggregate how
            the web app is used (for example, which pages load slowly). These
            are pseudonymised, never tied to your identity for marketing, and
            can be disabled.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="storage" title="Local and session storage usage">
        <p>
          On the CALL web app, we store the following items in browser
          storage so you do not have to re-enter them every time you load the
          page:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Authentication token</span>{' '}
            (localStorage) — your signed-in session token, used to
            authenticate API requests until it expires or you sign out. We
            do not store your password in browser storage.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">User profile snapshot</span>{' '}
            (localStorage) — your user-id, display name and avatar URL, used
            to render the UI quickly before fetching your profile from the
            server.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">UI preferences</span> (localStorage)
            — theme, language, country dial code, tab order, and
            feature-tour completion state.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">In-flight call &amp; chat state</span>{' '}
            (sessionStorage) — transient state used during an active call or
            chat session, cleared automatically when the tab closes.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Splash / boot flag</span>{' '}
            (localStorage) — a small flag used by the bootstrap script to
            avoid an unnecessary splash screen on subsequent loads.
          </LegalItem>
        </LegalList>
        <p>
          You can clear any of the above at any time by signing out, by
          clearing your browser data, or by deleting your account.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="Third-party cookies">
        <p>
          CALL keeps third-party cookies to a minimum. The third parties that
          may set or read cookies when you use CALL are:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Identity providers</span> (for
            example Google Sign-In) — used when you choose to sign in with
            that provider, and only to verify your identity. The provider
            sets its own cookies under its own domain and its own policy.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Payment processors</span> — when
            you top up your wallet or withdraw funds, the payment page may be
            operated by the processor under their own domain, and their
            cookies apply. CALL does not control these cookies.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Analytics provider</span> — for
            aggregated, pseudonymised performance analytics on the web app, as
            described above.
          </LegalItem>
        </LegalList>
        <p>
          We do not allow advertising networks to set cookies on the CALL
          web app for the purpose of tracking you across other sites.
        </p>
      </LegalSection>

      <LegalSection id="manage" title="How to manage and delete cookies">
        <LegalCallout title="You are in control">
          <p>
            Most browsers let you view, block, or delete cookies. If you
            disable strictly-necessary cookies, parts of CALL (including
            signing in) will stop working. Disabling preference cookies will
            not break the app but CALL will not remember your choices
            between visits.
          </p>
        </LegalCallout>
        <p>
          To manage cookies in your browser, use the relevant official guide:
        </p>
        <LegalList>
          <LegalItem>
            Chrome: Settings → Privacy and security → Cookies and other site
            data.
          </LegalItem>
          <LegalItem>
            Safari: Preferences → Privacy → Manage Website Data.
          </LegalItem>
          <LegalItem>
            Firefox: Settings → Privacy &amp; Security → Cookies and Site
            Data.
          </LegalItem>
          <LegalItem>
            Edge: Settings → Cookies and site permissions.
          </LegalItem>
        </LegalList>
        <p>
          To clear local and session storage, you can use your
          browser&apos;s &quot;clear browsing data&quot; option (look for
          &quot;Site data&quot; or &quot;Cookies and other site data&quot;),
          or simply sign out of CALL.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We may update this Cookie Policy from time to time. The &quot;Last
          updated&quot; date at the top of this page reflects the most recent
          revision. Significant changes will be communicated through the app
          or by email.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about cookies on CALL? Email us at{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>
          . For broader privacy questions, see our{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
