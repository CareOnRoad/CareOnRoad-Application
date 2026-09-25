/**
 * Lightweight API client interface used by web pages.
 * Today: every method returns mock data from `@/lib/mock-data`.
 * Tomorrow: replace internals with `fetch('/api/v1/...')` calls once BE is wired.
 *
 * Keep method signatures stable so swapping is a 1-file change.
 */

import {
  contactChannels,
  emergencyRequests,
  faqItems,
  generateBookingSlots,
  heroHighlights,
  heroStats,
  newsArticles,
  processSteps,
  serviceCategories,
  testimonials,
} from "./mock-data";
import type {
  BookingSlot,
  ContactChannel,
  EmergencyRequest,
  FaqItem,
  NewsArticle,
  ProcessStep,
  ServiceCategory,
  Testimonial,
} from "@/types";

const isBrowser = typeof window !== "undefined";

function delay<T>(value: T, ms = 80): Promise<T> {
  if (!isBrowser) return Promise.resolve(value);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const apiClient = {
  async getHeroHighlights(): Promise<string[]> {
    return delay(heroHighlights);
  },
  async getHeroStats() {
    return delay(heroStats);
  },
  async listServiceCategories(): Promise<ServiceCategory[]> {
    return delay(serviceCategories);
  },
  async listProcessSteps(): Promise<ProcessStep[]> {
    return delay(processSteps);
  },
  async listTestimonials(): Promise<Testimonial[]> {
    return delay(testimonials);
  },
  async listNewsArticles(): Promise<NewsArticle[]> {
    return delay(newsArticles);
  },
  async listFaqs(): Promise<FaqItem[]> {
    return delay(faqItems);
  },
  async listContactChannels(): Promise<ContactChannel[]> {
    return delay(contactChannels);
  },
  async listBookingSlots(): Promise<BookingSlot[]> {
    return delay(generateBookingSlots());
  },
  async listEmergencyRequests(): Promise<EmergencyRequest[]> {
    return delay(emergencyRequests);
  },
};

export type ApiClient = typeof apiClient;
