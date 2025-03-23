/**
 * The request structure for the batch API.
 */
export interface BatchRequest {
  operation: 'upload' | 'download'
  transfers: string[]
  ref?: { name: string }
  objects: { oid: string, size: number }[]
  hash_algo: 'sha256'
}

/**
 * The error response type for the batch API.
 */
export interface BatchError {
  message: string
  documentation_url?: string
  request_id: string
}

/**
 * Successful response type for the batch API.
 */
export interface BatchResponse {
  transfer?: 'basic'
  objects: ResponseObject[]
  hash_algo: 'sha256'
}

/**
 * Information about an object in the batch API.
 */
export interface ResponseObject {
  oid: string
  size: number
  error?: {
    code: number
    message: string
  }
  authenticated?: boolean
  actions?: {
    download?: {
      href: string
      expires_in: number
    }
    upload?: {
      href: string
      expires_in: number
    }
  }
}
