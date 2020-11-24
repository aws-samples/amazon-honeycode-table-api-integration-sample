# Amazon Honeycode API Labs

This lab shows how to:
 * Use AWS Lambda functions to write data from an external source (Amazon S3) into Amazon Honeycode
 * Use AWS Lambda functions to read data from Amazon Honeycode, save them to Amazon S3 and mark those records in Honeycode as exported

This project uses AWS CDK to create the required resources.

## Useful commands

 * `cdk bootstrap`        bootstrap this stack
 * `cdk deploy`           deploy this stack to your default AWS account/region
 * `cdk diff`             compare deployed stack with current state
 * `cdk synth`            emits the synthesized CloudFormation template
 
## Files

* bin
  * honeycode-api-lab.js (Main entry for stack creation)
* data
  * customers.csv (Sample data)
* lamdba
  * ImportCustomers (ImportCustomers Lamdba source)
  * ExportContactHistory (ExportContactHistory Lamdba source)
* lib
  * honeycode-api-lab-stack.js (Stack definitions)
  * import-customers.js (Import Customers resources definition)
  * export-contact-history.js (Export Contact History resources definition)
