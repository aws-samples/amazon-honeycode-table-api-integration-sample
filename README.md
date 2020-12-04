# Amazon Honeycode API Labs

This lab shows how to:
 * Use AWS Lambda functions to write data from external sources (Amazon S3, Amazon DynamoDB) into Amazon Honeycode. The lambda functions are triggered when a new file is added to the S3 bucket or when items in DynamoDB table are added/updated/removed
 * Use AWS Lambda functions to read data from Amazon Honeycode, save them to Amazon S3 and mark those records in Honeycode as exported

This project uses AWS CDK to create the required resources.

## Documentation

An architecture diagram and instructions for using this sample code can be found here: [Amazon Honeycode Table API sample code documentation](doc/README.md)

## Useful commands

 * `cdk bootstrap`        bootstrap this stack
 * `cdk deploy`           deploy this stack to your default AWS account/region
 * `cdk diff`             compare deployed stack with current state
 * `cdk synth`            emits the synthesized CloudFormation template
 
## Files

* bin
  * honeycode-api-lab.js (Main entry for stack creation)
* data
  * customers-s3.csv (Sample data for S3 data import)
  * customers-dynamodb.json (Sample data for DynamoDB data import)
* lamdba
  * ImportCustomersS3 (Import customers from S3)
  * ImportCustomersDynamoDB (Import customers from DynamoDB)
  * ExportContactHistory (Export contact history from Honeycode to S3)
* lib
  * honeycode-api-lab-stack.js (Stack definitions)
  * import-customers-s3.js (Import customers from S3 resources definition)
  * import-customers-dynamodb.js (Import customers from DynamoDB resources definition)
  * export-contact-history.js (Export Contact History resources definition)
