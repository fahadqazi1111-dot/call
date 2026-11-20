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
  title: 'Terms and Conditions — CALL',
  description:
    'The rules and conditions that govern your use of CALL — calls, chats, stories, gifts, wallet and AI assistant features.',
}

const TOC = [
  { id: 'acceptance', label: 'Acceptance of terms' },
  { id: 'eligibility', label: 'Account registration' },
  { id: 'the-service', label: 'The service' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'prohibited', label: 'Prohibited conduct' },
  { id: 'ugc', label: 'User-generated content' },
  { id: 'ip', label: 'Intellectual property' },
  { id: 'wallet', label: 'Wallet, gifts & virtual currency' },
  { id: 'payments', label: 'Payment terms' },
  { id: 'termination', label: 'Termination' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'governing-law', label: 'Governing law' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'contact', label: 'Contact' },
]

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms and Conditions"
      intro="These terms govern your use of CALL. Please read them carefully — by creating an account or using any feature of CALL, you agree to be bound by them."
      toc={TOC}
    >
      <LegalSection id="acceptance" title="Acceptance of terms">
        <p>
          By downloading, installing, signing in to or otherwise using CALL
          (the &quot;Service&quot;), you enter into a binding agreement with
          CALL (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) on these Terms
          and Conditions (the &quot;Terms&quot;). If you do not agree to any
          part of the Terms, you must not access or use the Service.
        </p>
        <p>
          These Terms work together with our{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          ,{' '}
          <Link
            href="/legal/community"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Community Guidelines
          </Link>{' '}
          and{' '}
          <Link
            href="/legal/cookies"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Cookie Policy
          </Link>
          . If a conflict exists, the more specific document prevails for the
          matter it covers.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="Account registration">
        <p>To create a CALL account you must:</p>
        <LegalList>
          <LegalItem>
            Be at least 13 years old (or the minimum age of digital consent
            in your country). Wallet and gifting features require you to be
            at least 18 years old or the age of majority in your
            jurisdiction.
          </LegalItem>
          <LegalItem>
            Provide accurate, current and complete information at
            registration and keep it updated.
          </LegalItem>
          <LegalItem>
            Use your own identity — you may not create an account on behalf
            of another person without their authorisation.
          </LegalItem>
          <LegalItem>
            Keep your password, OTP and any sign-in credentials
            confidential, and be responsible for all activity under your
            account.
          </LegalItem>
          <LegalItem>
            Maintain only one personal account. Duplicate or fake accounts
            may be removed.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="the-service" title="The service">
        <p>
          CALL provides voice calls, video calls, text messaging, voice
          notes, stories, voice rooms, live video, group chats, virtual
          gifts, a digital wallet, an AI assistant, and contacts management.
          We grant you a personal, non-exclusive, non-transferable,
          revocable licence to use the Service for your own non-commercial
          communication, on the condition that you comply with these Terms.
        </p>
        <p>
          We may change, suspend or discontinue any feature at any time
          without notice, including in response to legal requirements or to
          protect the safety of users. We are not liable to you for any such
          change.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use policy">
        <p>
          You agree to use CALL only for lawful purposes and in a manner that
          does not infringe the rights of, or restrict the use and enjoyment
          of, the Service by any third party. You are responsible for all
          content you generate and for your conduct on CALL.
        </p>
      </LegalSection>

      <LegalSection id="prohibited" title="Prohibited conduct">
        <p>You must not, and must not authorise others to:</p>
        <LegalList>
          <LegalItem>
            Use CALL to harass, bully, stalk, threaten, defame, intimidate
            or abuse any person.
          </LegalItem>
          <LegalItem>
            Send spam, unsolicited commercial messages, chain letters,
            pyramid schemes, or phishing attempts.
          </LegalItem>
          <LegalItem>
            Distribute or promote illegal content, including content that
            exploits or harms minors, content inciting violence, terrorism,
            or hate speech.
          </LegalItem>
          <LegalItem>
            Impersonate another person, brand, public official, or CALL
            staff, or falsely represent an affiliation.
          </LegalItem>
          <LegalItem>
            Use bots, scrapers, scripts, automated tools or
            reverse-engineering to access, collect or analyse CALL data, or
            to disrupt the Service.
          </LegalItem>
          <LegalItem>
            Circumvent or attempt to circumvent any technical limitation,
            security measure, fee, rate-limit or geographic restriction.
          </LegalItem>
          <LegalItem>
            Reproduce, resell, lease, or commercially exploit CALL or any
            part of it without our prior written consent.
          </LegalItem>
          <LegalItem>Upload viruses, malware, or any other malicious code.</LegalItem>
          <LegalItem>
            Engage in payment fraud, chargeback abuse, money laundering, or
            any manipulation of the wallet or gift systems.
          </LegalItem>
          <LegalItem>
            Use CALL&apos;s AI assistant to generate unlawful, defamatory,
            sexual, harassing or rights-infringing content.
          </LegalItem>
        </LegalList>
        <p>
          Violations may result in content removal, account restrictions,
          suspension, termination, and — where applicable — referral to the
          relevant authorities. See our{' '}
          <Link
            href="/legal/community"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Community Guidelines
          </Link>{' '}
          for the enforcement ladder.
        </p>
      </LegalSection>

      <LegalSection id="ugc" title="User-generated content">
        <p>
          You retain ownership of all content (messages, voice notes, photos,
          videos, stories, live broadcasts, AI prompts) that you submit to
          CALL. By submitting content, you grant CALL a worldwide,
          non-exclusive, royalty-free, sublicensable licence to host, store,
          transmit, display, reproduce, adapt and otherwise operate on that
          content solely to the extent necessary to provide and improve the
          Service to you and to other users with whom you choose to share it.
        </p>
        <p>You represent and warrant that:</p>
        <LegalList>
          <LegalItem>
            You own or have all necessary rights and consents to submit your
            content and to grant the licence above.
          </LegalItem>
          <LegalItem>
            Your content does not, and will not, infringe the intellectual
            property, privacy or other rights of any third party.
          </LegalItem>
          <LegalItem>
            Your content complies with these Terms and our Community
            Guidelines.
          </LegalItem>
        </LegalList>
        <p>
          You are solely responsible for your content and the consequences
          of sharing it. We may remove or restrict access to content that
          violates these Terms or that we are required to remove by law.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="Intellectual property">
        <p>
          CALL, the CALL logo, the Service&apos;s software, design, features
          and underlying infrastructure are owned by us or our licensors and
          are protected by intellectual-property laws. Nothing in these
          Terms grants you any right to use CALL&apos;s trademarks, trade
          names or branding without our prior written consent.
        </p>
        <p>
          We respect the intellectual-property rights of others. If you
          believe content on CALL infringes your rights, send a notice to{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          with the information required by applicable law, and we will
          respond in line with our statutory obligations.
        </p>
      </LegalSection>

      <LegalSection id="wallet" title="Wallet, gifts and virtual currency">
        <p>
          The CALL wallet lets you hold a balance of virtual coins, top it
          up with real money, send coins as gifts to other users, and (where
          available) withdraw your balance. Coins are a limited licence to
          access certain premium features and to send virtual gifts within
          CALL — they are not currency, are not issued or backed by any
          government, do not earn interest, and are non-transferable outside
          CALL except where we explicitly enable a withdrawal.
        </p>
        <LegalCallout title="Important wallet rules">
          <LegalList>
            <LegalItem>
              All wallet transactions are final once executed, except where
              required by law or where we determine that fraud or error
              occurred.
            </LegalItem>
            <LegalItem>
              Coins have no cash value outside CALL and may not be exchanged
              for cash unless a withdrawal is explicitly offered in your
              region.
            </LegalItem>
            <LegalItem>
              Wallet balances and unredeemed coins are forfeited if your
              account is terminated for violation of these Terms.
            </LegalItem>
            <LegalItem>
              If you delete your account, any remaining wallet balance is
              handled according to our Account Deletion Policy. Please
              withdraw any eligible balance before deletion — unclaimed
              balances may become unrecoverable.
            </LegalItem>
            <LegalItem>
              Fraudulent chargebacks, disputes, or manipulation of the
              wallet system entitle us to reverse credits, suspend features,
              or terminate your account.
            </LegalItem>
          </LegalList>
        </LegalCallout>
      </LegalSection>

      <LegalSection id="payments" title="Payment terms">
        <p>
          Top-ups and withdrawals are processed through third-party payment
          processors. You authorise the processor to charge your chosen
          payment method for the amount you authorise. By initiating a
          payment you confirm that you are authorised to use the payment
          method and that the information you provide is accurate.
        </p>
        <p>
          Refunds, where applicable, are governed by the processor&apos;s
          policy and applicable consumer-protection law. We are not the
          merchant of record for transactions processed by third-party
          processors.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="Termination">
        <p>
          You may delete your account at any time in{' '}
          <span className="font-medium">
            Profile → Settings → Delete My Account
          </span>
          . See our{' '}
          <Link
            href="/legal/deletion"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Account Deletion Policy
          </Link>{' '}
          for what happens to your data.
        </p>
        <p>
          We may suspend or terminate your access to CALL, in whole or in
          part, immediately and without notice if: (i) you breach these
          Terms; (ii) we are required to do so by law; (iii) we reasonably
          suspect fraud, illegal activity or harm to the Service or its
          users; or (iv) we discontinue a feature or the Service. On
          termination, your licence to use CALL ends immediately.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot;. TO THE EXTENT PERMITTED BY LAW, CALL DISCLAIMS ALL
          WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, SECURE, OR THAT CALL QUALITY WILL MEET
          YOUR EXPECTATIONS, AS CALL DEPENDS ON YOUR DEVICE, OPERATING SYSTEM
          AND INTERNET CONNECTION.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          TO THE EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CALL
          OR ITS AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS,
          DATA, USE OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF,
          OR INABILITY TO USE, THE SERVICE, WHETHER BASED ON WARRANTY,
          CONTRACT, TORT (INCLUDING NEGLIGENCE) OR ANY OTHER LEGAL THEORY,
          EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO
          THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT
          YOU HAVE PAID TO US FOR WALLET TOP-UPS IN THE TWELVE (12) MONTHS
          PRECEDING THE CLAIM, OR (B) THE AMOUNT REQUIRED TO BE PAID UNDER
          MANDATORY LAW. NOTHING IN THESE TERMS EXCLUDES OR LIMITS LIABILITY
          THAT CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of the jurisdiction in which
          CALL is established, without giving effect to conflict-of-laws
          principles. You and CALL submit to the exclusive jurisdiction of
          the competent courts of that jurisdiction for any dispute arising
          from or relating to these Terms or the Service, except where
          mandatory consumer-protection law gives you the right to bring
          proceedings in the courts of your country of residence.
        </p>
        <p>
          Where required by law, we will inform you of any alternative
          dispute-resolution mechanism available before court proceedings.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <p>
          We may modify these Terms from time to time. We will notify you of
          material changes through the app or by email before they take
          effect. Your continued use of CALL after the effective date of any
          change constitutes your acceptance of the updated Terms. If you do
          not agree, you must stop using CALL and delete your account.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about these Terms? Email us at{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>
          . For bug reports, feature requests and other support, see our{' '}
          <Link
            href="/legal/contact"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Contact and Support
          </Link>{' '}
          page.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
