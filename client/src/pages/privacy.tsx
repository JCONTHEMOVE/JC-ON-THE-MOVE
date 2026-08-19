import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-white/70 hover:text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-2 text-white flex items-center gap-3">
          <Shield className="h-10 w-10 text-blue-400" />
          Privacy Policy
        </h1>
        <p className="text-slate-400 mb-10 text-sm">JC ON THE MOVE — Effective Date: January 1, 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              JC ON THE MOVE ("we", "us", or "our") is a moving and junk removal services company operating a
              digital platform for service requests, employee management, customer rewards, and token-based
              incentives. Our platform is accessible via our website and mobile application.
            </p>
            <p className="mt-3">
              Contact: <a href="mailto:upmichiganstatemovers@gmail.com" className="text-blue-400 hover:underline">upmichiganstatemovers@gmail.com</a> | <a href="tel:906-285-9312" className="text-blue-400 hover:underline">906-285-9312</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <h3 className="font-medium text-slate-200 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>Full name, email address, and phone number</li>
              <li>Password (stored as a secure one-way hash — never readable)</li>
              <li>User role (Admin, Employee, or Customer)</li>
              <li>Date of birth (for 18+ age verification)</li>
            </ul>
            <h3 className="font-medium text-slate-200 mb-2">Service Information</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>Service addresses and job locations</li>
              <li>Service type, date, and special instructions</li>
              <li>Quote requests and job records</li>
              <li>Photos submitted for job documentation</li>
            </ul>
            <h3 className="font-medium text-slate-200 mb-2">Rewards & Blockchain Data</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>JCMOVES token balance and transaction history</li>
              <li>Mining session activity and claim history</li>
              <li>Staking positions and reward records</li>
              <li>Solana wallet address (if provided for token withdrawals)</li>
              <li>Fitness activity logs (push-ups, sit-ups) used for mining speed boosts</li>
              <li>Square order, payment, and gift-card activity references used to verify eGift purchase bonuses</li>
              <li>Purchaser and selected recipient email addresses used to assign or invite the owner of a gift-card purchase bonus</li>
            </ul>
            <h3 className="font-medium text-slate-200 mb-2">Device & Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Push notification subscription tokens (for mining alerts)</li>
              <li>Browser/device type and operating system</li>
              <li>Session identifiers for authentication</li>
              <li>App usage patterns (pages visited, features used)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To create and manage your account and verify your identity</li>
              <li>To provide moving and junk removal services and match you with available crews</li>
              <li>To process job assignments and communicate updates via email and SMS</li>
              <li>To distribute JCMOVES token rewards for completed jobs, referrals, and platform activity</li>
              <li>To operate the token mining system and calculate staking rewards</li>
              <li>To process payments (via Square) for services rendered</li>
              <li>To verify, assign, hold, release, and reverse Square eGift purchase bonuses</li>
              <li>To send push notifications about mining sessions, job opportunities, and important updates</li>
              <li>To maintain platform security and prevent fraudulent activity</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Blockchain & Token Transparency</h2>
            <p className="mb-3">
              Our JCMOVES token operates on the Solana blockchain. Please be aware that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Blockchain transactions are permanently recorded and publicly visible on the Solana network</li>
              <li>Your wallet address (if associated with your account) may be visible in transaction records</li>
              <li>Token rewards are internal company credits until withdrawn to a personal wallet</li>
              <li>JCMOVES token rewards are variable and subject to company distribution policy</li>
              <li>JCMOVES reward programs are variable and subject to company policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Information Sharing</h2>
            <p className="mb-3">We do <strong className="text-white">not</strong> sell, rent, or trade your personal information. We may share data only in these limited circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Service Providers:</strong> Email (SendGrid/Gmail), SMS (Twilio), payments (Square), and hosting providers who process data on our behalf under confidentiality agreements</li>
              <li><strong className="text-white">Employees:</strong> Job-relevant customer contact information is shared with assigned crew members to fulfill service requests</li>
              <li><strong className="text-white">Legal Requirements:</strong> We may disclose information if required by law or to protect the rights and safety of our users and company</li>
            </ul>
            <p className="mt-3 text-sm text-slate-400">Square remains the system of record for eGift-card delivery and balance. We do not store the gift-card number or access code.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your account information as long as your account is active. Job records and transaction history
              are retained for a minimum of 3 years for business and legal compliance purposes. You may request deletion
              of your personal data by contacting us — note that blockchain transaction records cannot be deleted due
              to the immutable nature of the Solana network.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted data transmission (HTTPS/TLS),
              bcrypt password hashing, session-based authentication, and role-based access controls. No system is
              100% secure — please use a strong, unique password and keep your credentials private.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Children's Privacy</h2>
            <p>
              Our platform requires users to be 18 years of age or older. We do not knowingly collect personal
              information from anyone under 18. Age verification is required at account registration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and personal data</li>
              <li>Opt out of push notifications (via device or browser settings)</li>
              <li>Opt out of SMS notifications (reply STOP to any text)</li>
              <li>Withdraw consent for marketing communications</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at <a href="mailto:upmichiganstatemovers@gmail.com" className="text-blue-400 hover:underline">upmichiganstatemovers@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Push Notifications</h2>
            <p>
              With your permission, we send push notifications to alert you about mining session completions,
              job opportunities, and important account updates. You can revoke notification permission at any
              time through your browser or device settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via
              email or an in-app notification. Continued use of the platform after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section className="pb-8">
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Us</h2>
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <p className="font-medium text-white mb-1">JC ON THE MOVE</p>
              <p>Email: <a href="mailto:upmichiganstatemovers@gmail.com" className="text-blue-400 hover:underline">upmichiganstatemovers@gmail.com</a></p>
              <p>Phone: <a href="tel:906-285-9312" className="text-blue-400 hover:underline">906-285-9312</a></p>
              <p className="mt-3 text-sm text-slate-400">Last updated: January 1, 2026</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
