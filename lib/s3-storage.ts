import { Construct } from 'constructs'
import { Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import { Effect, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam'

export class S3Storage extends Construct {
  private readonly bucket: Bucket
  private readonly accessPolicy: ManagedPolicy

  constructor(scope: Construct, id: string) {
    super(scope, id)

    this.bucket = new Bucket(this, 'lfs-storage', {
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
        ignorePublicAcls: true,
      },
      bucketKeyEnabled: true,
      encryption: BucketEncryption.KMS_MANAGED,
      intelligentTieringConfigurations: [
        {
          name: 'archive',
          archiveAccessTierTime: Duration.days(180),
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.minutes(60),
          enabled: true,
          id: 'multipart',
        },
      ],
      minimumTLSVersion: 1.2,
      objectLockEnabled: false,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
    })

    this.accessPolicy = new ManagedPolicy(this, 'lfs-bucket-access', {
      statements: [
        new PolicyStatement({
          actions: ['s3:GetObject', 's3:PubObject'],
          effect: Effect.ALLOW,
          resources: [`${this.bucket.bucketArn}/*`],
        }),
      ],
    })
  }

  public get bucketName(): string {
    return this.bucket.bucketName
  }

  public get bucketAccessPolicy(): ManagedPolicy {
    return this.accessPolicy
  }
}
