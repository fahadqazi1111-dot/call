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
  title: 'Account Deletion Policy — CALL',
  description:
    'How to permanently delete your CALL account, what data is removed, what is retained for legal reasons, and the consequences of deletion.',
}

const TOC = [
  { id: 'summary', label: 'Summary' },
  { id: 'how-to-delete', label: 'How to delete your account' },
  { id: 'what-is-deleted', label: 'What we delete' },
  { id: 'what-is-retained', label: 'What we retain' },
  { id: 'timeline', label: 'Deletion timeline' },
  { id: 'consequences', label: 'Consequences of deletion' },
  { id: 'wallet', label: 'Wallet and gifts on deletion' },
  { id: 'irreversible', label: 'Irreversibility' },
  { id: 'alternatives', label: 'Alternatives to deletion' },
  { id: 'contact', label: 'Contact' },
]

export default function DeletionPage() {
  return (
    <LegalLayout
      title="Account Deletion Policy"
      intro="You can delete your CALL account at any time, directly in the app. This page explains exactly what happens to your data when you do, so you can make an informed choice."
      toc={TOC}
    >
      <LegalSection id="summary" title="Summary">
        <p>
          Deleting your CALL account is permanent. Once deletion is complete,
          you cannot sign back in, your profile is no longer visible to other
          users, your calls, chats, voice notes, stories and AI assistant
          history are erased, and any username you held may be released for
          reuse. A small set of records (anonymised transaction and audit
          logs) is kept where the law requires it.
        </p>
        <p>
          This policy forms part of our{' '}
          <Link
            href="/legal/terms"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Terms and Conditions
          </Link>{' '}
          and complements our{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="how-to-delete" title="How to delete your account">
        <LegalCallout title="Delete in 30 seconds, right from the app">
          <ol className="ml-4 list-decimal space-y-2 text-[14.5px] text-cink">
            <li>
              Open CALL and go to{' '}
              <span className="font-medium">Profile</span>.
            </li>
            <li>
              Tap <span className="font-medium">Settings</span>.
            </li>
            <li>
              Tap <span className="font-medium">Delete My Account</span>.
            </li>
            <li>Confirm your password or one-time code when prompted.</li>
            <li>
              Tap <span className="font-medium">Delete permanently</span>.
            </li>
          </ol>
        </LegalCallout>
        <p>
          The deletion flow will show you a summary of the wallet balance,
          contacts, and active subscriptions (if any) tied to your account, so
          you can withdraw funds or take action before deletion.
        </p>
        <p>
          If you cannot access the app (for example, you lost your device or
          uninstalled CALL), email{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>{' '}
          from the email address registered on your CALL account. We will
          verify your identity and process the deletion on your behalf,
          typically within 5 business days.
        </p>
      </LegalSection>

      <LegalSection id="what-is-deleted" title="What we delete">
        <p>When your account is deleted, we erase:</p>
        <LegalList>
          <LegalItem>
            Your account record — display name, username, profile picture,
            email, phone number, password hash, and sign-in identifiers.
          </LegalItem>
          <LegalItem>
            Your 1:1 chats, group chats, voice notes, and shared media,
            including media stored on our servers.
          </LegalItem>
          <LegalItem>Your call history and call metadata.</LegalItem>
          <LegalItem>
            Your stories (active and archived) and story view data.
          </LegalItem>
          <LegalItem>
            Your voice room participation history and live broadcast
            recordings.
          </LegalItem>
          <LegalItem>
            Your AI assistant conversations and any uploaded images
            associated with them.
          </LegalItem>
          <LegalItem>
            Your synced contacts list (if you had contact sync enabled).
          </LegalItem>
          <LegalItem>
            Your activity in our serverside session, including your auth
            token and any device tokens used for push notifications.
          </LegalItem>
          <LegalItem>
            Your profile in other users&apos; contact lists and search
            results.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="what-is-retained" title="What we retain, and why">
        <p>
          We keep a small, anonymised set of records after deletion where we
          have a legal or legitimate interest to do so:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">
              Anonymised wallet and gift transaction records
            </span>{' '}
            — kept for up to 7 years as required by tax,
            anti-money-laundering and consumer-protection regulations. These
            records no longer link back to your identity once your account is
            deleted.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Fraud and abuse audit trails</span>{' '}
            — kept for up to 12 months to detect repeat offenders trying to
            create a new account after a ban.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Records of legal requests</span> —
            where we received a lawful request (for example from law
            enforcement or a regulator), the associated records are kept for
            the period required by the requesting authority.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">
              Aggregated, de-identified analytics
            </span>{' '}
            — already-stripped of identifiers, so no further action is needed
            on account deletion.
          </LegalItem>
        </LegalList>
        <p>
          None of the retained records allows someone to identify you
          personally after deletion.
        </p>
      </LegalSection>

      <LegalSection id="timeline" title="Deletion timeline">
        <p>Deletion happens in two phases:</p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Soft deletion (immediate)</span> —
            your account is disabled within minutes. You can no longer sign
            in, and your profile, chats and stories become invisible to other
            users. A short grace window of 7 days lets you contact us if you
            change your mind (see &quot;Irreversibility&quot; below).
          </LegalItem>
          <LegalItem>
            <span className="font-medium">
              Hard deletion (within 30 days)
            </span>{' '}
            — your data is permanently erased from active systems and from
            routine backups within 30 days. Anonymised records described above
            are kept for the periods stated.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="consequences" title="Consequences of deletion">
        <p>Once deletion is complete, you will lose:</p>
        <LegalList>
          <LegalItem>
            Access to your CALL account and to every feature (calls, chats,
            voice rooms, live video, stories, AI assistant).
          </LegalItem>
          <LegalItem>
            Your chat history, voice notes, and shared media — there is no
            way to recover them after hard deletion.
          </LegalItem>
          <LegalItem>
            Your contacts list and any groups you created or were a member
            of.
          </LegalItem>
          <LegalItem>
            Your username — it may be released for reuse by another user.
          </LegalItem>
          <LegalItem>
            Any active subscriptions, premium features, or unlockable content
            tied to your account.
          </LegalItem>
          <LegalItem>Any AI assistant conversation history.</LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="wallet" title="Wallet and gifts on deletion">
        <LegalCallout title="Withdraw your balance before deleting">
          <p>
            We strongly recommend withdrawing any eligible wallet balance
            <span className="font-medium"> before </span>
            you delete your account. After deletion, balances tied to your
            identity cannot be recovered, and any pending gifts will be
            cancelled.
          </p>
        </LegalCallout>
        <p>Specifically:</p>
        <LegalList>
          <LegalItem>
            Eligible wallet balances must be withdrawn via the in-app
            withdrawal flow before deletion. Once deletion is initiated, the
            wallet is frozen and no further withdrawals can be requested.
          </LegalItem>
          <LegalItem>
            Pending gift transfers that have not yet been claimed by the
            recipient are cancelled and the corresponding coins are forfeited
            on deletion.
          </LegalItem>
          <LegalItem>
            Unclaimed coins, expired coins, or coins tied to promotional
            balances are forfeited on deletion and are not refundable.
          </LegalItem>
          <LegalItem>
            If your account is terminated by us for violation of our Terms,
            any wallet balance may be forfeited in line with those Terms.
          </LegalItem>
          <LegalItem>
            Anonymised transaction records are retained for up to 7 years
            for legal compliance, as described above.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="irreversible" title="Irreversibility">
        <p>
          After the 7-day soft-deletion grace window, account deletion is{' '}
          <span className="font-medium">
            permanent and irreversible
          </span>
          . We cannot restore your account, contacts, chats, stories or AI
          history, even if you later change your mind. If you wish to use CALL
          again after that point, you will need to create a brand new account.
        </p>
      </LegalSection>

      <LegalSection id="alternatives" title="Alternatives to deletion">
        <p>
          If you simply want a break, or you want to stop someone from
          contacting you, you may not need to delete your account. You can:
        </p>
        <LegalList>
          <LegalItem>
            <span className="font-medium">Block a user</span> — from their
            profile or chat header. They will not be able to call or message
            you again.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Mute notifications</span> — for a
            chat, group, voice room or live session, in Settings.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Disable contact sync</span> — in
            Profile → Settings, without deleting your account.
          </LegalItem>
          <LegalItem>
            <span className="font-medium">Sign out</span> — to take a break
            while keeping your account and history intact.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          If you have any questions about deleting your CALL account, or need
          help doing it without the app, email{' '}
          <Link
            href="mailto:fahadqazi1111@gmail.com"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            fahadqazi1111@gmail.com
          </Link>
          . See also our{' '}
          <Link
            href="/legal/contact"
            className="font-medium text-cbrand underline-offset-2 hover:underline"
          >
            Contact and Support
          </Link>{' '}
          page for hours and response times.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
