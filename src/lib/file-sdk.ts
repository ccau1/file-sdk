import Axios from 'axios';
import buckets from './fileSDKs';

export class FileSDK {
  public static fileApiUrl = '';
  public static bucketFilePath = '';
  public static bucketType: FileBucketType = undefined;
  public fileApiUrl = '';
  public bucketFilePath = '';
  public headerAuthorization = null;

  constructor(settings?: {
    fileApiUrl?: string;
    headerAuthorization?: string;
    bucketFilePath?: string;
  }) {
    this.fileApiUrl = settings?.fileApiUrl || FileSDK.fileApiUrl;
    this.headerAuthorization = settings?.headerAuthorization;
    this.bucketFilePath = settings?.bucketFilePath || FileSDK.bucketFilePath;
    if (!this.fileApiUrl) {
      throw new Error('no file api url given');
    }
  }

  protected async _getCommandProperties(
    type: FileCommandType,
    options?: {
      bucketType?: FileBucketType;
      filePath?: string;
    }
  ): Promise<CommandProperties> {
    const opts = {
      ...options
    };

    const authorization = this.headerAuthorization;

    const commandPropertiesQuery: any = {};
    if (opts.bucketType) {
      commandPropertiesQuery.bucketType = opts.bucketType;
    }
    if (opts.filePath) {
      commandPropertiesQuery.filePath = opts.filePath;
    }

    const tokenResponse = await Axios.get<CommandProperties>(
      `${this.fileApiUrl}/files/token/${type}?${Object.keys(
        commandPropertiesQuery
      )
        .map(cpKey => `${cpKey}=${commandPropertiesQuery[cpKey]}`)
        .join('&')}`,
      {
        headers: {
          ...(authorization ? { authorization } : {})
        }
      }
    );
    if (tokenResponse.status !== 200) {
      throw new Error('cannot get SAS properties');
    }
    return tokenResponse.data;
  }

  public async uploadFileFromStream(
    buffer: Buffer,
    bufferSize: number,
    options?: UploadFileOptions
  ): Promise<FileDocument> {
    const authorization =
      options?.headerAuthorization || this.headerAuthorization;
    // get token
    const commandProperties = await this._getCommandProperties('create', {
      filePath: options?.bucketFilePath || this.bucketFilePath,
      bucketType: options?.bucketType || FileSDK.bucketType
    });
    // call bucket's upload and return File document
    return buckets[commandProperties.bucketType].uploadFileFromStream(
      buffer,
      bufferSize,
      { ...options, headerAuthorization: authorization },
      commandProperties
    );
  }

  public async uploadFileFromFilePath(
    filePath: string,
    options?: UploadFileOptions
  ): Promise<FileDocument> {
    const authorization =
      options?.headerAuthorization || this.headerAuthorization;
    // get token
    const commandProperties = await this._getCommandProperties('create', {
      filePath: options?.bucketFilePath || this.bucketFilePath,
      bucketType: options?.bucketType
    });
    // call bucket's upload and return File document
    return buckets[commandProperties.bucketType].uploadFileFromFilePath(
      filePath,
      { ...options, headerAuthorization: authorization },
      commandProperties
    );
  }

  public async getFilesByIds(
    fileIds: string[],
    options?: { headerAuthorization?: string }
  ): Promise<FileDocument[]> {
    const authorization =
      options?.headerAuthorization || this.headerAuthorization;
    const filesResult = await Axios.get<{ docs: FileDocument[] }>(
      `${this.fileApiUrl}/files?${fileIds
        .map(fId => `_ids[]=${fId}`)
        .join('&')}`,
      {
        headers: {
          ...(authorization ? { authorization } : {})
        }
      }
    );
    return filesResult.data.docs;
  }

  async getFileById(
    fileId: string,
    options?: { headerAuthorization?: string }
  ): Promise<FileDocument> {
    const authorization =
      options?.headerAuthorization || this.headerAuthorization;
    const filesResult = await Axios.get<FileDocument>(
      `${this.fileApiUrl}/files/${fileId}`,
      {
        headers: {
          ...(authorization ? { authorization } : {})
        }
      }
    );
    return filesResult.data;
  }

  public async deleteFile(
    fileId: string,
    isSoftDelete: boolean = false
  ): Promise<FileDocument> {
    const authorization = this.headerAuthorization;
    // get token
    const commandProperties = await this._getCommandProperties('delete', {});
    // if it is soft delete, just set file to isArchived true
    if (isSoftDelete) {
      const fileArchivedResponse = await Axios.put<FileDocument>(
        `${this.fileApiUrl}/files/${fileId}/archive`,
        {
          headers: {
            ...(authorization ? { authorization } : {})
          }
        }
      );
      // return archived file
      return fileArchivedResponse.data;
    } else {
      // if it is not a soft delete, we're removing actual file

      // call bucket's delete
      await buckets[commandProperties.bucketType].deleteFile(
        fileId,
        { headerAuthorization: this.headerAuthorization },
        commandProperties
      );
      // delete file
      const fileDeleteResponse = await Axios.delete<FileDocument>(
        `${this.fileApiUrl}/files/${fileId}`,
        {
          headers: {
            ...(authorization ? { authorization } : {})
          }
        }
      );
      // return deleted file
      return fileDeleteResponse.data;
    }
  }

  public async deleteFiles(fileIds: string[], isSoftDelete: boolean = false) {
    const authorization = this.headerAuthorization;
    // get token
    const commandProperties = await this._getCommandProperties('delete', {});
    // if it is soft delete, just set file to isArchived true
    if (isSoftDelete) {
      const fileArchivedResponse = await Axios.put<FileDocument[]>(
        `${this.fileApiUrl}/files/batch?${fileIds
          .map(fId => `_ids[]=${fId}`)
          .join('&')}`,
        {
          headers: {
            ...(authorization ? { authorization } : {})
          }
        }
      );
      // return archived file
      return fileArchivedResponse.data;
    } else {
      // if it is not a soft delete, we're removing actual file

      // call bucket's delete
      await buckets[commandProperties.bucketType].deleteFileBatch(
        fileIds,
        { headerAuthorization: authorization },
        commandProperties
      );
      // delete file
      const fileDeleteResponse = await Axios.delete<FileDocument[]>(
        `${this.fileApiUrl}/files?${fileIds
          .map(fId => `_ids[]=${fId}`)
          .join('&')}`,
        {
          headers: {
            ...(authorization ? { authorization } : {})
          }
        }
      );
      // return deleted file
      return fileDeleteResponse.data;
    }
  }
}

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
  tags?: string[];
}

export interface FileDocument {
  _id?: string;
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
  tags?: string[];
}

export interface UploadedFile {
  filename: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadedFiles {
  [key: string]: UploadedFile[];
}

export interface FileUploadOptions {
  name?: string;
  qualities: number[];
  filePath?: string;
}

export interface FileDeleteOptions {
  headerAuthorization?: string;
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

  uploadFileFromFilePath(
    filePath: string,
    options: UploadFileOptions,
    commandProperties: CommandProperties
  ): Promise<FileDocument>;

  deleteFile(
    fileId: string,
    options: FileDeleteOptions,
    commandProperties: CommandProperties
  ): Promise<void>;

  deleteFileBatch(
    fileIds: string[],
    options: FileDeleteOptions,
    commandProperties: CommandProperties
  ): Promise<void>;
}
