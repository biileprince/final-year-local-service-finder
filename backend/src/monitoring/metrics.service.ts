import { Injectable } from "@nestjs/common";
import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

@Injectable()
export class MetricsService {
  private registry: Registry;

  // HTTP Metrics
  httpRequestsTotal: Counter;
  httpRequestDuration: Histogram;
  httpActiveRequests: Gauge;

  // Business Metrics
  bookingsCreated: Counter;
  bookingsCancelled: Counter;
  bookingsByStatus: Gauge;
  usersRegistered: Counter;
  activeProviders: Gauge;
  searchQueries: Counter;
  reviewsSubmitted: Counter;

  // Database Metrics
  dbConnectionsActive: Gauge;
  dbQueryDuration: Histogram;
  dbTransactionsTotal: Counter;

  // Cache Metrics
  cacheHits: Counter;
  cacheMisses: Counter;
  cacheOperationDuration: Histogram;

  // WebSocket Metrics
  wsConnectionsActive: Gauge;
  wsMessagesReceived: Counter;
  wsMessagesSent: Counter;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // ========================================================================
    // HTTP Metrics
    // ========================================================================

    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "path", "status"],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "path"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpActiveRequests = new Gauge({
      name: "http_active_requests",
      help: "Number of active HTTP requests",
      registers: [this.registry],
    });

    // ========================================================================
    // Business Metrics
    // ========================================================================

    this.bookingsCreated = new Counter({
      name: "bookings_created_total",
      help: "Total bookings created",
      labelNames: ["status"],
      registers: [this.registry],
    });

    this.bookingsCancelled = new Counter({
      name: "bookings_cancelled_total",
      help: "Total bookings cancelled",
      registers: [this.registry],
    });

    this.bookingsByStatus = new Gauge({
      name: "bookings_by_status",
      help: "Current bookings by status",
      labelNames: ["status"],
      registers: [this.registry],
    });

    this.usersRegistered = new Counter({
      name: "users_registered_total",
      help: "Total users registered",
      labelNames: ["role"],
      registers: [this.registry],
    });

    this.activeProviders = new Gauge({
      name: "providers_active_total",
      help: "Number of active providers",
      labelNames: ["verification_status"],
      registers: [this.registry],
    });

    this.searchQueries = new Counter({
      name: "search_queries_total",
      help: "Total search queries",
      labelNames: ["category", "has_results"],
      registers: [this.registry],
    });

    this.reviewsSubmitted = new Counter({
      name: "reviews_submitted_total",
      help: "Total reviews submitted",
      labelNames: ["rating"],
      registers: [this.registry],
    });

    // ========================================================================
    // Database Metrics
    // ========================================================================

    this.dbConnectionsActive = new Gauge({
      name: "db_connections_active",
      help: "Active database connections",
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: "db_query_duration_seconds",
      help: "Database query duration",
      labelNames: ["operation", "model"],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.dbTransactionsTotal = new Counter({
      name: "db_transactions_total",
      help: "Total database transactions",
      labelNames: ["status"],
      registers: [this.registry],
    });

    // ========================================================================
    // Cache Metrics
    // ========================================================================

    this.cacheHits = new Counter({
      name: "cache_hits_total",
      help: "Total cache hits",
      labelNames: ["cache_type"],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: "cache_misses_total",
      help: "Total cache misses",
      labelNames: ["cache_type"],
      registers: [this.registry],
    });

    this.cacheOperationDuration = new Histogram({
      name: "cache_operation_duration_seconds",
      help: "Cache operation duration",
      labelNames: ["operation"],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01],
      registers: [this.registry],
    });

    // ========================================================================
    // WebSocket Metrics
    // ========================================================================

    this.wsConnectionsActive = new Gauge({
      name: "ws_connections_active",
      help: "Active WebSocket connections",
      registers: [this.registry],
    });

    this.wsMessagesReceived = new Counter({
      name: "ws_messages_received_total",
      help: "Total WebSocket messages received",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.wsMessagesSent = new Counter({
      name: "ws_messages_sent_total",
      help: "Total WebSocket messages sent",
      labelNames: ["event_type"],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
