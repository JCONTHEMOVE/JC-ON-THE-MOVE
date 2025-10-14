import { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  Settings,
  Check,
  X,
  Copy,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface UserWallet {
  id: string;
  walletAddress: string;
  balance: string;
  currency: {
    symbol: string;
    name: string;
    network: string;
  };
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpImages, setHelpImages] = useState<File[]>([]);
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch user wallets
  const { data: walletsResponse, isLoading: walletsLoading, error: walletsError } = useQuery<{ wallets: UserWallet[] }>({
    queryKey: ['/api/wallets'],
    enabled: !!user,
  });

  // Fetch transfer summary
  const { data: transferSummary, isLoading: transferLoading } = useQuery<{
    totalWithdrawn: string;
    transactionCount: number;
    walletCount: number;
  }>({
    queryKey: ['/api/wallets/transfer-summary'],
    enabled: !!user && user?.role === 'admin',
  });

  const wallets = walletsResponse?.wallets || [];
  const isSolanaConnected = wallets.some(w => w.currency.network === 'solana');

  // Sync username state when user data loads
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user?.username]);

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
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const profileImageUrl = await base64Promise;
      const response = await apiRequest('POST', '/api/user/profile-image', { profileImageUrl });
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
      // Convert images to base64
      const imagePromises = data.images.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      
      const imageUrls = await Promise.all(imagePromises);
      const response = await apiRequest('POST', '/api/support/help-request', { 
        message: data.message,
        imageUrls 
      });
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

  const updateUsernameMutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const response = await apiRequest('POST', '/api/auth/user/username', { username: newUsername });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Username updated",
        description: "Your username has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update username",
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({
      title: "Copied!",
      description: "Wallet address copied to clipboard",
    });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const checkUsernameAvailability = async (newUsername: string) => {
    // Abort any in-flight request before validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Validate length
    if (newUsername.length < 3 || newUsername.length > 20) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    // Validate characters (alphanumeric + underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    // No need to check if unchanged
    if (newUsername === user?.username) {
      setUsernameAvailable(true);
      setCheckingUsername(false);
      return;
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setCheckingUsername(true);
    try {
      const response = await fetch(`/api/auth/username/check/${newUsername}`, {
        signal: controller.signal
      });
      const data = await response.json();
      
      // Only update state if this is still the latest request
      if (!controller.signal.aborted) {
        setUsernameAvailable(data.available);
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        setUsernameAvailable(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCheckingUsername(false);
      }
    }
  };

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
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium" data-testid="text-username">{user?.username || 'Not set'}</p>
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
              <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="settings" data-testid="tab-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </TabsTrigger>
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

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Account Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage your account preferences and display settings
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username (Display Name)</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your username will be displayed instead of your email address throughout the website
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Input
                            id="username"
                            value={username}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUsername(value);
                              // Always call to ensure in-flight requests are aborted
                              checkUsernameAvailability(value);
                            }}
                            placeholder="Choose a username"
                            className={`pr-8 ${usernameAvailable === false ? 'border-destructive' : usernameAvailable === true ? 'border-green-500' : ''}`}
                            data-testid="input-username"
                          />
                          {checkingUsername && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            </div>
                          )}
                          {!checkingUsername && usernameAvailable === true && (
                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                          )}
                          {!checkingUsername && usernameAvailable === false && (
                            <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <Button
                          onClick={() => updateUsernameMutation.mutate(username)}
                          disabled={!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username) || usernameAvailable === false || updateUsernameMutation.isPending || username === user?.username}
                          data-testid="button-save-username"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updateUsernameMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                      {username.length > 0 && username.length < 3 && (
                        <p className="text-sm text-destructive mt-1">Username must be at least 3 characters</p>
                      )}
                      {username.length > 20 && (
                        <p className="text-sm text-destructive mt-1">Username must be 20 characters or less</p>
                      )}
                      {username.length >= 3 && username.length <= 20 && !/^[a-zA-Z0-9_]+$/.test(username) && (
                        <p className="text-sm text-destructive mt-1">Username can only contain letters, numbers, and underscores</p>
                      )}
                      {usernameAvailable === false && (
                        <p className="text-sm text-destructive mt-1">This username is already taken</p>
                      )}
                      {usernameAvailable === true && username !== user?.username && (
                        <p className="text-sm text-green-600 mt-1">This username is available</p>
                      )}
                      {username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Username can only contain letters, numbers, and underscores
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Wallet Tab */}
                <TabsContent value="wallet" className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Wallet className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">My Crypto Wallets</h3>
                    </div>
                    {isSolanaConnected && (
                      <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Connected to Solana Mainnet
                        </p>
                      </div>
                    )}
                    {walletsError && (
                      <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Failed to load wallet information
                        </p>
                      </div>
                    )}
                  </div>

                  {walletsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wallets.map((wallet) => (
                        <div
                          key={wallet.id}
                          className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          data-testid={`wallet-${wallet.currency.symbol.toLowerCase()}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{wallet.currency.symbol}</span>
                                <span className="text-sm text-muted-foreground">({wallet.currency.name})</span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                                  {wallet.walletAddress}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(wallet.walletAddress)}
                                  className="shrink-0"
                                  data-testid={`button-copy-${wallet.currency.symbol.toLowerCase()}`}
                                >
                                  {copiedAddress === wallet.walletAddress ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Balance</p>
                                  <p className="font-medium" data-testid={`balance-${wallet.currency.symbol.toLowerCase()}`}>
                                    {parseFloat(wallet.balance).toLocaleString()} {wallet.currency.symbol}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Network</p>
                                  <p className="text-sm capitalize">{wallet.currency.network}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {user?.role === 'admin' && (
                        <>
                          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                              <div>
                                <p className="font-medium text-blue-900 dark:text-blue-100">Treasury Wallet Verified</p>
                                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                  Your JCMOVES wallet address matches the treasury wallet. You have full administrative access to treasury funds.
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {transferLoading ? (
                            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                            </div>
                          ) : transferSummary && parseInt(transferSummary.transactionCount.toString()) > 0 ? (
                            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="font-medium text-purple-900 dark:text-purple-100 mb-2">Outgoing Treasury Transfers</p>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-purple-700 dark:text-purple-300">Total Transferred</p>
                                      <p className="font-semibold text-purple-900 dark:text-purple-100" data-testid="text-total-transferred">
                                        {parseFloat(transferSummary.totalWithdrawn).toLocaleString()} JCMOVES
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-purple-700 dark:text-purple-300">Transaction Count</p>
                                      <p className="font-semibold text-purple-900 dark:text-purple-100" data-testid="text-transaction-count">
                                        {transferSummary.transactionCount} transfers
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-3">
                                    Historical transfers to treasury reserve for business operations and employee rewards
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
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
