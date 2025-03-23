import { TokenValidator } from './auth/TokenValidator'

const validator = await TokenValidator.build()

// noinspection JSUnusedGlobalSymbols
export const verifyHandler = validator.handler.bind(validator)
