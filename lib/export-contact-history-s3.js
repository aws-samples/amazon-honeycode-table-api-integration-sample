/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const events = require('@aws-cdk/aws-events');
const targets = require('@aws-cdk/aws-events-targets');
const iam = require('@aws-cdk/aws-iam');
//const s3 = require('@aws-cdk/aws-s3');
const { AutoDeleteBucket } = require('@mobileposse/auto-delete-bucket');
const { AwsCustomResource, AwsCustomResourcePolicy } = require('@aws-cdk/custom-resources');

const environment = require('../lambda/env.json');

function exportContactHistory(scope) {
    //Setup S3 bucket to write contact history to
    //const contactHistoryBucket = new s3.Bucket(scope, 'ContactHistoryBucket');
    //Using a CDK custom resource to delete S3 bucket when the stack is destroyed
    const contactHistoryBucket = new AutoDeleteBucket(scope, 'ContactHistoryBucket');
    //Setup ExportContactHistory Lambda function
    const exportContactHistory = new lambda.Function(scope, 'ExportContactHistoryS3', {
        description: 'Reads contact history from Honeycode and saves it to S3',
        code: lambda.Code.fromAsset('lambda/ExportContactHistoryS3'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for reading and saving contact history
    });
    //Run ExportContactHistory every minute
    const exportContactHistoryRule = new events.Rule(scope, 'ExportContactHistoryRule', {
        schedule: events.Schedule.expression('rate(1 minute)')
    });
    exportContactHistoryRule.addTarget(new targets.LambdaFunction(exportContactHistory));
    //Allow lambda function to write to the S3 bucket
    contactHistoryBucket.grantWrite(exportContactHistory);
    //Add the bucket name to the lambda's environment variables
    exportContactHistory.addEnvironment('s3bucket', contactHistoryBucket.bucketName);
    //Allow lambda to access Honeycode workbook
    //You can give full access to all your workbooks
    //exportContactHistory.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeWorkbookFullAccess'));
    //Or give access to this specific workbook (recommended)
    const workbookPolicy = new iam.PolicyStatement();
    workbookPolicy.addActions(['honeycode:ListTables']);
    workbookPolicy.addResources([`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`]);
    exportContactHistory.role.addToPrincipalPolicy(workbookPolicy)
    const tablePolicy = new iam.PolicyStatement();
    tablePolicy.addActions(['honeycode:ListTableColumns', 'honeycode:BatchUpdateTableRows', 'honeycode:QueryTableRows']);
    tablePolicy.addResources([`arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]);
    exportContactHistory.role.addToPrincipalPolicy(tablePolicy)
    //Write s3-manifest.json to S3 bucket using a custom resource for use with QuickSight
    new AwsCustomResource(scope, 'S3Manifest', {
        onCreate: {
            service: 'S3',
            action: 'putObject',
            parameters: {
                Bucket: contactHistoryBucket.bucketName,
                Key: 'manifest.json',
                Body: JSON.stringify({
                    fileLocations: [
                        {
                            URIPrefixes: [
                                `s3://${contactHistoryBucket.bucketName}/csv/`
                            ]
                        }
                    ]
                }, null, 2)
            },
            physicalResourceId: 'S3ManifestFile'
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
            resources: [`${contactHistoryBucket.bucketArn}/*`]
        })
    });
    //Output the Bucket URL
    new cdk.CfnOutput(scope, "S3 manifest file URL", {
        value: `s3://${contactHistoryBucket.bucketName}/manifest.json`
    });
}

module.exports = { exportContactHistory }