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
  title: 'Privacy Policy — CALL',
  description:
    'How CALL collects, uses, stores and protects your personal information across calls, chats, stories, gifts and wallet features.',
}

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use-it', label: 'How we use it' },
  { id: 'legal-basis', label: 'Legal basis for processing' },
  { id: 'third-parties', label: 'Third-party services' },
  { id: 'retention', label: 'Data retention' },
  { id: 'your-rights', label: 'Your rights' },
  { id: 'children', label: "Children's privacy" },
  { id: 'security', label: 'Security' },
  { id: 'international', label: 'International transfers' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact us' },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="Your privacy matters to us. This policy explains what CALL collects, why we collect it, how long we keep it, and the choices you have over your data."
      toc={TOC}
    >
      <LegalSection id="overview" title="Overview">
        <p>
          CALL (&quot;Calls &amp; chats without borders&quot;) is a communication
          app that offers voice calls, video calls, text messaging, voice notes,
          stories, voice rooms, live video, group chats, an AI assistant, virtual
          gifts, and a wallet for storing and transferring small balances of
          digital value. The service is operated by CALL and is reachable at{' '}
          <span className="font-medium text-cink">
            snappy-lemonchiffon-pelican-51.hostingersite.com
          </span>
          .
        </p>
        <p>
          This Privacy Policy applies to the CALL mobile applications (iOS and
          Android) and the CALL web app. It does not apply to third-party
          services that CALL may link to but does not control.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="Information we collect">
        <p>
          To deliver the features above, we process the following categories of
          personal information:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Account information</span> — your
            email address, phone number, the display name you choose, and your
            profile picture. When you sign up with Google, we receive the
            email and profile details Google shares with us.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Contacts (optional)</span> — if you
            explicitly enable contact syncing, CALL processes your
            device&apos;s address book to help you find friends already on
            CALL and to invite others. You can disable contact sync at any
            time in Profile → Settings.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Messages and call content</span> —
            text messages, voice notes, and media you share in chats or group
            chats, plus metadata about your calls (caller, callee, start
            time, duration, connection quality). Where technically possible,
            call media are transmitted peer-to-peer; call metadata is logged
            for billing, abuse prevention, and quality assurance.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Stories and live content</span> —
            images, video and text you publish as a story or broadcast in a
            live video session, along with view and reaction metadata.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Wallet and transaction data</span> —
            your wallet balance, top-up history, withdrawals, gifts sent and
            received, and the bank or card details you provide to our payment
            processor when topping up or withdrawing funds.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">AI assistant data</span> — prompts,
            voice transcripts, and images you submit to CALL&apos;s AI
            assistant features, plus the assistant&apos;s responses, kept
            under your account for continuity of your conversations.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Device and usage data</span> —
            device model, operating system, app version, language, IP
            address, approximate location (derived from IP), and crash /
            analytics events used to improve stability and performance.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Device permissions</span> — access
            to your camera, microphone and photo library, granted by you
            through the operating system, used only to capture call media
            and share photos. You can revoke any of these permissions in your
            device settings at any time.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="how-we-use-it" title="How we use your information">
        <p>We process your data only for the following purposes:</p>
        <LegalList>
          <LegalItem>
            To create and authenticate your account, restore your account on
            a new device, and prevent unauthorized access.
          </LegalItem>
          <LegalItem>
            To connect your calls, chats, group chats, voice rooms and live
            sessions between the right participants.
          </LegalItem>
          <LegalItem>
            To deliver, route and store your messages, voice notes, stories
            and shared media.
          </LegalItem>
          <LegalItem>
            To operate the wallet: to credit top-ups, process withdrawals,
            record gift transfers, and detect fraud.
          </LegalItem>
          <LegalItem>
            To power AI assistant features (text, voice and image
            understanding) by sending your prompts to our AI provider, and
            to keep a history of your AI conversations under your account.
          </LegalItem>
          <LegalItem>
            To detect, investigate and prevent abuse, spam, fraud, harassment
            and other violations of our Community Guidelines.
          </LegalItem>
          <LegalItem>
            To communicate with you about your account, security alerts,
            product changes, and (where permitted) promotional offers you can
            opt out of.
          </LegalItem>
          <LegalItem>
            To improve CALL — for example by analyzing aggregated,
            de-identified usage patterns to fix bugs and prioritise features.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="legal-basis" title="Legal basis for processing">
        <p>
          If you are located in the European Economic Area, the United Kingdom
          or another jurisdiction with a GDPR-style privacy regime, we rely on
          the following legal bases:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Performance of a contract</span> —
            for the data needed to set up and operate your account, run calls,
            chats and the wallet.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Consent</span> — for contact syncing,
            AI assistant features on sensitive inputs, and any marketing
            communications.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Legal obligation</span> — for
            record-keeping of financial transactions and responding to lawful
            requests from authorities.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Legitimate interests</span> — for
            security, fraud prevention and product improvement, balanced
            against your reasonable expectations of privacy.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="third-parties" title="Third-party services">
        <p>
          CALL relies on the following categories of third-party providers to
          deliver the service. Each provider processes data only under their
          own privacy policy and only to the extent necessary to provide the
          contracted service to CALL:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">AI providers</span> — used to power
            the CALL AI assistant (text, voice transcription, image
            understanding). Prompts you submit to the assistant may be
            transmitted to the provider for the sole purpose of generating
            your response. We do not allow our AI providers to train their
            general-purpose models on your CALL conversations.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Payment processors</span> — used to
            handle wallet top-ups and withdrawals. Card and bank details are
            collected directly by the processor in their secure environment;
            CALL never sees or stores your full card number.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Cloud infrastructure &amp; storage
            </span> — used to host the CALL backend, store media and backups,
            and deliver push notifications.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Identity &amp; sign-in providers
            </span> — for example Google Sign-In, used to verify the email you
            own.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Analytics &amp; crash reporting
            </span> — used to monitor app stability and aggregate usage
            trends.
          </LegalItem>
        </LegalList>
        <p>
          We never sell your personal data, and we never share your contact
          list with third parties for marketing.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="Data retention">
        <p>We keep your data only as long as necessary:</p>
        <LegalList>
          <LegalItem>
            Account data is retained while your account is active and is
            deleted when you delete your account (see the Account Deletion
            Policy).
          </LegalItem>
          <LegalItem>
            Chat messages, voice notes, stories and call media are stored for
            as long as your account exists so that you can access them across
            devices, and then deleted with your account.
          </LegalItem>
          <LegalItem>
            Wallet and gift transaction records are retained for up to 7
            years in anonymized or aggregated form where required by tax and
            anti-money-laundering regulations; the link to your identity is
            removed as soon as legally permitted.
          </LegalItem>
          <LegalItem>
            Server logs and security audit trails are kept for up to 12
            months.
          </LegalItem>
          <LegalItem>
            AI assistant conversation history under your account is deleted
            together with your account unless you delete individual
            conversations earlier.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="your-rights" title="Your rights">
        <p>Depending on where you live, you may have the right to:</p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Access</span> — request a copy of
            the personal data we hold about you.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Rectification</span> — correct
            inaccurate or incomplete data.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Erasure</span> — delete your account
            and associated data. You can do this directly in{' '}
            <span className="font-medium">
              Profile → Settings → Delete My Account
            </span>
            , or by emailing{' '}
            <Link
              href="mailto:fahadqazi1111@gmail.com"
              className="font-medium text-cbrand underline-offset-2 hover:underline"
            >
              fahadqazi1111@gmail.com
            </Link>
            .
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Portability</span> — receive the
            data you provided to CALL in a structured, machine-readable
            format.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Objection &amp; restriction</span>{' '}
            — object to or limit certain types of processing, including
            marketing.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Withdraw consent</span> — at any
            time, for processing based on your consent (for example contact
            sync or AI features), without affecting the lawfulness of
            processing before withdrawal.
          </LegalItem>
        </LegalList>
        <p>
          To exercise any of these rights, write to{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>
          . We respond to verified requests within 30 days. You also have the
          right to lodge a complaint with your local data protection
          authority.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children's privacy">
        <p>
          CALL is not intended for children under 13 (or the equivalent
          minimum age in your country). We do not knowingly collect personal
          information from children below this age. If you believe we have
          collected such data, please contact us at{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          and we will delete it promptly.
        </p>
        <p>
          Voice rooms, live video and gifting features that involve
          real-money wallet transactions are restricted to users who are at
          least 18 years old, or the age of majority in their jurisdiction.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security measures">
        <p>
          We use industry-standard safeguards to protect your data, including
          TLS encryption in transit, encrypted storage at rest, strict
          access controls on a least-privilege basis, and continuous
          monitoring for suspicious activity. Wallet operations are routed
          through a PCI-DSS-aligned payment processor.
        </p>
        <p>
          No method of transmission or storage is fully secure. We cannot
          guarantee absolute security, but we commit to notifying affected
          users without undue delay if we become aware of a personal data
          breach that poses a risk to your rights or freedoms.
        </p>
      </LegalSection>

      <LegalSection id="international" title="International data transfers">
        <p>
          CALL operates globally and your data may be processed in countries
          other than your own, including countries that have not been
          recognized as providing an &quot;adequate&quot; level of data
          protection. When we transfer your data internationally, we put
          appropriate safeguards in place, such as Standard Contractual
          Clauses or other transfer mechanisms recognized under applicable
          law.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes through the app or by email before they
          take effect. The &quot;Last updated&quot; date at the top of this
          page reflects the most recent revision.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <LegalCallout title="Privacy questions?">
          <p>
            Email our privacy team at{' '}
            <Link
              href="mailto:fahadqazi1111@gmail.com"
              className="font-medium text-cbrand underline-offset-2 hover:underline"
            >
              fahadqazi1111@gmail.com
            </Link>
            . For other enquiries (bug reports, support, business), see our{' '}
            <Link
              href="/legal/contact"
              className="font-medium text-cbrand underline-offset-2 hover:underline"
            >
              Contact and Support
            </Link>{' '}
            page.
          </p>
        </LegalCallout>
      </LegalSection>
    </LegalLayout>
  )
}
