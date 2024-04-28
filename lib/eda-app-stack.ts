import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });
      //DynamoDB Table
      const imagesTable = new dynamodb.Table(this, "imagesTable", {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        partitionKey: { name: "imageName", type: dynamodb.AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY,                                 
        tableName: "Images",                                                     
      })

    //Queue
    const badImagesQueue = new sqs.Queue(this, "bad-orders-q", {
      retentionPeriod: cdk.Duration.minutes(30),
    });

    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
      deadLetterQueue: {
        queue: badImagesQueue,
        // # of rejections by consumer (lambda function)
        maxReceiveCount: 2,
      }
    });

    const mailerQ = new sqs.Queue(this, "mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    //topic
    const imageTopic = new sns.Topic(this, "ImageTopic", {
      displayName: "Image topic",
    }); 

    // Lambda functions
    const processImageFn = new lambdanode.NodejsFunction(
      this,
      "ProcessImageFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/processImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
          REGION: 'eu-west-1',
        }
      }
    );

    const deleteImageFn = new lambdanode.NodejsFunction(
      this,
      "DeleteImageFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/deleteImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const updateImageFn = new lambdanode.NodejsFunction(
      this,
      "UpdateImage",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const rejectionMailerFn = new lambdanode.NodejsFunction(this, "rejection-mailer-function", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/rejectionMailer.ts`,
    });

    const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/mailer.ts`,
    });

   // S3 --> SQS
  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3n.SnsDestination(imageTopic) 
  );

  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_REMOVED,
    new s3n.SnsDestination(imageTopic)
  )

  imageTopic.addSubscription(new subs.SqsSubscription(imageProcessQueue,{
    filterPolicyWithMessageBody: {
      Records: sns.FilterOrPolicy.policy({                                                          //https://www.youtube.com/watch?v=36iMOJQUAuE
        eventName: sns.FilterOrPolicy.filter(sns.SubscriptionFilter.stringFilter({                  //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sns.FilterOrPolicy.html
          matchPrefixes: ['ObjectCreated:Put']
        }))
      })
    }
  }));
  imageTopic.addSubscription(new subs.SqsSubscription(mailerQ));
  imageTopic.addSubscription(new subs.LambdaSubscription(deleteImageFn,{
    filterPolicy: {
      comment_type: sns.SubscriptionFilter.stringFilter({
          allowlist: ['Process Delete']
      }),
    },
  }));
  imageTopic.addSubscription(
    new subs.LambdaSubscription(updateImageFn, {
        filterPolicy: {
          comment_type: sns.SubscriptionFilter.stringFilter({
              allowlist: ['Update Table']
          }),
        },
    })
  );

   // SQS --> Lambda
    const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(10),
    });

    const newImageMailEventSource = new events.SqsEventSource(mailerQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(10),
    }); 

    const failedImageEventSource = new events.SqsEventSource(badImagesQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(10),
    })

    processImageFn.addEventSource(newImageEventSource);
    mailerFn.addEventSource(newImageMailEventSource);
    rejectionMailerFn.addEventSource(failedImageEventSource);
    // Permissions
    imagesBucket.grantRead(processImageFn);
    mailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );
    rejectionMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    imagesTable.grantReadWriteData(processImageFn)
    imagesTable.grantReadWriteData(deleteImageFn)
    imagesTable.grantReadWriteData(updateImageFn)
    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
    new cdk.CfnOutput(this, "topicARN", {
      value: imageTopic.topicArn,
    });
  }
}
