import { useCallback, useEffect, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Import all company photos
import photo1 from "@assets/IMG_20220818_061221927_HDR_1758501643284.jpg"
import photo2 from "@assets/IMG_20220919_093840705_HDR_1758501643298.jpg"
import photo3 from "@assets/FB_IMG_1675268829327_1758501643307.jpg"
import photo4 from "@assets/IMG_20220810_125649554_HDR_1758501643329.jpg"
import photo5 from "@assets/FB_IMG_1675268568106_1758501643336.jpg"
import photo6 from "@assets/FB_IMG_1675268629678_1758501643345.jpg"
import photo7 from "@assets/IMG_20220822_172039397_1758501643356.jpg"
import photo8 from "@assets/IMG_20220927_142557035_HDR_1758501643363.jpg"
import photo9 from "@assets/IMG_20230110_115751854_HDR_1758501643370.jpg"
import photo10 from "@assets/IMG_20221116_152249626_1758501643404.jpg"
import photo11 from "@assets/IMG_20220822_145153062_1758501643379.jpg"
import photo12 from "@assets/IMG_20220819_100006041_HDR_1758501643389.jpg"
import photo13 from "@assets/IMG_20221001_085145137_HDR_1758501643396.jpg"
import photo14 from "@assets/IMG_20230110_114439922_HDR_1758501643416.jpg"

const slides = [
  {
    image: photo2,
    caption: "Meet Your Professional Moving Team",
    description: "Experienced movers dedicated to your satisfaction"
  },
  {
    image: photo3,
    caption: "5-Star Rated Moving Service",
    description: "JC ON THE MOVE - trusted with your most valuable possessions"
  },
  {
    image: photo4,
    caption: "Expert Packing & Protection",
    description: "Professional techniques to keep your items safe"
  },
  {
    image: photo1,
    caption: "Professional Fleet & Equipment",
    description: "Modern trucks and tools for efficient moves"
  },
  {
    image: photo14,
    caption: "Year-Round Moving Services", 
    description: "We work in all weather conditions to serve you"
  },
  {
    image: photo10,
    caption: "Experienced, Dedicated Crew",
    description: "Our team works together to make your move smooth"
  },
  {
    image: photo7,
    caption: "Residential & Commercial Moving",
    description: "From homes to offices, we handle all types of moves"
  },
  {
    image: photo8,
    caption: "Careful Furniture Protection",
    description: "Professional wrapping and handling techniques"
  },
  {
    image: photo9,
    caption: "Secure Storage Solutions",
    description: "Safe and organized storage for your belongings"
  },
  {
    image: photo11,
    caption: "Urban Moving Specialists",
    description: "Expert navigation of city moving challenges"
  },
  {
    image: photo12,
    caption: "Reliable Equipment",
    description: "Professional-grade moving trucks and trailers"
  },
  {
    image: photo13,
    caption: "Professional Loading Systems",
    description: "Safe ramps and techniques for heavy items"
  }
]

export default function CompanySlideshow() {
  const autoplay = useRef(Autoplay({ delay: 6000, stopOnInteraction: false }))

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { 
      loop: true,
      dragFree: false,
      containScroll: 'trimSnaps'
    },
    [autoplay.current]
  )

  const scrollPrev = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollPrev()
    }
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollNext()
    }
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    // Start autoplay when component mounts
    const autoplayPlugin = autoplay.current
    if (autoplayPlugin && autoplayPlugin.play) {
      autoplayPlugin.play()
    }

    // Embla API is now initialized and ready
    
    return () => {
      if (autoplayPlugin && autoplayPlugin.stop) {
        autoplayPlugin.stop()
      }
    }
  }, [emblaApi])

  return (
    <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            See JC ON THE MOVE in Action
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Meet our professional team and see our quality equipment and techniques that make us the trusted choice for moving services.
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-xl shadow-2xl" ref={emblaRef}>
            <div className="flex">
              {slides.map((slide, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 relative">
                  <div className="aspect-[16/9] md:aspect-[21/9] relative">
                    <img
                      src={slide.image}
                      alt={slide.caption}
                      className="w-full h-full object-cover"
                      data-testid={`slideshow-image-${index + 1}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                      <h3 className="text-2xl md:text-3xl font-bold mb-2" data-testid={`slideshow-caption-${index + 1}`}>
                        {slide.caption}
                      </h3>
                      <p className="text-lg md:text-xl text-white/90" data-testid={`slideshow-description-${index + 1}`}>
                        {slide.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-white/20 text-gray-800 shadow-lg z-10"
            onClick={scrollPrev}
            data-testid="slideshow-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-white/20 text-gray-800 shadow-lg z-10"
            onClick={scrollNext}
            data-testid="slideshow-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <div className="text-center mt-8">
          <p className="text-muted-foreground">
            Professional moving services across <strong>Ironwood Michigan</strong>, <strong>Iron River Michigan</strong>, and <strong>Green Bay Wisconsin</strong>
          </p>
        </div>
      </div>
    </section>
  )
}