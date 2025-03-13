import { TokenValidator } from './auth/TokenValidator'

const validator = new TokenValidator()

// noinspection JSUnusedGlobalSymbols
export const verifyHandler = validator.handler.bind(validator)
