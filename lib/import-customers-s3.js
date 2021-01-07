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
    const importCustomers = new lambda.Function(scope, 'ImportCustomersS3', {
        description: 'Reads customer records from S3 and updates or inserts them in Amazon Honeycode',
        code: lambda.Code.fromAsset('lambda/ImportCustomersS3'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for batch upserts
    });
    //Add S3 Event source for the lamdba
    importCustomers.addEventSource(new S3EventSource(customerRecordsBucket, {
        events: [s3.EventType.OBJECT_CREATED]
    }));
    //Grant read permissions to the lambda for the S3 bucket
    customerRecordsBucket.grantRead(importCustomers);
    //Allow lambda to access Honeycode workbook
    //You can give full access to all your workbooks
    //importCustomers.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeWorkbookFullAccess'));
    //Or give access to this specific workbook (recommended)
    const workbookPolicy = new iam.PolicyStatement();
    workbookPolicy.addActions(['honeycode:ListTables']);
    workbookPolicy.addResources([`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`]);
    importCustomers.role.addToPrincipalPolicy(workbookPolicy);
    const tablePolicy = new iam.PolicyStatement();
    tablePolicy.addActions(['honeycode:StartTableDataImportJob']);
    tablePolicy.addResources([`arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]);
    importCustomers.role.addToPrincipalPolicy(tablePolicy);
    //Copy data/customers-s3.csv to the new bucket
    new s3deploy.BucketDeployment(scope, 'CustomerRecordsBucketDeploy', {
        sources: [s3deploy.Source.asset('./data', { exclude: ['**', '!customers-s3.csv'] })],
        destinationBucket: customerRecordsBucket
    })
}

module.exports = { importCustomersS3 }