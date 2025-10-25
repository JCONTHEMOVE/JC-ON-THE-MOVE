import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, BookOpen, Store, Star, Camera, MapPin, Phone, Mail, Plus, Settings, Award, User } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  serviceType: string;
  status: string;
  moveDate?: string;
  createdAt: string;
  phone?: string;
  email?: string;
  fromAddress?: string;
  toAddress?: string;
  details?: string;
  createdByUserId?: string;
  tokenAllocation?: number;
  basePrice?: string;
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Lead | null>(null);
  const [tokenAllocation, setTokenAllocation] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const scripture = getDailyScripture();
  const { toast } = useToast();

  const { data: allJobs = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  const { data: shopItems = [] } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
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
      // Parse the ISO date string and extract year, month, day to avoid timezone issues
      const moveDate = job.moveDate!;
      const dateParts = moveDate.split('T')[0].split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
      const day = parseInt(dateParts[2]);
      const date = new Date(year, month, day).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(job);
      return acc;
    }, {} as Record<string, Lead[]>);

  const pendingCount = allJobs.filter(j => 
    ['new', 'contacted', 'quoted', 'confirmed', 'available', 'accepted'].includes(j.status)
  ).length;

  const completedCount = allJobs.filter(j => j.status === 'completed').length;

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (data: { jobId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/leads/${data.jobId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: "Job updated successfully",
      });
      setIsManageDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      });
    },
  });

  // Handle date click
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsDialogOpen(true);
  };

  // Handle manage job click
  const handleManageJob = (job: Lead) => {
    setSelectedJob(job);
    setTokenAllocation(job.tokenAllocation?.toString() || "");
    setBasePrice(job.basePrice || "");
    setIsManageDialogOpen(true);
  };

  // Update job status
  const updateJobStatus = (newStatus: string) => {
    if (!selectedJob) return;
    updateJobMutation.mutate({
      jobId: selectedJob.id,
      updates: {
        status: newStatus,
        tokenAllocation: tokenAllocation ? parseFloat(tokenAllocation) : undefined,
        basePrice: basePrice || undefined,
      },
    });
  };

  // Get jobs for selected date
  const selectedDateJobs = selectedDate 
    ? jobsByDate[selectedDate.toDateString()] || []
    : [];

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
          className="h-20 border border-border p-1 bg-background hover:bg-accent/50 transition-colors cursor-pointer"
          data-testid={`calendar-day-${day}`}
          onClick={() => handleDateClick(date)}
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
                <Link href="/employee/add-job">
                  <Button
                    size="sm"
                    className="gap-1"
                    data-testid="button-add-job"
                  >
                    <Plus className="h-4 w-4" />
                    Add Job
                  </Button>
                </Link>
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

        {/* Jobs Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Jobs on {selectedDate?.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </DialogTitle>
              <DialogDescription>
                {selectedDateJobs.length === 0 
                  ? "No jobs scheduled for this day"
                  : `${selectedDateJobs.length} job${selectedDateJobs.length > 1 ? 's' : ''} scheduled`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {selectedDateJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs scheduled for this date
                </div>
              ) : (
                selectedDateJobs.map(job => (
                  <Card key={job.id} className="border" data-testid={`job-dialog-${job.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">
                            {job.firstName} {job.lastName}
                          </h3>
                          <Badge
                            variant={job.status === 'completed' ? 'default' : 'secondary'}
                            className={job.status === 'completed' ? 'bg-green-600' : ''}
                          >
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              job.serviceType === 'residential' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              job.serviceType === 'commercial' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }>
                              {job.serviceType === 'residential' ? 'Residential' : 
                               job.serviceType === 'commercial' ? 'Commercial' : 
                               'Junk Removal'}
                            </Badge>
                          </div>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${job.phone}`} className="hover:underline">
                              {job.phone}
                            </a>
                          </p>
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${job.email}`} className="hover:underline">
                              {job.email}
                            </a>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {job.fromAddress}
                          </p>
                          {job.toAddress && (
                            <p className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              To: {job.toAddress}
                            </p>
                          )}
                        </div>
                        {job.details && (
                          <p className="text-sm mt-2 p-2 bg-muted rounded">
                            {job.details}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            onClick={() => handleManageJob(job)}
                            data-testid={`button-manage-job-${job.id}`}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Manage Job
                          </Button>
                          <Button variant="outline" size="sm" asChild data-testid={`button-call-${job.id}`}>
                            <a href={`tel:${job.phone}`}>
                              <Phone className="h-4 w-4 mr-1" />
                              Call
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild data-testid={`button-email-${job.id}`}>
                            <a href={`mailto:${job.email}`}>
                              <Mail className="h-4 w-4 mr-1" />
                              Email
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Job Management Modal */}
        <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Manage Job
              </DialogTitle>
              <DialogDescription>
                Update job details, assign rewards, and change status
              </DialogDescription>
            </DialogHeader>

            {selectedJob && (
              <div className="space-y-6 mt-4">
                {/* Customer Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <p className="text-sm mt-1">{selectedJob.firstName} {selectedJob.lastName}</p>
                    </div>
                    <div>
                      <Label>Service Type</Label>
                      <Badge className="mt-1">
                        {selectedJob.serviceType === 'residential' ? 'Residential' : 
                         selectedJob.serviceType === 'commercial' ? 'Commercial' : 
                         'Junk Removal'}
                      </Badge>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <p className="text-sm mt-1">
                        <a href={`tel:${selectedJob.phone}`} className="hover:underline text-primary">
                          {selectedJob.phone}
                        </a>
                      </p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm mt-1">
                        <a href={`mailto:${selectedJob.email}`} className="hover:underline text-primary">
                          {selectedJob.email}
                        </a>
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label>From Address</Label>
                    <p className="text-sm mt-1">{selectedJob.fromAddress}</p>
                  </div>
                  {selectedJob.toAddress && (
                    <div>
                      <Label>To Address</Label>
                      <p className="text-sm mt-1">{selectedJob.toAddress}</p>
                    </div>
                  )}
                  {selectedJob.details && (
                    <div>
                      <Label>Details</Label>
                      <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedJob.details}</p>
                    </div>
                  )}
                  {selectedJob.moveDate && (
                    <div>
                      <Label>Move Date</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedJob.moveDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Created By */}
                {selectedJob.createdByUserId && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-xs text-muted-foreground">Created By</Label>
                    </div>
                    <p className="text-sm font-medium">User ID: {selectedJob.createdByUserId}</p>
                    <p className="text-xs text-muted-foreground">
                      Created on {new Date(selectedJob.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Job Management */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Job Management
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="base-price">Base Price ($)</Label>
                      <Input
                        id="base-price"
                        type="number"
                        placeholder="e.g., 500"
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        data-testid="input-base-price"
                      />
                    </div>
                    <div>
                      <Label htmlFor="token-allocation">JCMOVES Tokens</Label>
                      <Input
                        id="token-allocation"
                        type="number"
                        placeholder="e.g., 1000"
                        value={tokenAllocation}
                        onChange={(e) => setTokenAllocation(e.target.value)}
                        data-testid="input-token-allocation"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Reward Pool: {tokenAllocation || '0'} JCMOVES tokens
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Employees will earn bonuses from this pool based on performance
                    </p>
                  </div>
                </div>

                {/* Status Workflow */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Job Status</h3>
                  
                  <div className="flex items-center gap-2">
                    <Label>Current Status:</Label>
                    <Badge variant={selectedJob.status === 'completed' ? 'default' : 'secondary'}>
                      {selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedJob.status === 'new' && (
                      <Button 
                        onClick={() => updateJobStatus('quoted')}
                        disabled={updateJobMutation.isPending}
                        data-testid="button-mark-quoted"
                      >
                        Mark as Quoted
                      </Button>
                    )}
                    
                    {['new', 'quoted'].includes(selectedJob.status) && (
                      <Button 
                        onClick={() => updateJobStatus('accepted')}
                        disabled={updateJobMutation.isPending}
                        data-testid="button-mark-accepted"
                      >
                        Mark as Accepted
                      </Button>
                    )}
                    
                    {['accepted', 'confirmed', 'in-progress'].includes(selectedJob.status) && (
                      <Button 
                        onClick={() => updateJobStatus('completed')}
                        disabled={updateJobMutation.isPending}
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-mark-completed"
                      >
                        Mark as Completed
                      </Button>
                    )}

                    {selectedJob.status === 'completed' && (
                      <div className="w-full p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          ✅ Job Completed Successfully!
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Workflow: New → Quoted → Accepted → Completed
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsManageDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-close-manage"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      if (!selectedJob) return;
                      updateJobMutation.mutate({
                        jobId: selectedJob.id,
                        updates: {
                          tokenAllocation: tokenAllocation ? parseFloat(tokenAllocation) : undefined,
                          basePrice: basePrice || undefined,
                        },
                      });
                    }}
                    disabled={updateJobMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-changes"
                  >
                    {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
