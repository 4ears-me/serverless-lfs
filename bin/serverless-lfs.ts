#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ServerlessLfsStack } from '../lib/serverless-lfs-stack'

const app = new cdk.App()
new ServerlessLfsStack(app, 'ServerlessLfsStack', {
  description: 'Git LFS server using AWS serverless technologies.',
  stackName: 'serverless-lfs',
})
