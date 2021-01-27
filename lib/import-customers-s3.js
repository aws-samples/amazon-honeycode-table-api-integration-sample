/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const iam = require('@aws-cdk/aws-iam');
const s3 = require('@aws-cdk/aws-s3');
const s3deploy = require('@aws-cdk/aws-s3-deployment');
const { S3EventSource } = require('@aws-cdk/aws-lambda-event-sources');

const environment = require('../lambda/env.json');

function importCustomersS3(scope) {
    //Setup S3 bucket where customer records will be imported from
    const customerRecordsBucket = new s3.Bucket(scope, 'CustomerRecords', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true
    });
    //Setup ImportCustomers Lambda function
    const importCustomersLambda = new lambda.Function(scope, 'ImportCustomersS3', {
        description: 'Reads customer records from S3 and updates or inserts them in Amazon Honeycode',
        code: lambda.Code.fromAsset('lambda/ImportCustomersS3'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for batch upserts
    });
    //Add S3 Event source for the lamdba
    importCustomersLambda.addEventSource(new S3EventSource(customerRecordsBucket, {
        events: [s3.EventType.OBJECT_CREATED]
    }));
    //Grant read permissions to the lambda for the S3 bucket
    customerRecordsBucket.grantRead(importCustomersLambda);
    //Allow lambda to access Honeycode workbook
    //When a crossAccountHoneycodeRoleArn is specified, the lambda will assume that role and we don't need to add Honeycode policies to the Lambda execution role 
    if (environment.crossAcountHoneycodeRoleArn.indexOf("arn:aws") === -1) {
        //You can give full access to all your workbooks
        //importCustomersLambda.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeWorkbookFullAccess'));
        //Or give access to this specific workbook (recommended)
        importCustomersLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['honeycode:ListTables', 'honeycode:StartTableDataImportJob'],
            resources: [`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`, `arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]
        }))
    } else {
        //Add STS assume role to allow this lambda to assume the cross account role
        importCustomersLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [environment.crossAcountHoneycodeRoleArn]
        }))
    }
    //Copy data/customers-s3.csv to the new bucket
    new s3deploy.BucketDeployment(scope, 'CustomerRecordsBucketDeploy', {
        sources: [s3deploy.Source.asset('./data', { exclude: ['**', '!customers-s3.csv'] })],
        destinationBucket: customerRecordsBucket
    })
}

module.exports = { importCustomersS3 }