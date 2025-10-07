import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { 
  User, 
  Wallet, 
  Briefcase, 
  HelpCircle, 
  Camera, 
  Upload,
  FileImage,
  MessageSquare,
  Save,
  ArrowLeft
} from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpImages, setHelpImages] = useState<File[]>([]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHelpImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setHelpImages(prev => [...prev, ...files]);
  };

  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profileImage', file);
      
      const response = await apiRequest('POST', '/api/user/profile-image', formData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
      setProfileImage(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload profile photo",
        variant: "destructive"
      });
    }
  });

  const submitHelpRequestMutation = useMutation({
    mutationFn: async (data: { message: string; images: File[] }) => {
      const formData = new FormData();
      formData.append('message', data.message);
      data.images.forEach((image, index) => {
        formData.append(`image${index}`, image);
      });
      
      const response = await apiRequest('POST', '/api/support/help-request', formData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Help request submitted",
        description: "We'll get back to you soon",
      });
      setHelpMessage('');
      setHelpImages([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit help request",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-profile-title">My Profile</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Profile Overview Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <Avatar className="h-32 w-32 mb-4">
                  <AvatarImage src={imagePreview || user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
                </Avatar>
                
                <div className="w-full">
                  <Label htmlFor="profile-image" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 p-2 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                      <Camera className="h-4 w-4" />
                      <span className="text-sm">Change Photo</span>
                    </div>
                    <Input
                      id="profile-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      data-testid="input-profile-image"
                    />
                  </Label>
                </div>

                {profileImage && (
                  <Button
                    onClick={() => uploadProfileImageMutation.mutate(profileImage)}
                    disabled={uploadProfileImageMutation.isPending}
                    className="w-full mt-3"
                    data-testid="button-upload-photo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadProfileImageMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium" data-testid="text-user-name">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium" data-testid="text-user-email">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize" data-testid="text-user-role">{user?.role || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <Tabs defaultValue="wallet" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="wallet" data-testid="tab-wallet">
                    <Wallet className="h-4 w-4 mr-2" />
                    Wallet
                  </TabsTrigger>
                  <TabsTrigger value="jobs" data-testid="tab-jobs">
                    <Briefcase className="h-4 w-4 mr-2" />
                    My Jobs
                  </TabsTrigger>
                  <TabsTrigger value="help" data-testid="tab-help">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Get Help
                  </TabsTrigger>
                </TabsList>

                {/* Wallet Tab */}
                <TabsContent value="wallet" className="space-y-4">
                  <div className="text-center py-12">
                    <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Wallet Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Your cryptocurrency wallet will be available here when Solana blockchain integration is completed.
                    </p>
                    <div className="bg-muted p-4 rounded-lg max-w-md mx-auto">
                      <p className="text-sm">
                        You'll be able to manage your JCMOVES tokens and view your wallet balance here.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* My Jobs Tab */}
                <TabsContent value="jobs" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">My Job Assignments</h3>
                        <p className="text-sm text-muted-foreground">View and manage your jobs</p>
                      </div>
                      <Link href="/dashboard">
                        <Button data-testid="button-view-all-jobs">
                          View All Jobs
                          <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                        </Button>
                      </Link>
                    </div>

                    <div className="grid gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-muted-foreground text-center py-8">
                          Access your job dashboard to view all assigned jobs and their details.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Help Tab */}
                <TabsContent value="help" className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Submit a help request with details and images. Our team will respond as soon as possible.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="help-message">Describe your issue or question</Label>
                      <Textarea
                        id="help-message"
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder="Please describe what you need help with..."
                        rows={6}
                        className="mt-2"
                        data-testid="textarea-help-message"
                      />
                    </div>

                    <div>
                      <Label htmlFor="help-images">Attach images (optional)</Label>
                      <div className="mt-2">
                        <Label htmlFor="help-images" className="cursor-pointer">
                          <div className="flex items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                            <FileImage className="h-5 w-5" />
                            <span>Click to upload images</span>
                          </div>
                          <Input
                            id="help-images"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleHelpImagesChange}
                            className="hidden"
                            data-testid="input-help-images"
                          />
                        </Label>
                      </div>
                      
                      {helpImages.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {helpImages.length} image(s) selected
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {helpImages.map((file, index) => (
                              <div key={index} className="text-xs bg-muted px-2 py-1 rounded">
                                {file.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => submitHelpRequestMutation.mutate({ message: helpMessage, images: helpImages })}
                      disabled={!helpMessage.trim() || submitHelpRequestMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-help"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {submitHelpRequestMutation.isPending ? 'Submitting...' : 'Submit Help Request'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
