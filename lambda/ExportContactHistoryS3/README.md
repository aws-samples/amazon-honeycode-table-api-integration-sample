# Honeycode Export Contact History

This lambda uses the `QueryTableRows` Honeycode APs to read contact history and saves them to an S3 bucket and then sets the Exported column in Honeycode table to today's date using the `BatchUpdateRows` Honeycode API
