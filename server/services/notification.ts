import webpush from 'web-push';
import { storage } from '../storage';
import type { InsertNotification } from '@shared/schema';

// Configure web push (in production, set these as environment variables)
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your email
  process.env.VAPID_PUBLIC_KEY || 'temp-public-key',
  process.env.VAPID_PRIVATE_KEY || 'temp-private-key'
);

export interface NotificationData {
  userId: string;
  type: 'job_assigned' | 'job_status_change' | 'new_message' | 'system_alert';
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  // Create a notification in the database
  async createNotification(notificationData: NotificationData): Promise<void> {
    try {
      const insertData: InsertNotification = {
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
      };

      await storage.createNotification(insertData);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  // Send push notification to a user
  async sendPushNotification(userId: string, notification: { title: string; body: string; data?: any }): Promise<void> {
    try {
      // Get user's push subscription
      const user = await storage.getUser(userId);
      if (!user?.pushSubscription) {
        console.log(`No push subscription found for user ${userId}`);
        return;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-192x192.svg',
      });

      await webpush.sendNotification(user.pushSubscription, payload);
      console.log(`Push notification sent to user ${userId}`);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Send both database notification and push notification
  async sendNotification(notificationData: NotificationData): Promise<void> {
    // Create database notification
    await this.createNotification(notificationData);

    // Send push notification
    await this.sendPushNotification(notificationData.userId, {
      title: notificationData.title,
      body: notificationData.message,
      data: notificationData.data,
    });
  }

  // Helper methods for common notification types
  async notifyJobAssigned(userId: string, jobId: string, customerName: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'job_assigned',
      title: 'New Job Assigned',
      message: `You've been assigned a new job for ${customerName}`,
      data: { jobId, type: 'job_assigned' },
    });
  }

  async notifyJobStatusChange(userId: string, jobId: string, status: string, customerName: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'job_status_change',
      title: 'Job Status Updated',
      message: `Job for ${customerName} is now ${status}`,
      data: { jobId, status, type: 'job_status_change' },
    });
  }

  async notifySystemAlert(userId: string, title: string, message: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'system_alert',
      title,
      message,
      data: { type: 'system_alert' },
    });
  }

  // Notify all employees about a new job
  async notifyAllEmployees(title: string, message: string, data?: any): Promise<void> {
    try {
      const employees = await storage.getEmployees();
      
      for (const employee of employees) {
        await this.sendNotification({
          userId: employee.id,
          type: 'system_alert',
          title,
          message,
          data,
        });
      }
    } catch (error) {
      console.error('Error notifying all employees:', error);
    }
  }
}

export const notificationService = new NotificationService();