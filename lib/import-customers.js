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
const s3deploy = require('@aws-cdk/aws-s3-deployment');
const { AutoDeleteBucket } = require('@mobileposse/auto-delete-bucket')

const environment = require('../lambda/ImportCustomers/env.json');

function importCustomers(scope) {
    //Setup ImportCustomers Lambda function
    const importCustomers = new lambda.Function(scope, 'ImportCustomers', {
        description: 'ImportCustomers lambda reads customer records from an external system and updates or inserts them into Amazon Honeycode',
        code: lambda.Code.fromAsset('lambda/ImportCustomers'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for batch upserts
    });
    //Allow lambda to access Honeycode workbook
    //importCustomers.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeWorkbookFullAccess'));
    const workbookPolicy = new iam.PolicyStatement();
    workbookPolicy.addActions(['honeycode:ListTables']);
    workbookPolicy.addResources([`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`]);
    importCustomers.role.addToPrincipalPolicy(workbookPolicy)
    const tablePolicy = new iam.PolicyStatement();
    tablePolicy.addActions(['honeycode:ListTableColumns', 'honeycode:BatchUpsertTableRows', 'honeycode:QueryTableRows']);
    tablePolicy.addResources([`arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]);
    importCustomers.role.addToPrincipalPolicy(tablePolicy)
    //Run Import Customers every minute
    const importCustomersRule = new events.Rule(scope, 'ImportCustomersRule', {
        schedule: events.Schedule.expression('rate(1 minute)')
    });
    importCustomersRule.addTarget(new targets.LambdaFunction(importCustomers));
    //Setup S3 bucket to read customer records from
    //const customerRecordsBucket = new s3.Bucket(scope, 'CustomerRecords');
    const customerRecordsBucket = new AutoDeleteBucket(scope, 'CustomerRecords');
    customerRecordsBucket.grantRead(importCustomers);
    importCustomers.addEnvironment('s3bucket', customerRecordsBucket.bucketName);
    //Copy data/customers.csv to the new bucket
    new s3deploy.BucketDeployment(scope, 'CustomerRecordsBucketDeploy', {
        sources: [s3deploy.Source.asset('./data', { exclude: ['**', '!customers.csv'] })],
        destinationBucket: customerRecordsBucket
    })
}

module.exports = { importCustomers }