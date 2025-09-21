import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email notifications will be disabled.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('Email would be sent:', params);
    return true; // Return true for development when API key is not set
  }

  try {
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
    };
    
    if (params.text) emailData.text = params.text;
    if (params.html) emailData.html = params.html;
    
    await mailService.send(emailData);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generateLeadNotificationEmail(lead: any) {
  const html = `
    <h2>New Lead Submission - JC ON THE MOVE</h2>
    <p><strong>Service Type:</strong> ${lead.serviceType}</p>
    <p><strong>Customer:</strong> ${lead.firstName} ${lead.lastName}</p>
    <p><strong>Email:</strong> ${lead.email}</p>
    <p><strong>Phone:</strong> ${lead.phone}</p>
    <p><strong>From Address:</strong> ${lead.fromAddress}</p>
    ${lead.toAddress ? `<p><strong>To Address:</strong> ${lead.toAddress}</p>` : ''}
    ${lead.moveDate ? `<p><strong>Move Date:</strong> ${lead.moveDate}</p>` : ''}
    ${lead.propertySize ? `<p><strong>Property Size:</strong> ${lead.propertySize}</p>` : ''}
    ${lead.details ? `<p><strong>Additional Details:</strong> ${lead.details}</p>` : ''}
    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
  `;

  const text = `
    New Lead Submission - JC ON THE MOVE
    
    Service Type: ${lead.serviceType}
    Customer: ${lead.firstName} ${lead.lastName}
    Email: ${lead.email}
    Phone: ${lead.phone}
    From Address: ${lead.fromAddress}
    ${lead.toAddress ? `To Address: ${lead.toAddress}` : ''}
    ${lead.moveDate ? `Move Date: ${lead.moveDate}` : ''}
    ${lead.propertySize ? `Property Size: ${lead.propertySize}` : ''}
    ${lead.details ? `Additional Details: ${lead.details}` : ''}
    Submitted: ${new Date().toLocaleString()}
  `;

  return { html, text };
}

export function generateContactNotificationEmail(contact: any) {
  const html = `
    <h2>New Contact Form Submission - JC ON THE MOVE</h2>
    <p><strong>Name:</strong> ${contact.name}</p>
    <p><strong>Email:</strong> ${contact.email}</p>
    ${contact.phone ? `<p><strong>Phone:</strong> ${contact.phone}</p>` : ''}
    <p><strong>Message:</strong></p>
    <p>${contact.message}</p>
    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
  `;

  const text = `
    New Contact Form Submission - JC ON THE MOVE
    
    Name: ${contact.name}
    Email: ${contact.email}
    ${contact.phone ? `Phone: ${contact.phone}` : ''}
    Message: ${contact.message}
    Submitted: ${new Date().toLocaleString()}
  `;

  return { html, text };
}
