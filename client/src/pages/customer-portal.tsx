import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Package, Star, Camera, MapPin, Phone, Mail, Calendar, Truck } from "lucide-react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  fromAddress: string;
  toAddress?: string;
  moveDate?: string;
  propertySize?: string;
  details?: string;
  status: string;
  createdAt: string;
}

interface ShopItem {
  id: string;
  title: string;
  description?: string;
  price: string;
  photos: string[];
  status: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  quoted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  available: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  accepted: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
};

// Sample Google reviews (would come from API in production)
const googleReviews = [
  {
    id: "1",
    author: "Sarah Johnson",
    rating: 5,
    text: "JC ON THE MOVE made our move so smooth! Professional team and great service.",
    date: "2 days ago"
  },
  {
    id: "2",
    author: "Michael Brown",
    rating: 5,
    text: "Highly recommend! They handled everything with care and were very efficient.",
    date: "1 week ago"
  },
  {
    id: "3",
    author: "Emily Davis",
    rating: 5,
    text: "Best moving company in Michigan! Will definitely use them again.",
    date: "2 weeks ago"
  }
];

// Sample Google photos (would come from Google My Business API)
const googlePhotos = [
  "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400",
  "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=400"
];

export default function CustomerPortal() {
  // Fetch only current customer's job requests
  const { data: myJobs = [], isLoading: jobsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/my-requests"],
  });

  const { data: shopItems = [] } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop"],
  });

  const activeShopItems = shopItems.filter(item => item.status === 'active');

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">My Portal</h1>
          <p className="text-muted-foreground">Track your service requests and explore our offerings</p>
        </div>

        {/* My Service Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              My Service Requests
            </CardTitle>
            <CardDescription>View and track your moving and junk removal requests</CardDescription>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <p className="text-muted-foreground">Loading your requests...</p>
            ) : myJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't submitted any service requests yet.</p>
                <Link href="/#quote">
                  <Button data-testid="button-request-quote">Request a Quote</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    data-testid={`job-request-${job.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg capitalize">{job.serviceType} Service</h3>
                        <p className="text-sm text-muted-foreground">
                          Requested on {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={statusColors[job.status] || ""} data-testid={`status-${job.id}`}>
                        {job.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">From:</p>
                          <p className="text-muted-foreground">{job.fromAddress}</p>
                        </div>
                      </div>
                      {job.toAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">To:</p>
                            <p className="text-muted-foreground">{job.toAddress}</p>
                          </div>
                        </div>
                      )}
                      {job.moveDate && (
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Date:</p>
                            <p className="text-muted-foreground">
                              {new Date(job.moveDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {job.propertySize && (
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Property Size:</p>
                            <p className="text-muted-foreground">{job.propertySize}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {job.details && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">{job.details}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shop & Reviews Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mini Shop */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shop
              </CardTitle>
              <CardDescription>Browse items available for purchase</CardDescription>
            </CardHeader>
            <CardContent>
              {activeShopItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No items available at the moment</p>
              ) : (
                <div className="space-y-3">
                  {activeShopItems.slice(0, 3).map((item) => (
                    <Link href={`/shop/${item.id}`} key={item.id}>
                      <div className="flex gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                        {item.photos.length > 0 && (
                          <img
                            src={item.photos[0]}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-primary font-semibold">${item.price}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Link href="/shop">
                    <Button variant="outline" className="w-full" data-testid="button-view-all-shop">
                      View All Items
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Customer Reviews
              </CardTitle>
              <CardDescription>See what our customers are saying</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {googleReviews.map((review) => (
                  <div key={review.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-sm">{review.author}</p>
                      <div className="flex gap-0.5">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{review.text}</p>
                    <p className="text-xs text-muted-foreground">{review.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Photo Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Our Work Gallery
            </CardTitle>
            <CardDescription>Recent photos from our moving and junk removal services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {googlePhotos.map((photo, index) => (
                <div key={index} className="aspect-square overflow-hidden rounded-lg">
                  <img
                    src={photo}
                    alt={`Gallery photo ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Get in touch with us</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href="tel:+15172025454" className="text-primary hover:underline">
                  (517) 202-5454
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href="mailto:jconthemove@gmail.com" className="text-primary hover:underline">
                  jconthemove@gmail.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
