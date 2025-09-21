import { Facebook, Instagram, Chrome } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <h3 className="text-2xl font-bold mb-4">JC ON THE MOVE</h3>
            <p className="text-background/80 mb-4">
              Your trusted partner for residential and commercial moving services. 
              Licensed, insured, and committed to making your move stress-free.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-background/80 hover:text-background transition-colors" data-testid="link-facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-background/80 hover:text-background transition-colors" data-testid="link-instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-background/80 hover:text-background transition-colors" data-testid="link-google">
                <Chrome className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-background/80">
              <li><a href="#" className="hover:text-background transition-colors" data-testid="link-residential">Residential Moving</a></li>
              <li><a href="#" className="hover:text-background transition-colors" data-testid="link-commercial">Commercial Moving</a></li>
              <li><a href="#" className="hover:text-background transition-colors" data-testid="link-junk">Junk Removal</a></li>
              <li><a href="#" className="hover:text-background transition-colors" data-testid="link-storage">Storage Solutions</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-background/80">
              <li data-testid="text-phone">(906) 285-9312</li>
              <li data-testid="text-email">
                upmichiganstatemovers<br />
                @gmail.com
              </li>
              <li data-testid="text-hours-weekday">Mon-Sat: 7AM-7PM</li>
              <li data-testid="text-hours-weekend">Sun: 9AM-5PM</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-background/20 mt-8 pt-8 text-center">
          <p className="text-background/80" data-testid="text-copyright">
            &copy; 2024 JC ON THE MOVE. All rights reserved. Licensed & Insured.
          </p>
        </div>
      </div>
    </footer>
  );
}
