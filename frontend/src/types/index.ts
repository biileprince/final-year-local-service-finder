// User types
export type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profileImage?: string;
  role: UserRole;
  emailVerifiedAt?: string;
  createdAt: string;
}

// Provider types
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface ProviderSpecialty {
  id: string;
  specialty: string;
}

export interface Provider {
  id: string;
  userId: string;
  user: User;
  bio?: string;
  hourlyRate: number;
  yearsExperience: number;
  location: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
  cancellationPolicy?: string | null;
  verificationStatus: VerificationStatus;
  featured: boolean;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  totalBookings: number;
  completedBookings: number;
  categories: ProviderCategory[];
  specialties: ProviderSpecialty[];
  gallery?: ProviderGalleryItem[];
  idDocumentId?: string | null;
  businessLicenseId?: string | null;
  idDocument?: {
    id: string;
    url: string;
    fileName?: string;
    mimeType?: string;
  } | null;
  businessLicense?: {
    id: string;
    url: string;
    fileName?: string;
    mimeType?: string;
  } | null;
}

export interface ProviderCategory {
  id: string;
  category: Category;
  isPrimary: boolean;
}

export interface ProviderGalleryItem {
  id: string;
  file: {
    id: string;
    url: string;
    thumbnailUrl?: string;
  };
  title?: string;
  description?: string;
}

export interface ProviderHours {
  id: string;
  providerId: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  openMinutes: number;
  closeMinutes: number;
  isClosed: boolean;
}

export interface ProviderService {
  id: string;
  providerId: string;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  name: string;
  basePrice: number;
  durationMin: number;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  imageId?: string | null;
  image?: { id: string; url: string; thumbnailUrl?: string | null } | null;
  providerCount: number;
}

// Booking types
export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type NoShowParty = "CUSTOMER" | "PROVIDER";
export type RecurrenceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface RecurringBooking {
  id: string;
  customerId: string;
  providerId: string;
  provider?: Provider;
  frequency: RecurrenceFrequency;
  scheduledStartTime?: string | null;
  serviceAddress: string;
  problemDescription: string;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  occurrencesCreated: number;
  nextOccurrenceDate?: string | null;
  isActive: boolean;
  createdAt: string;
  bookings?: {
    id: string;
    bookingNumber: string;
    scheduledDate: string;
    status: BookingStatus;
  }[];
  _count?: { bookings: number };
}
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "REFUNDED" | "FAILED";

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customer: User;
  providerId: string;
  provider: Provider;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  serviceAddress: string;
  serviceLatitude?: number | null;
  serviceLongitude?: number | null;
  problemDescription: string;
  serviceNotes?: string;
  status: BookingStatus;
  statusChangedAt?: string;
  estimatedAmount?: number;
  finalAmount?: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  cancellationReason?: string;
  noShowParty?: NoShowParty | null;
  noShowReason?: string | null;
  noShowFlaggedAt?: string | null;
  createdAt: string;
  review?: Review;
  attachments?: BookingAttachment[];
}

export interface BookingAttachment {
  id: string;
  attachmentType: string;
  description?: string | null;
  uploadedById: string;
  uploadedBy?: { id: string; name: string };
  createdAt: string;
  file: {
    id: string;
    url: string;
    thumbnailUrl?: string | null;
    fileName: string;
    mimeType: string;
    fileSize?: number;
  };
}

// Review types
export interface Review {
  id: string;
  bookingId?: string;
  customerId: string;
  customer: User;
  providerId: string;
  provider: Provider;
  rating: number;
  title?: string;
  comment: string;
  providerResponse?: string;
  providerRespondedAt?: string;
  isVisible: boolean;
  helpfulCount: number;
  createdAt: string;
  images?: ReviewImage[];
}

export interface ReviewImage {
  id: string;
  file: {
    id: string;
    url: string;
    thumbnailUrl?: string;
  };
  caption?: string;
}

// Message types
export interface Conversation {
  id: string;
  bookingId?: string;
  customerId: string;
  customer: User;
  providerId: string;
  provider: Provider;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  customerUnreadCount: number;
  providerUnreadCount: number;
  customerLastReadAt?: string;
  providerLastReadAt?: string;
  createdAt: string;
  booking?: {
    id: string;
    bookingNumber: string;
    status: BookingStatus;
    scheduledDate?: string;
    scheduledStartTime?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: string;
  messageType: string;
  file?: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    fileName: string;
  };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

// Notification types
export type NotificationType = "EMAIL" | "SMS" | "PUSH" | "IN_APP";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// Availability types
export interface Availability {
  id: string;
  providerId: string;
  date: string;
  isAvailable: boolean;
  notes?: string;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

// File types
export type FileContext = "AVATAR" | "GALLERY" | "MESSAGE" | "REVIEW" | "VERIFICATION" | "BOOKING";

export interface FileUpload {
  id: string;
  url: string;
  thumbnailUrl?: string;
  storageKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode?: number;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface RegisterResponse extends AuthTokens {
  user: User;
}
