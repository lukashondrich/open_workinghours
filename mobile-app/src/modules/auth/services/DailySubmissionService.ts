/**
 * DailySubmissionService - Handles authenticated daily work event submissions
 * Replaces WeeklySubmissionService (v1.x) with v2.0 architecture
 */

import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { AuthStorage } from '@/lib/auth/AuthStorage';
import type { DailySubmissionRecord } from '@/modules/geofencing/types';

const BASE_URL = Constants.expoConfig?.extra?.submissionBaseUrl || 'http://localhost:8000';

export class DailySubmissionService {
  /**
   * Enqueue a confirmed day for submission
   * NO NOISE APPLIED - raw data sent to backend
   */
  static async enqueueDailySubmission(date: string): Promise<DailySubmissionRecord> {
    const db = await getDatabase();

    // Get daily actual (already confirmed)
    const dailyActuals = await db.getDailyActualsByDates([date]);
    if (dailyActuals.length === 0) {
      throw new Error(`No confirmed data found for ${date}`);
    }

    const actual = dailyActuals[0];

    // Create submission record (RAW DATA, no noise)
    const record: DailySubmissionRecord = {
      id: Crypto.randomUUID(),
      date: actual.date,
      plannedHours: actual.plannedMinutes / 60,
      actualHours: actual.actualMinutes / 60,
      source: actual.source,
      status: 'pending',
      createdAt: new Date().toISOString(),
      submittedAt: null,
      errorMessage: null,
    };

    // Save to queue
    await db.enqueueDailySubmission(record);

    return record;
  }

  /**
   * Send a single daily submission to backend
   * Requires authentication (JWT token)
   */
  static async sendDailySubmission(record: DailySubmissionRecord): Promise<void> {
    const db = await getDatabase();

    try {
      // Get auth token
      const token = await AuthStorage.getToken();
      if (!token) {
        throw new Error('No authentication token found. Please login.');
      }

      // Update status to 'sending'
      await db.updateDailySubmissionStatus(record.id, 'sending');

      // Send to backend
      const response = await fetch(`${BASE_URL}/work-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: record.date,
          planned_hours: record.plannedHours,
          actual_hours: record.actualHours,
          source: record.source,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }

        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Mark as sent
      await db.updateDailySubmissionStatus(
        record.id,
        'sent',
        new Date().toISOString(),
        null
      );
    } catch (error) {
      console.error('[DailySubmissionService] Failed to send submission:', error);

      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await db.updateDailySubmissionStatus(
        record.id,
        'failed',
        null,
        errorMessage
      );

      throw error;
    }
  }

  /**
   * Process all pending submissions in the queue
   * Sends them one by one (with exponential backoff on failure)
   */
  static async processQueue(maxRetries: number = 10): Promise<void> {
    const db = await getDatabase();

    // Get all pending submissions
    const pending = await db.getDailySubmissionQueue('pending');

    for (const record of pending) {
      let retryCount = 0;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          await this.sendDailySubmission(record);
          success = true;
        } catch (error) {
          retryCount++;
          console.warn(
            `[DailySubmissionService] Retry ${retryCount}/${maxRetries} failed for ${record.date}:`,
            error
          );

          if (retryCount < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 32000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        console.error(
          `[DailySubmissionService] Failed to send ${record.date} after ${maxRetries} attempts`
        );
      }
    }
  }

  /**
   * Retry a single failed submission
   */
  static async retrySubmission(id: string): Promise<void> {
    const db = await getDatabase();

    const queue = await db.getDailySubmissionQueue();
    const record = queue.find((r) => r.id === id);

    if (!record) {
      throw new Error('Submission not found');
    }

    // Reset to pending
    await db.updateDailySubmissionStatus(id, 'pending', null, null);

    // Attempt to send
    await this.sendDailySubmission(record);
  }

  /**
   * Get all submissions in the queue
   */
  static async getQueue(): Promise<DailySubmissionRecord[]> {
    const db = await getDatabase();
    return db.getDailySubmissionQueue();
  }

  /**
   * Delete a submission from the queue
   */
  static async deleteSubmission(id: string): Promise<void> {
    const db = await getDatabase();
    await db.deleteDailySubmission(id);
  }
}
