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
const parse = require('csv-parse/lib/sync')

const { workbookId, customersTableName, countryTableName, statusTableName, s3bucket, s3file } = process.env


const getRowlinks = async (table, tableIds) => {
    const { rows } = await HC.queryTableRows({
        workbookId, tableId: tableIds[table], filterFormula: {
            formula: `=FILTER(${table})`
        }
    }).promise()
    //Convert to map of first column value and rowId
    return rows.reduce((rows, row) => {
        rows[row.cells[0].formattedValue] = row.rowId
        return rows
    }, {})
}

exports.handler = async () => {
    try {
        //List tables in this workbook
        const { tables } = await HC.listTables({ workbookId }).promise()
        //Create a map of table name to table id
        const tableIds = tables.reduce((tables, table) => {
            tables[table.tableName] = table.tableId
            return tables
        }, {})

        //Read customers.csv from S3
        const customersCSV = (await S3.getObject({
            Bucket: s3bucket,
            Key: s3file,
        }).promise()).Body.toString()
        const customers = parse(customersCSV, { columns: true })
        //Get Country rows
        const country = await getRowlinks(countryTableName, tableIds)
        //Get Status rows
        const status = await getRowlinks(statusTableName, tableIds)
        //Get Customer table columns
        const { tableColumns } = await HC.listTableColumns({
            workbookId, tableId: tableIds[customersTableName]
        }).promise()
        //Create a map of column name to column ids
        const columnIds = tableColumns.reduce((columns, column) => {
            columns[column.tableColumnName] = column.tableColumnId
            return columns
        }, {})
        const companyNames = []
        for (let customer of customers) {
            companyNames.push(customer.Company)
            //Update values to rowId in customers for rowlinks/picklists
            customer.Country = country[customer.Country]
            customer.Status = status[customer.Status]
            //Replace column names with column ids and convert to required shape
            for (let key of Object.keys(customer)) {
                customer[columnIds[key]] = {
                    fact: customer[key]
                }
                delete customer[key]
            }
        }
        //Upsert customers
        const { rows, failedBatchItems } = await HC.batchUpsertTableRows({
            workbookId, tableId: tableIds[customersTableName], rowsToUpsert: customers.map((customer, i) => ({
                batchItemId: `row-${i}`,
                filter: {
                    formula: `=FILTER(${customersTableName}, "${customersTableName}[Company] = %", "${companyNames[i]}")`,
                },
                cellsToUpdate: customer
            }))
        }).promise()
        let response = ''
        if (rows) {
            //Get counts of updated and appended rows
            const results = { UPDATED: 0, APPENDED: 0 }
            for (let { upsertAction } of Object.values(rows)) {
                results[upsertAction]++
            }
            response = `Update customers results: ${JSON.stringify(results)}`
        }
        if (failedBatchItems) {
            const error = `Upsert failed for these items: ${JSON.stringify(failedBatchItems, null, 2)}`
            console.error(error)
            response += error
        }
        console.log(response)
        return response
    } catch (error) {
        console.error(error)
        throw error
    }
}
