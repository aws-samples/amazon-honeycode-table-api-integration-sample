# Use APIs to integrate external systems with Amazon Honeycode

By Kandha Sankarapandian, *Senior Solutions Architect*

[Amazon Honeycode](https://www.honeycode.aws/) gives you the power to build custom apps without programming. **Amazon Honeycode APIs** help you extend Honeycode beyond its existing capabilities and to integrate Honeycode with your existing systems. Honeycode APIs do require IT level skills to set them up. If you are looking to integrate Honeycode without programming consider using one of our supported integration platforms such as [Amazon AppFlow](https://aws.amazon.com/appflow/) and [Zapier](https://zapier.com/)

Honeycode Table APIs let you query the meta data such as listing tables within workbooks, perform batch operations on your table data such as adding, updating and deleting data in your Honeycode tables, and to import data from external sources. You can find a [full list of Honeycode APIs here](https://docs.aws.amazon.com/honeycode/latest/APIReference/Welcome.html) 

## Prerequisite

If you don’t have one already, [create a new Honeycode account](https://www.honeycode.aws) and login to your Honeycode account. To get started with Honeycode API you need to [link your Honeycode team with your AWS Account](https://honeycodecommunity.aws/t/connecting-honeycode-to-an-aws-account/98)

## Overview

In this sample code, I setup a light weight customer relationship management app using Amazon Honeycode and and then deploy a serverless API application to integrate and extend my Honeycode app. Here is an overview of the the application: ![Honeycode Table APIs sample architecture](architecture.png)

## Create a Customer Tracker app using Amazon Honeycode

Honeycode provides templates for a number of common use cases. Using a [Honeycode template](https://www.honeycode.aws/templates) creates a workbook with the required tables to store your data, as well as apps and automations with the basic functionality for that use case. You can then customize the app to meet your needs! Here are the steps to create a Customer Tracker app in Amazon Honeycode

1. Create a new Workbook using the [Customer Tracker](https://www.honeycode.aws/templates/customer-tracker) template. 

> *Note: If you are part of multiple teams in Honeycode, make sure to create the Workbook in the team which is linked to your AWS account*. 

2. Open Tables > **D_History** table and add a new column called **Exported**. You use this column to indicate if a row of contact history has been stored in the S3 bucket
3. Open Builder > **Customer Tracker** app, right click on any screen, click on **Get ARN and IDs**, and copy the **Workbook ID.** For help with this step refer to the [Getting started with APIs](https://honeycodecommunity.aws/t/getting-started-with-honeycode-apis/790#accessing-arn-and-ids) article in Honeycode Community

## Create a Serverless API application to read and write data from Amazon Honeycode

In this section, you create a [Serverless](https://aws.amazon.com/serverless/) API application to import customer records into Honeycode from [Amazon S3](https://aws.amazon.com/s3/) and [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) and to export customer contacts from Honeycode. After the customer contact history is exported to Amazon S3, the API application updates the **Exported** column in Honeycode with the current date. The API application is deployed using [AWS CDK](https://aws.amazon.com/cdk/), which let you manage your infrastructure using code. The API application includes three [AWS Lambda](https://aws.amazon.com/lambda/) functions, the **ImportCustomersS3** Lambda function to start an import of customer records when a CSV file is added to an S3 bucket, the **ImportCustomersDynamoDB** Lambda function to add/update/remove data in Honeycode tables in response to changes in a Amazon DynamoDB table and the **ExportContactHistoryS3** Lambda function (invoked every minute) to read the latest customer contact history and store them as a CSV file in a S3 bucket. Here are the steps to deploy the serverless API application

1. Download the [source package](https://github.com/aws-samples/amazon-honeycode-table-api-integration-sample) as a Zip file
2. Create/Open a [AWS Cloud9](https://aws.amazon.com/cloud9/) IDE instance. This may take a few minutes to complete. I recommend the following configuration for this lab:
    * Name: Honeycode API Lab
    * Environment type: Create a new EC2 instance for environment (direct access)
    * Instance type: t2.micro (1 GiB RAM + 1 vCPU)
    * Platform: Amazon Linux 2 (recommended)
    * Cost-saving setting: After 30 minutes (default)
> Note: If you’d like to use your own machine for deploying the API application, you can do so by following the instructions to [install and configure AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_prerequisites)
3. Upload the source package by clicking on File → Upload Local File to your Cloud9 instance and unzip it
```
unzip amazon-honeycode-table-api-integration-sample-main.zip
cd amazon-honeycode-table-api-integration-sample-main
```
> Tip: Open **bin/honeycode-api-lab.js** to view the name of the stack. You can optionally rename the stack from **HoneycodeLab** to say **JohnHoneycodeLab** by adding your first name so it is easier to identify the resources that you create
4. Open and update the **workbookId** with the value copied from your Customer Tracker Honeycode app
    * **lambda/ImportCustomersS3/env.json**
    * **lambda/ImportCustomersDynamoDB/env.json**
    * **lambda/ExportContactHistoryS3/env.json** 
5. Open and replace [name@example.com](mailto:name@example.com) with the email address that you used for logging into Honeycode in:
    * **data/customers-s3.csv**
    * **data/customers-dynamodb.json**
6. Run the following commands to start the deployment. This will take a few minutes to complete. 
```
npm install
cdk bootstrap
cdk deploy
```
> Note: Running cdk deploy will do the following
>    * Create the DynamoDB table, and S3 buckets
>    * Create the Lambda functions
>    * Create the event source (DynamoDB, S3 or Event Timer) for the Lambda functions
>    * Add permissions for the Lambda to access Honeycode
>    * Initialize the content in DynamoDB table, S3 bucket
7. Once the deployment is complete, wait a couple of minutes and then verify the application is running correctly by using the following steps:
    1. Open **A_Customers** table in Honeycode and verify that new records, **AnyCompany Auto** and **AnyCompany Water**, have been imported from S3 and DynamoDB respectively. 
    2. You can add/modify records in your **lamdba/ImportCustomersS3/customers-s3.csv** file in Cloud9 and run **cdk deploy** to replace/update the file in S3 bucket. Changes to customers-s3.csv file will be imported into Honeycode in about a minute. 
    3. Open [Amazon DynamoDB console](https://us-west-2.console.aws.amazon.com/dynamodb/home?region=us-west-2#tables:), view the table starting with the name ***HoneycodeLab-Customers***, open the **Items **tab where you can add/update/remove items in the table. Changes you make in this table should appear in the Honeycode **A_Customers** table. 
    4. Open the S3 bucket with the name ***h****oneycodelab-contacthistorybucket*** in your [Amazon S3 console](https://s3.console.aws.amazon.com/s3/home?region=us-west-2#), open the directories under that bucket to download/open the CSV file containing the Contact History records. You can add new contact history by opening the Honeycode Customer Tracker app, selecting a customer and adding a new contact detail. Newly added contact history data should appear in the S3 bucket as a new CSV file in about a minute.

## Cleanup

1. Remove the Serverless API application by running the following command in your Cloud9 IDE
```
cdk destroy
```
2. Delete the Cloud9 IDE by opening the [Cloud9 console](https://us-west-2.console.aws.amazon.com/cloud9/home?region=us-west-2) and clicking on Delete

## Summary

With this sample code, you created a customer tracker application in Amazon Honeycode. You used Honeycode’s API to read and write data using a serverless application. The possibilities in Honeycode are virtually endless. Let us know what you think in the comments!

*Not yet a Honeycode Customer? [Sign up for our free version here](https://www.honeycode.aws)*.
