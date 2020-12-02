# Honeycode Import Customers from S3

This lambda is invoked whenever an object is added to an S3 bucket and it uses the Honeycode `StartTableDataImportJobRequest` API to initiate the import of customer records from the S3 bucket

## Data

* Customer records are loaded from a S3 bucket
