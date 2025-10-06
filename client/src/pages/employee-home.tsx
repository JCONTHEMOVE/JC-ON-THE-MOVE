import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, BookOpen, Store, Star, Camera, MapPin, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  serviceType: string;
  status: string;
  moveDate?: string;
  createdAt: string;
}

interface ShopItem {
  id: string;
  title: string;
  price: string;
  photos: string[];
  status: string;
}

// Daily scripture verses - rotates based on day of year
const dailyScriptures = [
  {
    verse: "I can do all things through Christ who strengthens me.",
    reference: "Philippians 4:13"
  },
  {
    verse: "Trust in the LORD with all your heart and lean not on your own understanding.",
    reference: "Proverbs 3:5"
  },
  {
    verse: "For God so loved the world that he gave his one and only Son.",
    reference: "John 3:16"
  },
  {
    verse: "The LORD is my shepherd; I shall not want.",
    reference: "Psalm 23:1"
  },
  {
    verse: "Be strong and courageous. Do not be afraid; do not be discouraged.",
    reference: "Joshua 1:9"
  },
  {
    verse: "And we know that in all things God works for the good of those who love him.",
    reference: "Romans 8:28"
  },
  {
    verse: "Cast all your anxiety on him because he cares for you.",
    reference: "1 Peter 5:7"
  }
];

function getDailyScripture() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return dailyScriptures[dayOfYear % dailyScriptures.length];
}

export default function EmployeeHomePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const scripture = getDailyScripture();

  const { data: allJobs = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: shopItems = [] } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop"],
  });

  // Get jobs for current month
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999); // Set to end of day to include all jobs on last day

  const jobsByDate = allJobs
    .filter(job => {
      if (!job.moveDate) return false;
      const jobDate = new Date(job.moveDate);
      return jobDate >= monthStart && jobDate <= monthEnd;
    })
    .reduce((acc, job) => {
      const date = new Date(job.moveDate!).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(job);
      return acc;
    }, {} as Record<string, Lead[]>);

  const pendingCount = allJobs.filter(j => 
    ['new', 'contacted', 'quoted', 'confirmed', 'available', 'accepted'].includes(j.status)
  ).length;

  const completedCount = allJobs.filter(j => j.status === 'completed').length;

  // Mini shop - get 3 most recent items
  const recentShopItems = shopItems
    .filter(item => item.status === 'active')
    .slice(0, 3);

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

  // Calendar rendering
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 border border-border bg-muted/30"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toDateString();
      const jobsOnDate = jobsByDate[dateStr] || [];

      days.push(
        <div
          key={day}
          className="h-20 border border-border p-1 bg-background hover:bg-accent/50 transition-colors"
          data-testid={`calendar-day-${day}`}
        >
          <div className="text-sm font-semibold">{day}</div>
          <div className="space-y-0.5 mt-1">
            {jobsOnDate.map(job => (
              <div
                key={job.id}
                className={`text-[10px] px-1 rounded truncate ${
                  job.status === 'completed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}
              >
                {job.firstName}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Update Center</h1>
          <p className="text-muted-foreground">Your daily hub for JC ON THE MOVE</p>
        </div>

        {/* Daily Scripture */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Daily Scripture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="text-xl font-bold italic text-foreground mb-2">
              "{scripture.verse}"
            </blockquote>
            <p className="text-sm text-muted-foreground font-semibold">
              - {scripture.reference}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()} Jobs
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  data-testid="button-prev-month"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                  data-testid="button-today"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  data-testid="button-next-month"
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Pending: {pendingCount}
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200">
                Completed: {completedCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          </CardContent>
        </Card>

        {/* Split Section: Mini Shop & Google Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Mini Shop */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Mini Shop
              </CardTitle>
              <CardDescription>Latest items for sale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentShopItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No items available</p>
              ) : (
                recentShopItems.map(item => (
                  <Link key={item.id} href={`/shop/${item.id}`}>
                    <div className="flex gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`shop-item-${item.id}`}>
                      {item.photos && item.photos[0] && (
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
                        <p className="text-lg font-bold text-primary">${item.price}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
              <Link href="/shop">
                <Button variant="outline" className="w-full" data-testid="button-view-all-shop">
                  View All Items
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Google Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                Recent Google Reviews
              </CardTitle>
              <CardDescription>What customers are saying</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {googleReviews.map(review => (
                <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0" data-testid={`review-${review.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{review.author}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{review.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{review.date}</p>
                </div>
              ))}
              <a 
                href="https://www.google.com/search?q=jc+on+the+move" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full" data-testid="button-view-all-reviews">
                  View All Reviews
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Google Photos Showcase */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              JC ON THE MOVE Photo Gallery
            </CardTitle>
            <CardDescription>Recent photos from our Google page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {googlePhotos.map((photo, index) => (
                <div
                  key={index}
                  className="aspect-square overflow-hidden rounded-lg border border-border hover:scale-105 transition-transform cursor-pointer"
                  data-testid={`gallery-photo-${index}`}
                >
                  <img
                    src={photo}
                    alt={`JC ON THE MOVE photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <a 
              href="https://www.google.com/maps/place/JC+ON+THE+MOVE" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 block"
            >
              <Button variant="outline" className="w-full" data-testid="button-view-more-photos">
                View More Photos on Google
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard">
            <Button className="w-full h-20 text-lg" data-testid="button-view-jobs">
              View My Jobs
            </Button>
          </Link>
          <Link href="/rewards">
            <Button variant="outline" className="w-full h-20 text-lg" data-testid="button-rewards">
              Rewards & Faucet
            </Button>
          </Link>
          <Link href="/shop/create">
            <Button variant="outline" className="w-full h-20 text-lg" data-testid="button-post-item">
              Post Shop Item
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
