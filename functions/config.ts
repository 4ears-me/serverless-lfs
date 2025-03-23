import { AppConfigProvider } from '@aws-lambda-powertools/parameters/appconfig'

export interface ConfigValue {
  publicRead: boolean
  publicWrite: boolean
  bucket: string
  userInfoEndpoint: string
  emailClaim?: string
}

export const envName = 'CONFIG_NAME'
export const envApp = 'CONFIG_APP'
export const envEnv = 'CONFIG_ENV'
const configName = process.env[envName] ?? 'lfs-app-config'
const configEnv = process.env[envEnv] ?? 'lfs-app-config-env'
const configApp = process.env[envApp] ?? 'lfs-app-config-app'
const provider = new AppConfigProvider({
  environment: configEnv,
  application: configApp,
})

export async function loadConfig(): Promise<ConfigValue> {
  const config = await provider.get<ConfigValue>(configName, {
    transform: 'json',
  })

  if (config === undefined) {
    throw new Error('unable to load configuration')
  }

  return config
}
