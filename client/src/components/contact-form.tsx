import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertContactSchema, type InsertContact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export default function ContactForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const submitContact = useMutation({
    mutationFn: async (data: InsertContact) => {
      const response = await apiRequest("POST", "/api/contacts", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent!",
        description: "We will get back to you soon.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContact) => {
    submitContact.mutate(data);
  };

  return (
    <Card className="shadow-lg border border-border">
      <CardContent className="p-8">
        <h3 className="text-2xl font-semibold mb-6">Quick Contact</h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="contact-name">Your Name *</Label>
            <Input
              id="contact-name"
              placeholder="Your Name"
              {...form.register("name")}
              data-testid="input-contact-name"
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm mt-1" data-testid="error-contact-name">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="contact-email">Your Email *</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="Your Email"
              {...form.register("email")}
              data-testid="input-contact-email"
            />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm mt-1" data-testid="error-contact-email">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="contact-phone">Your Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="Your Phone"
              {...form.register("phone")}
              data-testid="input-contact-phone"
            />
          </div>
          <div>
            <Label htmlFor="contact-message">Your Message *</Label>
            <Textarea
              id="contact-message"
              rows={4}
              placeholder="Your Message"
              {...form.register("message")}
              data-testid="textarea-contact-message"
            />
            {form.formState.errors.message && (
              <p className="text-destructive text-sm mt-1" data-testid="error-contact-message">{form.formState.errors.message.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 font-semibold"
            disabled={submitContact.isPending}
            data-testid="button-submit-contact"
          >
            {submitContact.isPending ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
