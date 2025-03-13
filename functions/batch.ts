import { S3 } from '@aws-sdk/client-s3'
import { BatchHandler } from './batch/BatchHandler'

const s3 = new S3()
const batchObj = new BatchHandler(s3)

// noinspection JSUnusedGlobalSymbols
export const handler = batchObj.handler.bind(batchObj)
