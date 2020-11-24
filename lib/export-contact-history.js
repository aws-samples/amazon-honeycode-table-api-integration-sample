/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const events = require('@aws-cdk/aws-events');
const targets = require('@aws-cdk/aws-events-targets');
const iam = require('@aws-cdk/aws-iam');
const s3 = require('@aws-cdk/aws-s3');

const environment = require('../lambda/ExportContactHistory/env.json');

function exportContactHistory(scope) {
    //Setup ExportContactHistory Lambda function
    const exportContactHistory = new lambda.Function(scope, 'ExportContactHistory', {
        description: 'ExportContactHistory lambda reads contact history from Honeycode and saves it to an external system',
        code: lambda.Code.fromAsset('lambda/ExportContactHistory'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for reading and saving contact history
    });
    //Allow lambda to access Honeycode workbook
    //exportContactHistory.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeFullAccess'));
    const workbookPolicy = new iam.PolicyStatement();
    workbookPolicy.addActions(['honeycode:ListTables']);
    workbookPolicy.addResources([`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`]);
    exportContactHistory.role.addToPrincipalPolicy(workbookPolicy)
    const tablePolicy = new iam.PolicyStatement();
    tablePolicy.addActions(['honeycode:ListTableColumns', 'honeycode:BatchUpdateTableRows', 'honeycode:QueryTableRows']);
    tablePolicy.addResources([`arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]);
    exportContactHistory.role.addToPrincipalPolicy(tablePolicy)
    //Run ExportContactHistory every minute
    const exportContactHistoryRule = new events.Rule(scope, 'ExportContactHistoryRule', {
        schedule: events.Schedule.expression('rate(1 minute)')
    });
    exportContactHistoryRule.addTarget(new targets.LambdaFunction(exportContactHistory));
    //Setup S3 bucket to write contact history to
    const contactHistoryBucket = new s3.Bucket(scope, 'ContactHistoryBucket');
    contactHistoryBucket.grantWrite(exportContactHistory);
    exportContactHistory.addEnvironment('s3bucket', contactHistoryBucket.bucketName);
}

module.exports = { exportContactHistory }