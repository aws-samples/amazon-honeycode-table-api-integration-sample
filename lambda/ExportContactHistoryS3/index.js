/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
/**
 * This lambda uses the `QueryTableRows` Honeycode APs to read contact history and saves them to an S3 bucket and then sets the Exported column in Honeycode table to today's date using the `BatchUpdateRows` Honeycode API
 */
const AWS = require('aws-sdk') //Requires atleast VERSION 2.7x
const HC = new AWS.Honeycode({ region: 'us-west-2' })
const S3 = new AWS.S3()
const stringify = require('csv-stringify/lib/sync')

//Read and initialize variables from the lambda environment. The lambda environment is set by CDK using env.json file 
const { workbookId, contactHistoryTableName, s3bucket } = process.env


const saveToS3 = Body => {
    const now = new Date()
    const Key = `${now.getFullYear()}/${now.getMonth()}/${now.getDate()}/${now.getTime()}.csv`
    return S3.putObject({ Body, Bucket: s3bucket, Key }).promise()
}

exports.handler = async () => {
    try {
        //Get tables in this workbook
        const { tables } = await HC.listTables({ workbookId }).promise()
        //Create a map of table name to table id
        const tableIds = tables.reduce((tables, table) => {
            tables[table.tableName] = table.tableId
            return tables
        }, {})
        //Get Contact History columnIds
        const { tableColumns } = await HC.listTableColumns({
            workbookId, tableId: tableIds[contactHistoryTableName]
        }).promise()
        //Convert to array of column names
        const columns = tableColumns.map(column => ({ key: column.tableColumnName }))
        //This assumes Exported column is the last column in the table
        const exportedColumnId = tableColumns[tableColumns.length - 1].tableColumnId
        let count = 0
        const today = new Date().toLocaleDateString('en-US') //M/D/Y format
        let nextToken
        do {
            //Get contact history rows that have not been exported already
            const results = await HC.queryTableRows({
                workbookId, tableId: tableIds[contactHistoryTableName],
                filterFormula: {
                    formula: `=FILTER(${contactHistoryTableName}, "${contactHistoryTableName}[Exported] = %","")`
                },
                nextToken
            }).promise()
            //Convert json structure for writing to CSV
            const rows = []
            const rowsToUpdate = []
            if (results.rows) {
                for (let { cells, rowId } of results.rows) {
                    const row = []
                    for (let { formattedValue } of cells) {
                        row.push(formattedValue)
                    }
                    //Update exported date, assuming this is the last column in the table
                    row.splice(row.length - 1, 1, today)
                    rows.push(row)
                    rowsToUpdate.push({
                        rowId,
                        cellsToUpdate: {
                            [exportedColumnId]: {
                                fact: today
                            }
                        }
                    })
                }
            }
            if (rows.length > 0) {
                //Write to CSV
                await saveToS3(stringify(rows, { header: true, columns }))
                //Update exported date in table
                const { failedBatchItems } = await HC.batchUpdateTableRows({
                    workbookId, tableId: tableIds[contactHistoryTableName], rowsToUpdate
                }).promise()
                if (failedBatchItems) {
                    console.error('Failed to update export date', JSON.stringify(failedBatchItems, null, 2))
                }
                count += rows.length
            }
            nextToken = results.nextToken
        } while (nextToken)
        let result
        if (count) {
            result = `Exported ${count} row(s) of contact history`
        } else {
            result = `No contact history records to export`
        }
        return result
    } catch (error) {
        console.error(error)
        throw error
    }
}
