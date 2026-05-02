import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has the response structure, return as-is
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }

        // Handle paginated responses
        if (
          data &&
          typeof data === "object" &&
          "items" in data &&
          "total" in data
        ) {
          return {
            success: true,
            data: data.items,
            meta: {
              page: data.page,
              limit: data.limit,
              total: data.total,
              totalPages: data.totalPages,
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Standard response
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
