import Jimp from 'jimp/es';
import Axios from 'axios';
import { FileDocument, FileSDK } from '../file-sdk';
import { UploadFileOptions, CommandProperties } from 'file-sdk';
import path from 'path';
import mime from 'mime-types';
import fs from 'fs';

class BaseSDK {
  async compressImageMultiple(
    bufferOrPath: Buffer | string | Jimp,
    qualities: number[]
  ) {
    const jimpInstance = await Jimp.read(bufferOrPath as any);
    return Promise.all(
      qualities.map(async quality => {
        return {
          quality,
          buffer: await this.compressImage(jimpInstance, quality)
        };
      })
    );
  }

  async compressImage(bufferOrPath: Buffer | string | Jimp, quality: number) {
    // bufferOrPath can be: buffer, filepath or Jimp instance
    let jimpInstance = await Jimp.read(bufferOrPath as any);
    if (quality > 1) {
      jimpInstance = jimpInstance.resize(quality, Jimp.AUTO);
    } else {
      jimpInstance = jimpInstance.resize(
        jimpInstance.bitmap.width * quality,
        jimpInstance.bitmap.height * quality
      );
      jimpInstance = jimpInstance.quality(quality * 100);
    }
    return jimpInstance.getBufferAsync(jimpInstance.getMIME());
  }

  async savePlainFile(
    file: FileDocument,
    options: { headerAuthorization: string }
  ): Promise<FileDocument> {
    const filesResult = await Axios.post<FileDocument>(
      `${FileSDK.fileApiUrl}/files/plain`,
      file,
      {
        headers: {
          ...(options?.headerAuthorization
            ? { authorization: options?.headerAuthorization }
            : {})
        }
      }
    );
    return filesResult.data;
  }

  async getFileById(
    fileId: string,
    options: { headerAuthorization?: string }
  ): Promise<FileDocument> {
    const filesResult = await Axios.get<FileDocument>(
      `${FileSDK.fileApiUrl}/files/${fileId}`,
      {
        headers: {
          ...(options?.headerAuthorization
            ? { authorization: options?.headerAuthorization }
            : {})
        }
      }
    );
    return filesResult.data;
  }

  async getFilesByIds(
    fileIds: string[],
    options: { headerAuthorization?: string }
  ): Promise<FileDocument[]> {
    const filesResult = await Axios.get<{ docs: FileDocument[] }>(
      `${FileSDK.fileApiUrl}/files?${fileIds
        .map(fId => `_ids[]=${fId}`)
        .join('&')}`,
      {
        headers: {
          ...(options?.headerAuthorization
            ? { authorization: options?.headerAuthorization }
            : {})
        }
      }
    );
    return filesResult.data.docs;
  }

  public async uploadFileFromStream(
    buffer: Buffer,
    bufferSize: number,
    options: UploadFileOptions,
    commandProperties: CommandProperties
  ): Promise<FileDocument> {
    console.info('params', buffer, bufferSize, options, commandProperties);
    throw new Error('function did not implement');
  }

  public async uploadFileFromFilePath(
    filePath: string,
    options: UploadFileOptions,
    commandProperties: CommandProperties
  ): Promise<FileDocument> {
    const buffer = fs.readFileSync(filePath);
    const mimeType = mime.lookup(filePath);
    const opts = {
      blobName: path.basename(filePath),
      // mimeType can be "false" if it can't resolve
      mimeType: mimeType ? mimeType : undefined,
      ...options
    };

    return this.uploadFileFromStream(
      buffer,
      // this is in bytes
      fs.statSync(filePath).size,
      opts,
      commandProperties
    );
  }
}

export default BaseSDK;
