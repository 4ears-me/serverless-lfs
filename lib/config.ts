import { Construct } from 'constructs'
import {
  Application,
  ConfigurationContent,
  ConfigurationType,
  Environment,
  HostedConfiguration,
  IApplication,
  IConfiguration,
  IEnvironment,
} from 'aws-cdk-lib/aws-appconfig'
import { ConfigValue, envApp, envEnv, envName } from '../functions/config'

export class FunctionConfig extends Construct {
  readonly app: IApplication
  readonly env: IEnvironment
  readonly config: IConfiguration

  constructor(scope: Construct, id: string, bucket: string) {
    super(scope, id)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { publicRead, publicWrite, userInfoEndpoint, emailClaim } = this.node.getAllContext({
      publicRead: false,
      publicWrite: false,
      emailClaim: undefined,
    })

    if (userInfoEndpoint === undefined) {
      throw new Error('user info endpoint is required')
    }

    const value: ConfigValue = {
      publicRead: publicRead === 'true',
      publicWrite: publicWrite === 'true',
      userInfoEndpoint: userInfoEndpoint as string,
      bucket: bucket,
      emailClaim: emailClaim as string | undefined,
    }

    this.app = new Application(this, 'lfs-app-config-app', {
      description: 'LFS application',
    })

    this.env = new Environment(this, 'lfs-app-config-env', {
      description: 'production environment',
      application: this.app,
    })

    this.config = new HostedConfiguration(this, 'lfs-app-config', {
      description: 'Configuration for LFS functions',
      type: ConfigurationType.FREEFORM,
      content: ConfigurationContent.fromInlineJson(JSON.stringify(value)),
      application: this.app,
      deployTo: [this.env],
    })
  }

  public get envVars(): Record<string, string> {
    const env: Record<string, string> = {}
    env[envName] = this.config.name ?? 'lfs-app-config'
    env[envEnv] = this.env.name ?? 'lfs-app-config-env'
    env[envApp] = this.app.name ?? 'lfs-app-config-app'
    return env
  }
}
