import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { FileContext } from "@prisma/client";
import { FilesService } from "./files.service";
import { RegisterFileDto } from "./dto/register-file.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("files")
@ApiTags("files")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload a single file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        context: { type: "string", enum: ["AVATAR", "GALLERY", "MESSAGE", "REVIEW", "VERIFICATION", "BOOKING"] },
      },
    },
  })
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body("context") context?: FileContext,
  ) {
    return this.filesService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      user.id,
      context,
    );
  }

  @Post("upload/multiple")
  @ApiOperation({ summary: "Upload multiple files" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
        context: { type: "string", enum: ["AVATAR", "GALLERY", "MESSAGE", "REVIEW", "VERIFICATION", "BOOKING"] },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Files uploaded successfully" })
  @UseInterceptors(FilesInterceptor("files", 10))
  async uploadMultipleFiles(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("context") context?: FileContext,
  ) {
    return this.filesService.uploadMultiple(
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
      user.id,
      context,
    );
  }

  @Get("signed-url")
  @ApiOperation({ summary: "Get signed URL for client-side upload" })
  @ApiQuery({ name: "context", required: false, enum: ["AVATAR", "GALLERY", "MESSAGE", "REVIEW", "VERIFICATION", "BOOKING"] })
  @ApiResponse({ status: 200, description: "Returns signed upload URL" })
  async getSignedUploadUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Query("context") context?: FileContext,
  ) {
    return this.filesService.generateSignedUploadUrl(user.id, context);
  }

  @Post("register")
  @ApiOperation({ summary: "Register a file uploaded via client-side upload" })
  @ApiResponse({ status: 201, description: "File registered successfully" })
  async registerFile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterFileDto,
  ) {
    return this.filesService.registerUploadedFile(user.id, {
      storageKey: dto.storageKey,
      url: dto.url,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      context: dto.context,
    });
  }

  @Get()
  @ApiOperation({ summary: "Get user files" })
  @ApiQuery({ name: "context", required: false, enum: ["AVATAR", "GALLERY", "MESSAGE", "REVIEW", "VERIFICATION", "BOOKING"] })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Returns list of files" })
  async getUserFiles(
    @CurrentUser() user: CurrentUserPayload,
    @Query("context") context?: FileContext,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.filesService.getUserFiles(user.id, {
      context,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get file by ID" })
  @ApiResponse({ status: 200, description: "Returns file details" })
  @ApiResponse({ status: 404, description: "File not found" })
  async getFile(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.filesService.getFile(id, user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a file" })
  @ApiResponse({ status: 200, description: "File deleted successfully" })
  @ApiResponse({ status: 404, description: "File not found" })
  async deleteFile(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.filesService.delete(id, user.id);
    return { success: true };
  }
}
