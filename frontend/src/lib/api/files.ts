import { apiClient } from "./client";

export type FileContext =
  | "AVATAR"
  | "GALLERY"
  | "MESSAGE"
  | "REVIEW"
  | "VERIFICATION"
  | "BOOKING";

export interface UploadedFile {
  id: string;
  url: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  context?: FileContext;
}

export const filesService = {
  async upload(file: File, context?: FileContext): Promise<UploadedFile> {
    return apiClient.uploadFile("/files/upload", file, context);
  },
};
