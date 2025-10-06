import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, User, Phone, Mail, FileText, Image as ImageIcon } from "lucide-react";
import type { Lead } from "@shared/schema";

export default function JobDetailPage() {
  const [, params] = useRoute("/job/:id");
  const [, navigate] = useLocation();
  const jobId = params?.id;

  const { data: job, isLoading } = useQuery<Lead>({
    queryKey: [`/api/leads/${jobId}`],
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading job details...</div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-lg">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Job not found</p>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate("/admin")} data-testid="button-back-to-admin">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photos = Array.isArray(job.photos) ? job.photos : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/admin")} 
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-job-title">
                {job.firstName} {job.lastName}
              </h1>
              <p className="text-muted-foreground mt-1" data-testid="text-job-service">
                {job.serviceType} Service
              </p>
            </div>
            <Badge 
              variant={job.status === 'new' ? 'default' : 'secondary'}
              className="text-sm px-4 py-2"
              data-testid="badge-status"
            >
              {job.status}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <Card data-testid="card-contact-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2" data-testid="contact-email">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{job.email}</span>
              </div>
              <div className="flex items-center gap-2" data-testid="contact-phone">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{job.phone}</span>
              </div>
            </CardContent>
          </Card>

          {/* Job Details */}
          <Card data-testid="card-job-details">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.moveDate && (
                <div className="flex items-center gap-2" data-testid="job-move-date">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Move Date: {job.moveDate}</span>
                </div>
              )}
              {job.propertySize && (
                <div className="flex items-center gap-2" data-testid="job-property-size">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Property Size: {job.propertySize}</span>
                </div>
              )}
              <div className="flex items-center gap-2" data-testid="job-created-date">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card className="md:col-span-2" data-testid="card-addresses">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">From Address</p>
                <p className="text-base" data-testid="text-from-address">{job.fromAddress}</p>
              </div>
              {job.toAddress && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">To Address</p>
                  <p className="text-base" data-testid="text-to-address">{job.toAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Details */}
          {job.details && (
            <Card className="md:col-span-2" data-testid="card-additional-details">
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base whitespace-pre-wrap" data-testid="text-details">{job.details}</p>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <Card className="md:col-span-2" data-testid="card-photos">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Job Photos ({photos.length})
                </CardTitle>
                <CardDescription>Photos uploaded for this job</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.map((photo: any, index: number) => (
                    <div 
                      key={photo.id || index} 
                      className="relative group cursor-pointer"
                      data-testid={`photo-${index}`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.description || `Job photo ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      {photo.type && (
                        <Badge 
                          className="absolute top-2 left-2 text-xs"
                          variant="secondary"
                        >
                          {photo.type}
                        </Badge>
                      )}
                      {photo.description && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
