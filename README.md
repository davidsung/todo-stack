# Todo Stack in CDK
## Initialize CDK from projen
```sh
mkdir todo-stack
cd todo-stack
projen new awscdk-app-ts
```

## Coding VPC / SecurityGroup / RDS
* VPC
```typescript
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
```

* Security Group
```typescript
const apprunnerSg = new ec2.SecurityGroup(this, 'AppRunnerSG', {
  vpc,
  allowAllOutbound: true,
  description: 'AppRunner Security Group',
});
```

* RDS
```typescript
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
  storageEncryptionKey,
  publiclyAccessible: false,
});
```

* Bastion
```typescript
const bastion = new ec2.BastionHostLinux(this, 'Bastion', {
  vpc,
});
```

* Ingress Rule: Allow postgresql port from AppRunner Security Group
```typescript
dbInstance.connections.allowDefaultPortFrom(apprunnerSg);
dbInstance.connections.allowDefaultPortFrom(bastion);
```

## Update test case
Modify the `MyStack` to `TodoStack`

## Get Rds Secrets
```sh
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name todo-stack-dev \
  --query "Stacks[].Outputs[?OutputKey=='RdsEndpoint'].OutputValue" \
  --output text)
echo $RDS_ENDPOINT

RDS_SECRET_ID=$(aws cloudformation describe-stacks \
  --stack-name todo-stack-dev \
  --query "Stacks[].Outputs[?OutputKey=='RdsSecretId'].OutputValue" \
  --output text)
echo $RDS_SECRET_ID

RDS_SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id $RDS_SECRET_ID | jq -r ".SecretString | fromjson | .password")
echo $RDS_SECRET_VALUE | pbcopy
```
