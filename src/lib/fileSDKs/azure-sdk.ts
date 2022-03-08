import { BlobServiceClient } from '@azure/storage-blob';
import { getFileExtension, getFileName } from '../utils';
import Jimp from 'jimp/es';
import BaseSDK from './BaseSDK';
import { Readable } from 'stream';
import {
  FileDocumentCompression,
  UploadFileOptions,
  BucketSDK,
  CommandProperties,
  FileDocument,
  FileDeleteOptions
} from '../file-sdk';

class AzureSDK extends BaseSDK implements BucketSDK {
  public async uploadFileFromStream(
    buffer: Buffer,
    bufferSize: number,
    options: UploadFileOptions,
    commandProperties: CommandProperties
  ): Promise<FileDocument> {
    // define options
    const opts = {
      qualities: [],
      ...options
    };
    // instantiate blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `BlobEndpoint=https://${commandProperties.meta.accountName}.blob.core.windows.net/;SharedAccessSignature=${commandProperties.sas}`
    );

    // get by command property's container name or
    // param filePath. Command should take precedence because
    // it is defined in fetching command properties already,
    // so if restricted by remote, allow it
    const container = blobServiceClient.getContainerClient(
      commandProperties.meta.containerName || opts.bucketFilePath
    );
    // if container doesn't exist, create it
    if (!(await container.exists())) {
      await container.create({ access: 'blob' });
    }
    // if this is update but blobName was not passed, throw error
    // because can't update without identifier
    if (opts.isUpdate && !opts.blobName) {
      throw new Error('cannot update empty blobName');
    }
    // if blobName not defined, create our own blobName
    if (!opts.blobName) {
      // create a unique blob name
      opts.blobName = `${container.containerName}-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;
    }
    // extract our unique blob name's extension and name
    const fileExtension = getFileExtension(opts.blobName);
    const fileName = getFileName(opts.blobName);
    // get blob by filename
    let blockBlobClient = container.getBlockBlobClient(opts.blobName);
    // if this is update but blob is not found, throw error
    if (opts.isUpdate && !blockBlobClient.exists()) {
      throw new Error('cannot find blob by blobName');
    }
    // if this is not isUpdate, keep doing this while blob name exists
    while ((await blockBlobClient.exists()) && !opts.isUpdate) {
      // this name already exists, create a unique version of it
      opts.blobName = `${fileName}-${Date.now()}${
        fileExtension ? `.${fileExtension}` : ''
      }`;

      // update blockBlobClient
      blockBlobClient = container.getBlockBlobClient(opts.blobName);
    }
    let fileMimeType = opts.mimeType;
    let qualityBuffers = [];
    // fetch all quality buffers to upload
    try {
      const jimpInstance = await Jimp.read(buffer);
      fileMimeType = jimpInstance.getMIME();
      // if buffer is image, get all compressed buffers
      // else leave empty array
      qualityBuffers = /^image/.test(fileMimeType)
        ? await this.compressImageMultiple(jimpInstance, [
            // define distinct list of quantities, excluding 100
            // because 100 will be added manually below
            ...new Set(opts.qualities.filter(q => q !== 1))
          ])
        : [];
    } catch (err) {}
    // add raw quality (100)
    qualityBuffers.unshift({ quality: 1, buffer });

    // upload each quality requested (including raw)
    const compressions: FileDocumentCompression[] = [];
    for (const { quality, buffer: qualityBuffer } of qualityBuffers) {
      // create a Readable from Buffer
      const readable = new Readable();
      readable._read = () => null;
      readable.push(qualityBuffer);
      readable.push(null);

      // get fileName and fileExtension from blobName
      const fileName = getFileName(opts.blobName);
      const fileExtension = getFileExtension(opts.blobName);

      // define fileName based on quality (100 = original name)
      const qualityFileName = `${fileName}${
        quality === 1 ? '' : `@${quality > 1 ? quality : `${quality * 100}pc`}`
      }${fileExtension ? `.${fileExtension}` : ''}`;

      // get/create blob by the fileName
      blockBlobClient = container.getBlockBlobClient(qualityFileName);
      // upload using readable
      await blockBlobClient.uploadStream(readable, bufferSize, 5, {
        blobHTTPHeaders: {
          blobContentType: fileMimeType
        }
      });

      // add to compressions list
      compressions.push({
        quality,
        // FIXME
        bucketFilePath: container.containerName,
        bucketFileName: qualityFileName,
        url: blockBlobClient.url.split('?')[0]
      });
    }

    // return url and its other image qualities
    const createdFile = await this.savePlainFile(
      {
        url: compressions.find(img => img.quality === 1).url,
        bucketType: 'azure',
        bucketFilePath: container.containerName,
        bucketFileName: opts.blobName,
        name: opts.blobName,
        originalFileName: opts.blobName,
        extension: fileExtension,
        size: bufferSize,
        mimeType: opts.mimeType,
        thumbnailUrl: compressions.sort((a, b) => a.quality - b.quality)[0].url,
        compressions,
        createdBy: opts.createdBy,
        tags: opts.tags
      },
      { headerAuthorization: options?.headerAuthorization }
    );

    return createdFile;
  }

  public async deleteFile(
    fileId: string,
    options: FileDeleteOptions,
    commandProperties: CommandProperties
  ): Promise<void> {
    const file = await this.getFileById(fileId, options);
    if (!file) throw new Error('file not found');

    // instantiate blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `BlobEndpoint=https://${commandProperties.meta.accountName}.blob.core.windows.net/;SharedAccessSignature=${commandProperties.sas}`
    );

    for (const fileCompression of file.compressions) {
      // get by command property's container name or
      // param filePath. Command should take precedence because
      // it is defined in fetching command properties already,
      // so if restricted by remote, allow it
      const container = blobServiceClient.getContainerClient(
        commandProperties.meta.containerName || fileCompression.bucketFilePath
      );

      const blockBlobClient = container.getBlockBlobClient(
        fileCompression.bucketFileName
      );

      await blockBlobClient.deleteIfExists();
    }
  }

  public async deleteFileBatch(
    fileIds: string[],
    options: FileDeleteOptions,
    commandProperties: CommandProperties
  ): Promise<void> {
    const files = await this.getFilesByIds(fileIds, options);
    if (!files) throw new Error('file not found');

    // instantiate blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `BlobEndpoint=https://${commandProperties.meta.accountName}.blob.core.windows.net/;SharedAccessSignature=${commandProperties.sas}`
    );

    for (const file of files) {
      for (const fileCompression of file.compressions) {
        // get by command property's container name or
        // param filePath. Command should take precedence because
        // it is defined in fetching command properties already,
        // so if restricted by remote, allow it
        const container = blobServiceClient.getContainerClient(
          commandProperties.meta.containerName || fileCompression.bucketFilePath
        );

        const blockBlobClient = container.getBlockBlobClient(
          fileCompression.bucketFileName
        );

        await blockBlobClient.deleteIfExists();
      }
    }
  }
}

export default new AzureSDK();
