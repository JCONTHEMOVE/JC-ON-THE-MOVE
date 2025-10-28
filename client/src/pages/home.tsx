import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock, Shield, Users, DollarSign, Home, Building, Trash2, CheckCircle } from "lucide-react";
import QuoteForm from "@/components/quote-form";
import ContactForm from "@/components/contact-form";
import CompanySlideshow from "@/components/company-slideshow";

// Gallery images
import movingTruck1 from "@assets/IMG_20220919_091701403_HDR_1758497194325.jpg";
import movingTruck2 from "@assets/stock_images/professional_moving__3cea5ab5.jpg";
import movers1 from "@assets/IMG_20250920_152516884.jpg";
import movers2 from "@assets/IMG_20250827_103204519_HDR_1758496567144.jpg";
import customerReviews from "@assets/customer_reviews.jpg";
import happyFamily2 from "@assets/stock_images/happy_family_in_new__32e2c8cf.jpg";

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure video plays on mount
    const video = videoRef.current;
    if (!video) return;

    let hasPlayed = false;

    const playVideo = async () => {
      if (hasPlayed) return;
      try {
        await video.play();
        hasPlayed = true;
        // Remove fallback listeners once video is playing
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      } catch (error) {
        console.log("Video play attempt failed, will retry on interaction or when ready");
      }
    };

    // Try to play when video can play
    const handleCanPlay = () => {
      playVideo();
    };

    // Fallback: play on user interaction (keeps trying until success)
    const handleUserInteraction = () => {
      playVideo();
    };

    video.addEventListener('canplay', handleCanPlay);
    
    // Keep listening for user interactions until video plays
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    // Try to play immediately
    playVideo();

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  const scrollToQuote = () => {
    const element = document.getElementById("quote");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section id="home" className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Professional Moving & Junk Removal
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-muted-foreground">
                Reliable, efficient, and stress-free moving services for your home or business. 
                Licensed, insured, and locally owned with offices in Ironwood Michigan, Iron River Michigan, and Green Bay Wisconsin.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={scrollToQuote}
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-8 py-4 text-lg font-semibold"
                  data-testid="button-get-quote"
                >
                  Get Free Quote
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-white px-8 py-4 text-lg font-semibold"
                  data-testid="button-call-now"
                  asChild
                >
                  <a href="tel:(906) 285-9312">
                    <Phone className="mr-2 h-5 w-5" />
                    Call Now
                  </a>
                </Button>
              </div>
            </div>
            <div className="relative">
              <video
                ref={videoRef}
                src="/attached_assets/hero-video-compressed.mp4"
                poster="/attached_assets/FB_IMG_5937718007297288444_1758496258755.jpg"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="rounded-xl shadow-2xl w-full h-auto"
                data-testid="video-hero"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Our Services</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From residential moves to commercial relocations and junk removal, 
              we've got you covered with professional, reliable service.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="service-card shadow-lg border border-border" data-testid="card-residential">
              <CardContent className="p-8">
                <div className="text-primary text-4xl mb-4">
                  <Home className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Residential Moving</h3>
                <p className="text-muted-foreground mb-6">
                  Complete home moving services including packing, loading, transportation, 
                  and unpacking for local and long-distance moves.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Professional packing
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Furniture protection
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Storage solutions
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="service-card shadow-lg border border-border" data-testid="card-commercial">
              <CardContent className="p-8">
                <div className="text-primary text-4xl mb-4">
                  <Building className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Commercial Moving</h3>
                <p className="text-muted-foreground mb-6">
                  Office relocations and commercial moves with minimal downtime 
                  and maximum efficiency for your business.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    After-hours service
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Equipment handling
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Minimal disruption
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="service-card shadow-lg border border-border" data-testid="card-junk">
              <CardContent className="p-8">
                <div className="text-primary text-4xl mb-4">
                  <Trash2 className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Junk Removal</h3>
                <p className="text-muted-foreground mb-6">
                  Eco-friendly junk removal and disposal services for homes, 
                  offices, and construction sites.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Eco-friendly disposal
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    Same-day service
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="text-primary mr-2 h-4 w-4" />
                    No hidden fees
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Our Work</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See our professional team in action and the quality service we provide to families and businesses.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-1">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={movingTruck1} 
                  alt="Professional mover using hand truck and loading ramp to safely transport heavy boxes" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">Professional Equipment</h3>
                <p className="text-muted-foreground text-sm">Our modern fleet of moving trucks ensures your belongings are transported safely.</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-2">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={movers1} 
                  alt="JC ON THE MOVE crew after a successful safe move" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">Successful Safe Moves</h3>
                <p className="text-muted-foreground text-sm">We move anything so you don't have to. Our crew celebrates every successful move.</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-3">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={customerReviews} 
                  alt="5-star customer reviews showing excellent ratings and testimonials for JC ON THE MOVE moving services" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">5-Star Customer Reviews</h3>
                <p className="text-muted-foreground text-sm">See what our satisfied customers are saying about our professional moving services.</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-4">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={movingTruck2} 
                  alt="Moving truck with professional loading" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">Reliable Service</h3>
                <p className="text-muted-foreground text-sm">On-time delivery and careful handling of your precious belongings.</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-5">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={movers2} 
                  alt="Professional packing service - neatly organized and labeled moving boxes in storage" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">Careful Packing</h3>
                <p className="text-muted-foreground text-sm">We use quality materials and techniques to protect your items during transit.</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-300" data-testid="gallery-item-6">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={happyFamily2} 
                  alt="Satisfied customers in new home" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2">Stress-Free Moving</h3>
                <p className="text-muted-foreground text-sm">Making your transition to a new home smooth and enjoyable.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Company Slideshow Section */}
      <CompanySlideshow />

      {/* Quote Form Section */}
      <QuoteForm />

      {/* Trust Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose JC ON THE MOVE?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center" data-testid="trust-licensed">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fully Licensed & Insured</h3>
              <p className="text-muted-foreground">Complete protection for your belongings</p>
            </div>
            
            <div className="text-center" data-testid="trust-experienced">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Experienced Team</h3>
              <p className="text-muted-foreground">Professional movers with years of expertise</p>
            </div>
            
            <div className="text-center" data-testid="trust-ontime">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">On-Time Service</h3>
              <p className="text-muted-foreground">Reliable scheduling you can count on</p>
            </div>
            
            <div className="text-center" data-testid="trust-pricing">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Transparent Pricing</h3>
              <p className="text-muted-foreground">No hidden fees or surprise charges</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-28 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Get In Touch</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Ready to move? Contact us today for your free quote and let our professional team 
                take the stress out of your move.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center" data-testid="contact-phone">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-lg flex items-center justify-center mr-4">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Phone</h3>
                    <p className="text-muted-foreground">(906) 285-9312</p>
                  </div>
                </div>
                
                <div className="flex items-center" data-testid="contact-email">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-lg flex items-center justify-center mr-4">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Email</h3>
                    <p className="text-muted-foreground">upmichiganstatemovers@gmail.com</p>
                  </div>
                </div>
                
                <div className="flex items-center" data-testid="contact-area">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-lg flex items-center justify-center mr-4">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Service Area</h3>
                    <p className="text-muted-foreground">Greater Metro Area & Surrounding Counties</p>
                  </div>
                </div>
                
                <div className="flex items-center" data-testid="contact-hours">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-lg flex items-center justify-center mr-4">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Business Hours</h3>
                    <p className="text-muted-foreground">Mon-Sat: 7AM-7PM, Sun: CLOSED</p>
                  </div>
                </div>
              </div>
            </div>
            
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
