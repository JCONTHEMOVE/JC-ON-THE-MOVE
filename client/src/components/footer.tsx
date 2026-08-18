import { ArrowRight, Facebook, Instagram, MapPin, MessageCircle, Phone } from "lucide-react";
import {
  IRONWOOD_DAILY_DISCOUNT,
  ROUTE_DAY_DISCOUNT,
  ROUTE_DAY_SCHEDULE,
  SERVICE_ADDRESS_DISCOUNT_NOTE,
  routeDayLandingHref,
} from "@shared/routeDays";

export default function Footer() {
  return (
    <footer className="bg-[#020915] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5 md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Local help fast</p>
            <h3 className="mt-2 text-2xl font-black">Need moving, junk removal, delivery, cleanup, or labor?</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Send the job details, photos, videos, or an album link. JC ON THE MOVE will confirm the crew, timing, and next step.
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row md:mt-0">
            <a
              href="/book?mode=quick&service=moving"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500"
              data-testid="footer-book-now"
            >
              Book Now <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="sms:+19062859312"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10"
              data-testid="footer-text-us"
            >
              <MessageCircle className="h-4 w-4" /> Text Us
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">JC ON THE MOVE</h3>
            <p className="text-slate-300 mb-4 max-w-xl">
              Fast local help for moving, junk removal, delivery, cleanup, and labor work. Licensed, insured, and built around quick customer booking.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/JCOnTheMove/" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors" data-testid="link-facebook" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/jconthemove/" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors" data-testid="link-instagram" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.google.com/maps/place/JC+ON+THE+MOVE" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors" data-testid="link-google" aria-label="Google Maps">
                <MapPin className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-slate-300">
              <li><a href="/book?mode=quick&service=moving" className="hover:text-white transition-colors" data-testid="link-residential">Moving</a></li>
              <li><a href="/book?mode=quick&service=junk_removal" className="hover:text-white transition-colors" data-testid="link-junk">Junk Removal</a></li>
              <li><a href="/book?mode=quick&service=delivery" className="hover:text-white transition-colors" data-testid="link-delivery">Delivery</a></li>
              <li><a href="/book?mode=quick&service=cleaning" className="hover:text-white transition-colors" data-testid="link-cleanup">Cleanup / Labor</a></li>
              <li><a href="/gift-cards" className="font-semibold text-amber-200 transition-colors hover:text-amber-100" data-testid="link-gift-cards">Gift Cards</a></li>
              <li><a href="/gallery" className="hover:text-white transition-colors" data-testid="link-work-photos">Work Photos</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Route Days</h4>
            <ul className="space-y-2 text-slate-300">
              {ROUTE_DAY_SCHEDULE.map((route) => (
                <li key={route.key}>
                  <a href={routeDayLandingHref(route)} className="hover:text-white transition-colors">
                    {route.city} {route.day}
                  </a>
                </li>
              ))}
              <li className="font-semibold text-emerald-300">{ROUTE_DAY_DISCOUNT}</li>
              <li className="font-semibold text-emerald-300">{IRONWOOD_DAILY_DISCOUNT}</li>
              <li className="text-slate-400">{SERVICE_ADDRESS_DISCOUNT_NOTE}</li>
              <li className="text-slate-400">Other jobs by availability</li>
              <li className="text-slate-400">2 crews, up to 6 movers</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-slate-300">
              <li data-testid="text-phone">
                <a href="tel:+19062859312" className="inline-flex items-center gap-2 hover:text-white">
                  <Phone className="h-4 w-4" /> (906) 285-9312
                </a>
              </li>
              <li data-testid="text-email">
                upmichiganstatemovers<br />
                @gmail.com
              </li>
              <li data-testid="text-hours-weekday">Mon-Sat: 7AM-7PM</li>
              <li data-testid="text-hours-weekend">Sun: CLOSED</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 mt-8 pt-8 text-center">
          <p className="text-slate-400" data-testid="text-copyright">
            &copy; 2026 JC ON THE MOVE. All rights reserved. Licensed & insured.
          </p>
        </div>
      </div>
    </footer>
  );
}
