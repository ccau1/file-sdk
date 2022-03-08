import azureSdk from "./azure-sdk";
import { BucketSDK } from "../file-sdk";

export default {
    azure: azureSdk,
  } as { [key: string]: BucketSDK };