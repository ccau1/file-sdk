declare module 'file-sdk' {
  export interface CommandProperties {
    bucketType: string;
    sas: string;
    expiresOn?: Date;
    meta?: any;
  }

  export type FileCommandType = 'create' | 'update' | 'read' | 'delete';

  export type FileBucketType = 'azure' | 'aws' | 'google';

  export interface FileDocumentCompression {
    quality: number;
    url: string;
    bucketFilePath: string;
    bucketFileName: string;
  }

  export interface UploadFileOptions {
    blobName?: string;
    isUpdate?: boolean;
    qualities?: number[];
    bucketFilePath?: string;
    mimeType?: string;
    isArchived?: boolean;
    organization?: string;
    bucketType?: FileBucketType;
    headerAuthorization?: string;
    createdBy?: string;
    maxResolution?: number;
  }

  export interface FileDocument {
    name: string;
    bucketType: string;
    bucketFilePath: string;
    bucketFileName: string;
    originalFileName: string;
    extension: string;
    size: number;
    url: string;
    thumbnailUrl: string;
    compressions: FileDocumentCompression[];
    organization?: string;
    isArchived?: boolean;
    mimeType: string;
    createdBy?: string;
  }

  export interface UploadedFile {
    filename: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
  }

  export interface FileUploadOptions {
    name?: string;
    qualities: number[];
    filePath?: string;
  }

  export interface BucketSDK {
    // getCommandProperties(
    //   fileApiUrl: string,
    //   type: FileCommandType,
    //   bucketType?: FileBucketType,
    // ): Promise<CommandPropertiesResponse>;
    uploadFileFromStream(
      buffer: Buffer,
      bufferSize: number,
      options: UploadFileOptions,
      commandProperties: CommandProperties
    ): Promise<FileDocument>;
  }
}
