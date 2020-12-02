/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
const cdk = require('@aws-cdk/core');
const { importCustomersS3 } = require('./import-customers-s3');
const { importCustomersDynamoDB } = require('./import-customers-dynamodb');
const { exportContactHistory } = require('./export-contact-history-s3');

class HoneycodeApiLabStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    importCustomersS3(this);
    importCustomersDynamoDB(this);
    exportContactHistory(this);
  }
}

module.exports = { HoneycodeApiLabStack }
