/*! 
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const cdk = require('@aws-cdk/core');
const { importCustomers } = require('./import-customers');
const { exportContactHistory } = require('./export-contact-history');

class HoneycodeApiLabStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    importCustomers(this);
    exportContactHistory(this);
  }
}

module.exports = { HoneycodeApiLabStack }
