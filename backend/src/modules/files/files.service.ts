import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { FileContext, FileType } from "@prisma/client";

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface FileUploadResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileType: FileType;
  fileSize: number;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.configService.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.configService.get<string>("CLOUDINARY_API_SECRET"),
    });

    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // Voice notes — browsers produce different containers depending on platform:
      // Chromium → audio/webm, Safari/iOS → audio/mp4 (m4a), Firefox → audio/ogg.
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/wav",
      "audio/wave",
    ];
  }

  async upload(
    file: UploadedFile,
    userId: string,
    context: FileContext = FileContext.GALLERY,
  ): Promise<FileUploadResult> {
    // Validate file
    this.validateFile(file);

    try {
      // Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(file, context);

      // Determine file type
      const fileType = this.getFileType(file.mimetype);

      // Save to database
      const savedFile = await this.prisma.file.create({
        data: {
          uploadedById: userId,
          originalName: file.originalname,
          fileName: uploadResult.public_id.split("/").pop() || file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          fileType,
          storageProvider: "cloudinary",
          storageKey: uploadResult.public_id,
          url: uploadResult.secure_url,
          thumbnailUrl: this.getThumbnailUrl(uploadResult),
          context,
          width: uploadResult.width || null,
          height: uploadResult.height || null,
        },
      });

      this.logger.log(`File uploaded: ${savedFile.id} by user ${userId}`);

      return {
        id: savedFile.id,
        url: savedFile.url,
        thumbnailUrl: savedFile.thumbnailUrl || undefined,
        storageKey: savedFile.storageKey,
        fileName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        fileType: savedFile.fileType,
        fileSize: savedFile.fileSize,
      };
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      throw new BadRequestException("File upload failed");
    }
  }

  async uploadMultiple(
    files: UploadedFile[],
    userId: string,
    context: FileContext = FileContext.GALLERY,
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];

    for (const file of files) {
      const result = await this.upload(file, userId, context);
      results.push(result);
    }

    return results;
  }

  async getFile(id: string, userId?: string): Promise<any> {
    const file = await this.prisma.file.findUnique({
      where: { id },
    });

    if (!file || file.deletedAt) {
      throw new NotFoundException("File not found");
    }

    // Optional: verify ownership
    if (userId && file.uploadedById !== userId) {
      throw new ForbiddenException("Not authorized to access this file");
    }

    return file;
  }

  async getUserFiles(
    userId: string,
    params: { context?: FileContext; limit?: number; offset?: number } = {},
  ) {
    const { context, limit = 20, offset = 0 } = params;

    const where: any = { uploadedById: userId, deletedAt: null };
    if (context) {
      where.context = context;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      files,
      total,
      limit,
      offset,
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id },
    });

    if (!file || file.deletedAt) {
      throw new NotFoundException("File not found");
    }

    if (file.uploadedById !== userId) {
      throw new ForbiddenException("Not authorized to delete this file");
    }

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(file.storageKey);

      // Soft delete from database
      await this.prisma.file.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`File deleted: ${id}`);
    } catch (error) {
      this.logger.error(`File deletion failed: ${error.message}`);
      throw new BadRequestException("File deletion failed");
    }
  }

  async generateSignedUploadUrl(
    userId: string,
    context: FileContext = FileContext.GALLERY,
  ): Promise<{ signature: string; timestamp: number; cloudName: string; apiKey: string; folder: string }> {
    const timestamp = Math.round(Date.now() / 1000);
    const uploadFolder = `local-service-finder/${context.toLowerCase()}/${userId}`;

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: uploadFolder,
      },
      this.configService.get<string>("CLOUDINARY_API_SECRET") || "",
    );

    return {
      signature,
      timestamp,
      cloudName: this.configService.get<string>("CLOUDINARY_CLOUD_NAME") || "",
      apiKey: this.configService.get<string>("CLOUDINARY_API_KEY") || "",
      folder: uploadFolder,
    };
  }

  // Called after client-side upload to Cloudinary
  async registerUploadedFile(
    userId: string,
    data: {
      storageKey: string;
      url: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      context?: FileContext;
      width?: number;
      height?: number;
    },
  ): Promise<FileUploadResult> {
    const fileType = this.getFileType(data.mimeType);

    const file = await this.prisma.file.create({
      data: {
        uploadedById: userId,
        originalName: data.fileName,
        fileName: data.storageKey.split("/").pop() || data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        fileType,
        storageProvider: "cloudinary",
        storageKey: data.storageKey,
        url: data.url,
        thumbnailUrl: this.generateThumbnailUrl(data.url),
        context: data.context || FileContext.GALLERY,
        width: data.width || null,
        height: data.height || null,
      },
    });

    return {
      id: file.id,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl || undefined,
      storageKey: file.storageKey,
      fileName: file.originalName,
      mimeType: file.mimeType,
      fileType: file.fileType,
      fileSize: file.fileSize,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateFile(file: UploadedFile): void {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
  }

  private async uploadToCloudinary(
    file: UploadedFile,
    context: FileContext,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `local-service-finder/${context.toLowerCase()}`,
          resource_type: "auto",
          allowed_formats: [
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "pdf",
            "doc",
            "docx",
            "webm",
            "ogg",
            "mp3",
            "mp4",
            "m4a",
            "wav",
          ],
        },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error("Unknown upload error"));
          }
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  private getThumbnailUrl(uploadResult: UploadApiResponse): string | null {
    if (uploadResult.resource_type === "image") {
      // Generate thumbnail transformation
      return cloudinary.url(uploadResult.public_id, {
        width: 200,
        height: 200,
        crop: "fill",
        format: "jpg",
        quality: "auto",
      });
    }
    return null;
  }

  private generateThumbnailUrl(url: string): string | null {
    // Check if it's an image URL
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
      // Insert transformation before file extension
      return url.replace(
        /\/upload\//,
        "/upload/w_200,h_200,c_fill,q_auto/",
      );
    }
    return null;
  }

  private getFileType(mimeType: string): FileType {
    if (mimeType.startsWith("image/")) return FileType.IMAGE;
    if (mimeType.startsWith("video/")) return FileType.VIDEO;
    // Audio (voice notes) — no dedicated FileType enum value yet; bucket as OTHER
    // and let the message UI pick the audio player via messageType === "voice".
    if (mimeType.startsWith("audio/")) return FileType.OTHER;
    if (
      mimeType.includes("pdf") ||
      mimeType.includes("document") ||
      mimeType.includes("msword")
    ) {
      return FileType.DOCUMENT;
    }
    return FileType.OTHER;
  }
}
