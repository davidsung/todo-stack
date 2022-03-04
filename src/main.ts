import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class TodoStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      subnetConfiguration: [{
        subnetType: ec2.SubnetType.PUBLIC,
        name: 'public',
        cidrMask: 24,
      }, {
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        name: 'application',
        cidrMask: 24,
      }, {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        name: 'database',
        cidrMask: 24,
      }],
    });

    const apprunnerSg = new ec2.SecurityGroup(this, 'AppRunnerSG', {
      vpc,
      allowAllOutbound: true,
      description: 'AppRunner Security Group',
    });

    const registry = new ecr.Repository(this, 'ContainerRegistry', {
      repositoryName: 'builderseries',
    });

    const storageEncryptionKey = new kms.Key(this, 'DbStorageEncryptionKey');

    const dbInstance = new rds.DatabaseInstance(this, 'PostgresDB', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_12,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      credentials: rds.Credentials.fromGeneratedSecret('app'),
      databaseName: 'todo',
      storageEncryptionKey,
      publiclyAccessible: false,
    });

    const bastion = new ec2.BastionHostLinux(this, 'Bastion', {
      vpc,
    });

    dbInstance.connections.allowDefaultPortFrom(bastion);
    dbInstance.connections.allowDefaultPortFrom(apprunnerSg);

    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });
    new CfnOutput(this, 'ApplicationSubnets', {
      value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(),
    });
    new CfnOutput(this, 'AppRunnerSecurityGroupId', {
      value: apprunnerSg.securityGroupId,
    });
    new CfnOutput(this, 'RdsEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
    });
    if (dbInstance.secret) {
      new CfnOutput(this, 'RdsSecretId', {
        value: dbInstance.secret.secretName,
      });
    }
    new CfnOutput(this, 'BastionId', {
      value: bastion.instanceId,
    });
    new CfnOutput(this, 'ContainerRegistryArn', {
      value: registry.repositoryArn,
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new TodoStack(app, 'todo-stack-dev', { env: devEnv });

app.synth();