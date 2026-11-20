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
  title: 'Community Guidelines — CALL',
  description:
    'The rules of behaviour on CALL — calls, chats, voice rooms, live video, stories and gifting — and how we enforce them.',
}

const TOC = [
  { id: 'why', label: 'Why we have guidelines' },
  { id: 'respect', label: 'Respect and kindness' },
  { id: 'no-harassment', label: 'No harassment or hate speech' },
  { id: 'no-spam', label: 'No spam or manipulation' },
  { id: 'no-impersonation', label: 'No impersonation' },
  { id: 'adult-content', label: 'Adult content and intimacy' },
  { id: 'safety', label: 'Safety and illegal activity' },
  { id: 'wallet-conduct', label: 'Wallet, gifts and live conduct' },
  { id: 'reporting', label: 'How to report' },
  { id: 'enforcement', label: 'Enforcement actions' },
  { id: 'appeals', label: 'Appeals process' },
  { id: 'contact', label: 'Contact' },
]

export default function CommunityPage() {
  return (
    <LegalLayout
      title="Community Guidelines"
      intro="CALL is built for genuine human connection. These guidelines explain the kind of behaviour we expect from everyone on CALL — in calls, chats, group chats, voice rooms, live video, stories and gifts."
      toc={TOC}
    >
      <LegalSection id="why" title="Why we have guidelines">
        <p>
          CALL is used by people across many countries, languages, ages and
          cultures. So that everyone can call, chat, share stories and go
          live without fear, we apply the same baseline rules everywhere.
          These guidelines apply on top of our{' '}
          <Link
            href="/legal/terms"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Terms and Conditions
          </Link>{' '}
          and work alongside our{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          When you report content or behaviour to us, we measure it against
          the rules below. We aim to be consistent, transparent and fair,
          and to give people a way back when they make a mistake.
        </p>
      </LegalSection>

      <LegalSection id="respect" title="Respect and kindness">
        <p>
          Treat other people the way you would like to be treated. CALL is a
          place for real conversations — voice calls, video calls, group
          chats, voice rooms, live video and direct messages. We encourage
          you to:
        </p>
        <LegalList>
          <LegalItem>
            Listen and respond in good faith, even when you disagree.
          </LegalItem>
          <LegalItem>
            Respect other people&apos;s time and attention — don&apos;t
            spam-call, leave abusive voice notes, or flood a group chat.
          </LegalItem>
          <LegalItem>
            Ask before adding someone to a group chat or voice room, and
            respect their choice to leave.
          </LegalItem>
          <LegalItem>
            Honour privacy: do not record calls, voice notes or live
            sessions without the other participants&apos; informed consent,
            and do not share private media outside CALL without permission.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="no-harassment" title="No harassment or hate speech">
        <p>We do not allow:</p>
        <LegalList>
          <LegalItem>
            Harassment, bullying, sustained unwanted contact, doxxing or
            coordinated pile-ons.
          </LegalItem>
          <LegalItem>
            Threats of violence, including sexual violence, against any
            person or group.
          </LegalItem>
          <LegalItem>
            Hate speech — content that attacks, demeans or dehumanises people
            based on race, ethnicity, national origin, religion, caste,
            sexual orientation, sex, gender identity, age, disability, or
            other protected characteristics.
          </LegalItem>
          <LegalItem>
            Sexual harassment, unsolicited sexual content, and sexualising
            other users without their consent.
          </LegalItem>
          <LegalItem>
            Encouraging self-harm, suicide or eating disorders, or
            glorifying such behaviour.
          </LegalItem>
        </LegalList>
        <p>
          If you experience any of the above, please report it. You can also{' '}
          <span className="font-medium">block</span> the user from their
          profile or chat header — they will not be able to call or message
          you again from that account.
        </p>
      </LegalSection>

      <LegalSection id="no-spam" title="No spam, scams or manipulation">
        <LegalList>
          <LegalItem>
            Do not send mass unsolicited messages, chain letters, or
            commercial spam.
          </LegalItem>
          <LegalItem>
            Do not run pyramid schemes, fake giveaways, romance scams,
            investment scams, or any other fraudulent activity.
          </LegalItem>
          <LegalItem>
            Do not use bots, automation or coordinated inauthentic behaviour
            to inflate likes, story views, gift counts or live audience
            sizes.
          </LegalItem>
          <LegalItem>
            Do not engage in misleading interactions — for example, pressuring
            someone to send you gifts, or manipulating the live/gift
            economy.
          </LegalItem>
          <LegalItem>
            Do not share links to phishing sites, malware, or fraudulent
            payment pages.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="no-impersonation" title="No impersonation">
        <p>
          You must not present yourself as another person, brand, public
          official or CALL staff member. Profile pictures, display names,
          usernames and bios must truthfully represent you, and must not
          deceive others about your identity or affiliation. Parody and
          fan accounts are allowed only if they clearly state they are not
          affiliated with the person or brand they reference.
        </p>
      </LegalSection>

      <LegalSection id="adult-content" title="Adult content and intimacy">
        <p>
          CALL permits adult conversations in private, consensual contexts,
          but the following are not allowed:
        </p>
        <LegalList>
          <LegalItem>
            Nudity or sexual activity in stories, live video, voice rooms,
            group chats, or any public-facing surface of CALL.
          </LegalItem>
          <LegalItem>
            Sexual content involving minors — this is reported to the
            relevant authorities and removed without notice.
          </LegalItem>
          <LegalItem>
            Non-consensual intimate media, including so-called
            &quot;revenge porn&quot;, deepfake sexual content, or secretly
            recorded calls.
          </LegalItem>
          <LegalItem>
            Prostitution, escort services, or solicitation of sexual
            services.
          </LegalItem>
          <LegalItem>
            Sexualising minors in any form, including illustrated or
            AI-generated depictions.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="safety" title="Safety and illegal activity">
        <p>
          CALL must not be used to plan, facilitate or promote illegal
          activity of any kind, including but not limited to:
        </p>
        <LegalList>
          <LegalItem>
            Sale, purchase, or distribution of illegal drugs, weapons, or
            regulated goods.
          </LegalItem>
          <LegalItem>Terrorism, organised crime, or violent extremism.</LegalItem>
          <LegalItem>
            Money laundering, fraud, or misuse of the wallet and gifts
            system.
          </LegalItem>
          <LegalItem>Human trafficking or exploitation.</LegalItem>
          <LegalItem>
            Encouraging, instructing or recruiting others to commit crimes.
          </LegalItem>
        </LegalList>
        <p>
          If you see something that suggests someone is in immediate
          physical danger, contact your local emergency services first, then
          report it to us.
        </p>
      </LegalSection>

      <LegalSection id="wallet-conduct" title="Wallet, gifts and live conduct">
        <p>
          CALL&apos;s wallet and gifts features create real economic
          relationships between users. To keep them fair and safe:
        </p>
        <LegalList>
          <LegalItem>
            Do not pressure or manipulate other users into sending you gifts
            or topping up your wallet.
          </LegalItem>
          <LegalItem>
            Do not buy, sell, or transfer accounts, coins, or wallet
            balances outside CALL&apos;s official withdrawal channels.
          </LegalItem>
          <LegalItem>
            Do not use live video, voice rooms or stories to solicit money
            for illegal or deceptive purposes.
          </LegalItem>
          <LegalItem>
            Do not exploit minors, financially or otherwise, through gifts,
            tips or live features.
          </LegalItem>
          <LegalItem>
            Do not coordinate chargeback fraud, payment disputes, or
            manipulation of payment processors.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="reporting" title="How to report">
        <LegalCallout title="Report in seconds">
          <p>
            You can report a message, story, live broadcast, voice room, or
            user profile directly from the &quot;⋯&quot; menu next to that
            content, or from the user&apos;s profile. Choose a reason,
            optionally add context, and submit. Our moderation team reviews
            reports in the order they are received.
          </p>
        </LegalCallout>
        <p>
          You can also email{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          with a description and (where possible) a link or screenshot. If
          you believe a crime has been committed, contact your local law
          enforcement as well.
        </p>
      </LegalSection>

      <LegalSection id="enforcement" title="Enforcement actions">
        <p>
          When we confirm a violation, we take proportionate action. The
          typical enforcement ladder, in order of severity, is:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Content removal</span> — the
            specific message, story, live clip or profile element is deleted
            and the user is notified.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Warning</span> — a written warning
            is sent; the violation is noted on the user&apos;s moderation
            history.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Feature restriction</span> —
            temporary loss of specific features (for example, the ability to
            go live, send gifts, or post stories) for a defined period.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Account suspension</span> — the
            account is temporarily disabled; the user cannot sign in or use
            any feature for the duration of the suspension.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Permanent ban</span> — the account
            is permanently disabled and the user is prohibited from creating
            new accounts. Serious violations (illegal content, harm to
            minors, coordinated abuse) may go straight to a permanent ban.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Wallet &amp; payment
            consequences</span> — for violations involving fraud or
            manipulation, we may freeze or reverse wallet balances and block
            the payment method, in line with our{' '}
            <Link
              href="/legal/terms"
              className="font-medium text-cbrand underline-offset-2 hover:underline"
            >
              Terms
            </Link>
            .
          </LegalItem>
        </LegalList>
        <p>
          We may also preserve content or metadata and disclose it to law
          enforcement where required by law, particularly in cases involving
          harm to minors, threats of violence, or financial crime.
        </p>
      </LegalSection>

      <LegalSection id="appeals" title="Appeals process">
        <p>
          If you believe a moderation decision was wrong, you can appeal
          once. Email{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          with the subject line &quot;Appeal&quot; and the username or
          user-id involved. Include any context you think we missed. A
          different reviewer than the original decision-maker will look at
          your case and respond, usually within 5 business days. The
          decision on appeal is final unless new information becomes
          available.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          For moderation questions, partnerships, or any other enquiry, see
          our{' '}
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
