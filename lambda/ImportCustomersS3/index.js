/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * Read customer records from Amazon S3 bucket
 * Update or insert those customer records into Honeycode table
 */
const AWS = require('aws-sdk')
const HC = new AWS.Honeycode({ region: 'us-west-2' })
const S3 = new AWS.S3()

const { workbookId, customersTableName } = process.env

exports.handler = async ({ Records }) => {
    try {
        if (!Records) {
            const response = 'Lambda was invoked without any event Records';
            console.error(response);
            return response;
        }
        console.log(`Received ${Records.length} record(s) from S3`);
        //List tables in this workbook
        const { tables } = await HC.listTables({ workbookId }).promise();
        //Create a map of table name to table id
        const tableIds = tables.reduce((tables, table) => {
            tables[table.tableName] = table.tableId
            return tables
        }, {});
        //Process S3 records
        for (let { s3: { bucket: { name: Bucket }, object: { key: Key } } } of Records) {
            //Get S3 signed url
            const dataSourceUrl = S3.getSignedUrl('getObject', { Bucket, Key });
            //Start data import job
            const result = await HC.startTableDataImportJob({
                workbookId,
                destinationTableId: tableIds[customersTableName],
                dataSource: {
                    dataSourceConfig: {
                        dataSourceUrl
                    }
                },
                dataFormat: 'DELIMITED_TEXT',
                importOptions: {
                    delimitedTextOptions: {
                        delimiter: ',',
                        hasHeaderRow: true,
                        ignoreEmptyRows: true,
                        dataCharacterEncoding: 'UTF-8'
                    }
                },
                clientRequestToken: `s3://${Bucket}/${Key}`.slice(-64).padEnd(32, '-') //Client Request Token needs to be between 32 and 64 character
            }).promise();
            console.log('Start import job response', JSON.stringify(result, null, 2))
        }
    } catch (error) {
        console.error(error)
        throw error
    }
}
