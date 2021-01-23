/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const cdk = require('@aws-cdk/core');
const lambda = require('@aws-cdk/aws-lambda');
const iam = require('@aws-cdk/aws-iam');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const { DynamoEventSource } = require('@aws-cdk/aws-lambda-event-sources');
const { AwsCustomResource, AwsCustomResourcePolicy } = require('@aws-cdk/custom-resources');

const environment = require('../lambda/env.json');
const tableData = require('../data/customers-dynamodb.json');

function importCustomersDynamoDB(scope) {
    //Setup Dynamodb table 
    const customersTable = new dynamodb.Table(scope, 'Customers', {
        partitionKey: { name: 'Company', type: dynamodb.AttributeType.STRING },
        stream: dynamodb.StreamViewType.NEW_IMAGE,
        removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    //Setup ImportCustomers Lambda function
    const importCustomersLambda = new lambda.Function(scope, 'ImportCustomersDynamoDB', {
        description: 'Invoked on changes to customer records in Dynamodb and updates or inserts them into Amazon Honeycode',
        code: lambda.Code.fromAsset('lambda/ImportCustomersDynamoDB'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
        environment,
        timeout: cdk.Duration.minutes(1), //Give enough time for batch upserts
    });
    //Add Dynamodb Event source for the Lambda
    importCustomersLambda.addEventSource(new DynamoEventSource(customersTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 100,
        retryAttempts: 1
    }));
    //Allow lambda to access Honeycode workbook
    //When a crossAccountHoneycodeRoleArn is specified, the lambda will assume that role and we don't need to add Honeycode policies to the Lambda execution role 
    if (environment.crossAcountHoneycodeRoleArn.indexOf("arn:aws") === -1) {
        //You can give full access to all your workbooks
        //importCustomersLambda.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonHoneycodeWorkbookFullAccess'));
        //Or give access to this specific workbook (recommended)
        importCustomersLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['honeycode:ListTables', 'honeycode:ListTableColumns', 'honeycode:BatchCreateTableRows', 'honeycode:BatchUpdateTableRows', 'honeycode:BatchDeleteTableRows', 'honeycode:QueryTableRows'],
            resources: [`arn:aws:honeycode:*:*:workbook:workbook/${environment.workbookId}`, `arn:aws:honeycode:*:*:table:workbook/${environment.workbookId}/table/*`]
        }))
    } else {
        //Add STS assume role to allow this lambda to assume the cross account role
        importCustomersLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [environment.crossAcountHoneycodeRoleArn]
        }))
    }
    //Initialize table with sample data
    new AwsCustomResource(scope, 'CustomerRecordsTableInit', {
        onCreate: {
            service: 'DynamoDB',
            action: 'putItem',
            parameters: {
                TableName: customersTable.tableName,
                Item: tableData
            },
            physicalResourceId: 'CustomerRecordsTableInitializer'
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
            resources: [customersTable.tableArn]
        })
    });
}

module.exports = { importCustomersDynamoDB }