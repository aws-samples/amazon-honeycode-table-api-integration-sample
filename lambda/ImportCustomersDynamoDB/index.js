/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * Invoked with updates to Customers table from DynamoDB
 * Updates or inserts those customers into Honeycode
 */
const AWS = require('aws-sdk')
const HC = new AWS.Honeycode({ region: 'us-west-2' })

//Read and initialize variables from the lambda environment. The lambda environment is set by CDK using env.json file 
const { workbookId, customersTableName, countryTableName, statusTableName, contactHistoryTableName } = process.env


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

exports.handler = async ({ Records }) => {
    try {
        if (!Records) {
            const response = 'Lambda was invoked without any event Records';
            console.error(response);
            return response;
        }
        console.log(`Received ${Records.length} record(s) from DynamoDB`)
        //List tables in this workbook
        const { tables } = await HC.listTables({ workbookId }).promise()
        //Create a map of table name to table id
        const tableIds = tables.reduce((tables, table) => {
            tables[table.tableName] = table.tableId
            return tables
        }, {})
        //Get Country rows
        const country = await getRowlinks(countryTableName, tableIds)
        //Get Status rows
        const status = await getRowlinks(statusTableName, tableIds)
        //Get Customer table columns
        const { tableColumns } = await HC.listTableColumns({
            workbookId, tableId: tableIds[customersTableName]
        }).promise()
        let companyColumnIndex = 0
        //Create a map of column name to column ids
        const columnIds = tableColumns.reduce((columns, column, index) => {
            columns[column.tableColumnName] = column.tableColumnId
            if (column.tableColumnName === 'Company') {
                companyColumnIndex = index
            }
            return columns
        }, {})
        const rowsToCreate = [];
        const rowsToUpdate = [];
        const rowsToDelete = [];
        let lastEvent
        let batchItemId = 1
        //Batch events for processing until there is a REMOVE event in the stream
        //Consecutive INSERT or MODIFY events will be batched
        //Consecutive REMOVE events will be batched
        for (let record of Records) {
            if (record.eventName === 'REMOVE') {
                if (lastEvent !== 'REMOVE') {
                    //Process pending events
                    await processEvents(tableIds, rowsToCreate, rowsToUpdate, rowsToDelete, companyColumnIndex);
                }
                //Record to be removed from Honeycode
                rowsToDelete.push({ company: record.dynamodb.Keys.Company.S });
            } else {
                if (lastEvent === 'REMOVE') {
                    //Process pending events
                    await processEvents(tableIds, rowsToCreate, rowsToUpdate, rowsToDelete, companyColumnIndex);
                }
                const { dynamodb: { NewImage: customer } } = record
                //Replace Country and Status values with rowlinks
                customer.Country.S = country[customer.Country.S] || customer.Country.S
                customer.Status.S = status[customer.Status.S] || customer.Status.S
                //Convert from DynamoDB json to Honeycode json
                for (let key of Object.keys(customer)) {
                    customer[columnIds[key]] = {
                        fact: customer[key].S || customer[key].N.toString()
                    }
                    delete customer[key]
                }
                if (record.eventName === 'INSERT') {
                    //Record to be inserted in Honeycode
                    rowsToCreate.push({ cellsToCreate: customer, batchItemId: batchItemId.toString() });
                } else if (record.eventName === 'MODIFY') {
                    //Record to be updated in Honeycode
                    rowsToUpdate.push({
                        company: record.dynamodb.Keys.Company.S,
                        cellsToUpdate: customer,
                        batchItemId: batchItemId.toString()
                    });
                }
            }
            batchItemId++;
            lastEvent = record.eventName;
        }
        //Process remaining events
        await processEvents(tableIds, rowsToCreate, rowsToUpdate, rowsToDelete, companyColumnIndex);
        return `Processed ${Records.length} records from DynamoDB`
    } catch (error) {
        console.error(error)
        throw error
    }
}

const getRows = (tableId, rows) => HC.queryTableRows({
    workbookId,
    tableId,
    filterFormula: {
        formula: `=FILTER(${customersTableName}, "${rows.map(({ company }) => `${customersTableName}[Company]=""${company}""`).join(' OR ')}")`
    }
}).promise();

const getContactHistoryRows = (tableId, rows) => HC.queryTableRows({
    workbookId,
    tableId,
    filterFormula: {
        formula: `=FILTER(${contactHistoryTableName}, "${rows.map(({ company }) => `${contactHistoryTableName}[Customer]=""${company}""`).join(' OR ')}")`
    }
}).promise();

const batchDeleteRows = async (tableId, rows) => {
    if (rows && rows.length > 0) {
        //Batch delete rows
        const { failedBatchItems } = await HC.batchDeleteTableRows({
            workbookId,
            tableId,
            rowIds: rows.map(row => row.rowId)
        }).promise();
        if (failedBatchItems) {
            console.error('Failed Delete Batch Items', JSON.stringify(failedBatchItems, null, 2));
            console.log(`Deleted ${rows.length - failedBatchItems.length} rows`)
        } else {
            console.log(`Deleted ${rows.length} rows`)
        }
    }
}

const processEvents = async (tableIds, rowsToCreate, rowsToUpdate, rowsToDelete, companyColumnIndex) => {
    //Delete rows in Honeycode
    if (rowsToDelete.length > 0) {
        //Get Contact History for these companies to be deleted
        const { rows: historyRows } = await getContactHistoryRows(tableIds[contactHistoryTableName], rowsToDelete)
        await batchDeleteRows(tableIds[contactHistoryTableName], historyRows);
        //Get A_Company Row Ids to be deleted
        const { rows } = await getRows(tableIds[customersTableName], rowsToDelete);
        await batchDeleteRows(tableIds[customersTableName], rows);
        //Reset delete array
        rowsToDelete.length = 0;
    }
    //Batch create rows in Honeycode
    if (rowsToCreate.length > 0) {
        const { failedBatchItems } = await HC.batchCreateTableRows({
            workbookId,
            tableId: tableIds[customersTableName],
            rowsToCreate
        }).promise();
        if (failedBatchItems) {
            console.error('Failed Create Batch Items', JSON.stringify(failedBatchItems, null, 2));
            console.log(`Created ${rowsToCreate.length - failedBatchItems.length} rows`)
        } else {
            console.log(`Created ${rowsToCreate.length} rows`)
        }
        //Reset create array
        rowsToCreate.length = 0;
    }
    //Batch update rows in Honeycode
    if (rowsToUpdate.length > 0) {
        //Get Row Ids to be updated
        const { rows } = await getRows(tableIds[customersTableName], rowsToUpdate);
        if (rows && rows.length > 0) {
            //Convert to map of company name to rowId
            const rowIds = rows.reduce((rows, row) => {
                rows[row.cells[companyColumnIndex].formattedValue] = row.rowId;
                return rows;
            }, {});
            //Batch update rows
            const { failedBatchItems } = await HC.batchUpdateTableRows({
                workbookId,
                tableId: tableIds[customersTableName],
                rowsToUpdate: rowsToUpdate.map(({ company, cellsToUpdate }) => ({
                    rowId: rowIds[company],
                    cellsToUpdate
                }))
            }).promise();
            if (failedBatchItems) {
                console.error('Failed Update Batch Items', JSON.stringify(failedBatchItems, null, 2));
                console.log(`Updated ${rowsToUpdate.length - failedBatchItems.length} rows`)
            } else {
                console.log(`Updated ${rowsToUpdate.length} rows`)
            }
        }
        //Reset delete array
        rowsToUpdate.length = 0;
    }
}
