import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-white/70 hover:text-white hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-white" data-testid="text-title">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-a:text-blue-400">
          
          <section className="mb-10 p-6 bg-purple-900/30 border border-purple-500/30 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-purple-300">TERMS OF SERVICE (for Pi Jackpot)</h2>
            <h3 className="text-xl font-medium mb-4 text-white">Terms of Service — JC's Pi Jackpot</h3>
            
            <p className="mb-4">
              By using this application, you agree to the following terms:
            </p>
            
            <ol className="list-decimal pl-6 mb-4 space-y-3">
              <li>All transactions are denominated in Pi and processed through the official Pi SDK.</li>
              <li>JC's Pi Jackpot does not guarantee winnings; all results are based on randomized drawing systems.</li>
              <li>Entry fees are non-refundable once submitted.</li>
              <li>Users must have an active Pi account to participate.</li>
              <li>The app does not provide financial, gambling, or investment advice. It is for entertainment and community participation.</li>
              <li>The app may update features, payouts, or rules at any time.</li>
            </ol>
            
            <p className="mb-4 font-medium text-white">
              If you do not agree to these terms, do not use the application.
            </p>
            
            <div className="mt-6 pt-4 border-t border-purple-500/30">
              <p className="mb-2">
                Contact: <a href="mailto:upmichiganstatemovers@gmail.com" className="text-purple-400 hover:underline">upmichiganstatemovers@gmail.com</a>
              </p>
              <p className="text-slate-400">
                <strong>Effective Date:</strong> Jan 2026
              </p>
            </div>
          </section>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-age">Age Requirements</h2>
            <p className="mb-4">
              You must be at least 18 years of age to use this service. By accepting these Terms of Service, 
              you confirm that you are 18 years or older. This requirement is mandated by federal and state 
              laws across all 50 states of the United States.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-services">Services Provided</h2>
            <p className="mb-4">
              JC ON THE MOVE provides moving and junk removal services including:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Residential moving services</li>
              <li>Commercial moving services</li>
              <li>Junk removal services</li>
              <li>Heavy item moving (pool tables, safes, etc.)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-acceptance">Acceptance of Terms</h2>
            <p className="mb-4">
              By using our services, you agree to be bound by these Terms of Service and all applicable laws 
              and regulations. If you do not agree with any of these terms, you are prohibited from using our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-liability">Limitation of Liability</h2>
            <p className="mb-4">
              We take great care in providing our services, but we are not liable for any indirect, incidental, 
              special, consequential, or punitive damages resulting from your use of our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-privacy">Privacy and Data</h2>
            <p className="mb-4">
              We collect and process personal information in accordance with applicable privacy laws. 
              Your data is used solely for providing our services and will not be shared with third parties 
              without your consent.
            </p>
          </section>

          <section className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white" data-testid="text-section-rewards">Rewards Disclaimer</h2>
            <p className="mb-4 text-slate-300">
              JC ON THE MOVE provides digital reward credits for participation in company services and promotions.
            </p>
            <p className="mb-4 text-slate-300">
              Rewards are not investments, do not represent ownership, and are not guaranteed to have monetary value.
            </p>
            <p className="mb-4 text-slate-300">
              JC ON THE MOVE does not provide custodial wallet services, financial accounts, or trading facilities.
            </p>
            <p className="mb-4 text-slate-300">
              Blockchain tokens, if issued, are distributed solely as rewards and only upon user request.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-2">JC ON THE MOVE is:</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li className="flex items-center gap-2">✗ Not an exchange</li>
                <li className="flex items-center gap-2">✗ Not a broker</li>
                <li className="flex items-center gap-2">✗ Not a money service</li>
              </ul>
            </div>
          </section>

          <section className="mb-10 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Square eGift Cards & Purchase Bonuses</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li>Square manages eGift-card payment, delivery, balances, and redemption. All gift-card sales are final and nonrefundable. Cards have no expiration or inactivity fee, and no cash back or cash refund is provided except where required by law.</li>
              <li>Cards may be applied toward eligible JC ON THE MOVE services; normal quotes, minimums, availability, scheduling, and service-area rules still apply.</li>
              <li>Eligible initial activations of $50 or more earn 25 bonus JCMOVES per gift-card dollar—a current 5% service-credit reward—after a 14-day hold. Reloads and discounted gift-card purchases do not qualify.</li>
              <li>If JC approves an adjustment for service paid with a gift card, the value is returned to the original Square gift card or issued as Square eGift/store credit where supported, rather than cash, except where law requires another remedy.</li>
              <li>The purchaser may assign the bonus to themself or the gift recipient. An unclaimed recipient invitation returns to the purchaser after 30 days.</li>
              <li>Refunds and lost payment disputes reverse the bonus proportionally. If the bonus has already been spent, future JCMOVES earnings first offset the resulting reward debt.</li>
              <li>The portion of a service invoice paid by gift card does not also earn the normal customer per-dollar reward. Flat completion bonuses and crew rewards are unaffected.</li>
              <li>The current redemption rate is 500 JCMOVES per $1 of eligible service credit and may change prospectively under the rewards program. A $5,000 Gold Bundle earns 125,000 JCMOVES, currently $250 of service credit. It does not change the face value of the separate Square gift cards.</li>
            </ul>
          </section>

          <section className="mb-10 p-6 bg-amber-900/30 border border-amber-500/30 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-amber-300">Cancellation & Refund Policy</h2>
            <p className="mb-4">
              The following cancellation fees apply to all prepaid service bookings, including promotional packages 
              (such as the Half Day Loading/Unloading package):
            </p>
            
            <div className="space-y-3 mb-4">
              <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                <p className="font-semibold text-green-300">More than 48 hours before scheduled service:</p>
                <p>A processing fee of <strong className="text-white">$10 or $100</strong> will be deducted from the refund, 
                <strong className="text-white"> whichever amount is greater</strong>. The remainder will be refunded to the original payment method.</p>
              </div>
              
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4">
                <p className="font-semibold text-yellow-300">Within 48 hours of scheduled service:</p>
                <p>A <strong className="text-white">25% cancellation fee</strong> will be deducted from the refund. 
                For a $600 booking, this equals $150.</p>
              </div>
              
              <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
                <p className="font-semibold text-red-300">Within 24 hours of scheduled service:</p>
                <p>A <strong className="text-white">50% cancellation fee</strong> will be deducted from the refund. 
                For a $600 booking, this equals $300.</p>
              </div>
            </div>
            
            <p className="mb-2">
              <strong className="text-white">No-shows:</strong> If the customer is not present at the scheduled time and location 
              and has not communicated a cancellation, no refund will be issued.
            </p>
            <p className="mb-2">
              <strong className="text-white">Refund method:</strong> All refunds are processed through the original payment method 
              (Square) and may take 5-10 business days to appear.
            </p>
            <p className="text-sm text-slate-400 mt-4">
              By purchasing any prepaid service package, you acknowledge and agree to this cancellation and refund policy.
            </p>
          </section>

          {/* Trash Valet Subscription Terms */}
          <section className="mb-10 p-6 bg-orange-900/20 border border-orange-500/30 rounded-lg">
            <h2 className="text-2xl font-semibold mb-2 text-orange-300">🗑️ Trash Valet Subscription Terms</h2>
            <p className="text-slate-400 text-sm mb-5">Applies to all Trash Valet monthly and yearly recurring subscriptions, including Gift a Plan subscriptions.</p>

            <div className="space-y-4 mb-6">

              <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
                <p className="font-semibold text-blue-300 mb-2">📅 Yearly Plan — 1 Month Free</p>
                <p className="text-slate-300 text-sm">
                  Customers who subscribe on a <strong className="text-white">yearly plan</strong> are billed for 
                  <strong className="text-white"> 11 months</strong> and receive <strong className="text-white">12 months of service</strong> — 
                  one month free. The effective monthly rate is calculated as <em>(monthly rate × 11 ÷ 12)</em>. 
                  Yearly billing is collected in monthly installments at the reduced rate for the 11-month billing period.
                </p>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4">
                <p className="font-semibold text-yellow-300 mb-2">🎁 Gift a Plan — 10% Off Both</p>
                <p className="text-slate-300 text-sm">
                  When a customer purchases a <strong className="text-white">Gift a Plan</strong> subscription covering two addresses, 
                  both subscriptions receive a <strong className="text-white">10% discount</strong> applied to the effective monthly rate. 
                  If combined with a yearly plan, the 10% gift discount is applied on top of the yearly rate — 
                  resulting in the best available pricing. Both addresses are billed separately via Square invoice.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-600/40 rounded-lg p-4">
                <p className="font-semibold text-slate-200 mb-2">📋 Billing & Service Terms</p>
                <ul className="text-slate-300 text-sm space-y-1.5 list-disc pl-4">
                  <li>Monthly invoices are sent via Square. Failure to pay within 30 days may result in service suspension.</li>
                  <li>Service may be paused (up to 4 weeks/year) by contacting JC ON THE MOVE at least 5 days before the next service day.</li>
                  <li>A $30/month minimum applies to all local subscriptions; out-of-area addresses (more than 2.5 miles from base) are subject to a travel surcharge and a $129/month minimum.</li>
                  <li>Prices are subject to change with 30 days written notice.</li>
                </ul>
              </div>

              <div className="bg-red-900/20 border border-red-500/25 rounded-lg p-4">
                <p className="font-semibold text-red-300 mb-2">❌ Cancellation & 70% Prorate Credit</p>
                <p className="text-slate-300 text-sm mb-3">
                  Either party may cancel a Trash Valet subscription at any time by providing at least 
                  <strong className="text-white"> 5 calendar days' notice</strong> before the next billing date.
                </p>
                <div className="bg-orange-900/30 border border-orange-500/20 rounded-lg p-3 mb-3">
                  <p className="text-orange-300 font-semibold text-sm mb-1">70% Prorate Credit Policy</p>
                  <p className="text-slate-300 text-sm">
                    If a customer cancels a <strong className="text-white">monthly</strong> or <strong className="text-white">yearly</strong> subscription 
                    mid-billing-cycle (after payment has been collected for that month), JC ON THE MOVE will issue a 
                    <strong className="text-white"> 70% prorate credit</strong> for the unused portion of the billing period. 
                    This credit is applied toward any future JC ON THE MOVE service — it is <em>not</em> issued as a cash refund.
                  </p>
                </div>
                <p className="text-slate-400 text-xs font-medium mb-1">How the prorate is calculated:</p>
                <ul className="text-slate-400 text-xs space-y-1 list-disc pl-4">
                  <li><strong className="text-slate-300">Days remaining</strong> = (billing period end) − (last service day)</li>
                  <li><strong className="text-slate-300">Daily rate</strong> = monthly rate ÷ days in billing month</li>
                  <li><strong className="text-slate-300">Credit</strong> = daily rate × days remaining × 70%</li>
                  <li>Example: $30/mo plan, 10 days unused → daily rate ≈ $1.00 → credit = $1.00 × 10 × 70% = <strong className="text-slate-200">$7.00 credit</strong></li>
                </ul>
                <p className="text-slate-500 text-xs mt-3">
                  Prorate credits expire 12 months from the date of issuance and are non-transferable. 
                  Cancellations with less than 5 days' notice may be processed in the following billing cycle.
                </p>
              </div>

            </div>

            <p className="text-sm text-slate-400">
              By subscribing to Trash Valet service, you acknowledge and agree to these subscription, billing, and cancellation terms. 
              For questions, contact us at{" "}
              <a href="tel:+19062859312" className="text-orange-400 hover:underline">(906) 285-9312</a> or{" "}
              <a href="mailto:upmichiganstatemovers@gmail.com" className="text-orange-400 hover:underline">upmichiganstatemovers@gmail.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-changes">Changes to Terms</h2>
            <p className="mb-4">
              We reserve the right to modify these terms at any time. Changes will be effective immediately 
              upon posting. Your continued use of our services after changes are posted constitutes acceptance 
              of the modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-section-contact">Contact Information</h2>
            <p className="mb-4">
              For questions about these Terms of Service, please contact us at:
            </p>
            <p className="mb-2">
              Email: <a href="mailto:upmichiganstatemovers@gmail.com" className="text-primary hover:underline">upmichiganstatemovers@gmail.com</a>
            </p>
            <p>
              Phone: <a href="tel:906-285-9312" className="text-primary hover:underline">906-285-9312</a>
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Last updated: April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
