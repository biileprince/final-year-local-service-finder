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
  idDocument?: { id: string; url: string; fileName?: string } | null;
  businessLicense?: { id: string; url: string; fileName?: string } | null;
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

// Category types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  providerCount: number;
}

// Booking types
export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
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
  problemDescription: string;
  serviceNotes?: string;
  status: BookingStatus;
  statusChangedAt?: string;
  estimatedAmount?: number;
  finalAmount?: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  cancellationReason?: string;
  createdAt: string;
  review?: Review;
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
