/**
 * Contains utility functions for retrieving configuration values. Defines the bb.config namespace.
 *
 * @version 17.2.0
 * @author Graham O'Daniel
 */

// Define _ if it's not already defined and add minimum functionality
var _ = _ || {
    each: function(object, callback) {
        if (!object) return;

        for (item in object) {
            if (object instanceof Array) callback(object[item]);
            else callback(item);
        }
    }
};

// Define bb if it's not already defined
var bb = bb || {};

// Add config namespace to bb object
bb.config = {
    /**
     * Enumeration of fields available in configuration record.
     */
    fields: {
        SITE_AUDIT_ITEM: 'formula: {custrecord_bb_site_audit_item.id}',
        SYSTEM_DESIGN_ITEM: 'formula: {custrecord_bb_system_design_item.id}',
        INSTALLATION_ITEM: 'formula: {custrecord_bb_installation_item.id}',
        INSPECTION_ITEM: 'formula: {custrecord_bb_inspection_item.id}',
        SALES_PARTNER_ITEM: 'formula: {custrecord_bb_sales_partner_item.id}',
        SHIPPING_ITEM: 'formula: {custrecord_bb_shipping_item.id}',
        WARRANTY_RESERVE_ITEM: 'formula: {custrecord_bb_warranty_reserve_item.id}',
        MARGIN_ITEM: 'formula: {custrecord_bb_margin_item.id}',
        BAYWA_CHECK_PO_ITEM_AVAILABILITY: 'custrecord_bb_bay_check_po_item_avail',
        BAYWA_CHECK_SO_ITEM_AVAILABILITY: 'custrecord_bb_bay_check_so_item_avail',
        ADDER_LABOR_COST_PERCENT: 'custrecord_bb_adder_labor_cost_est_perc'
    },

    /**
     * Creates a search of active configurations and gets a list of fields.
     * Field IDs can start with "formula: " in which case the field will be treated as formula (text).
     *
     * @param {Array} fieldIds - The list of field IDs to retrieve from configuration record.
     * @returns {Object} Object with field IDs as properties.
     * @example
     * var config = bb.config.getConfigurations(['custrecord_field1', 'custrecord_field2']);
     * alert(config.custrecord_field1);
     * @example
     * var config = bb.config.getConfigurations(['custrecord_field1', 'custrecord_field2']);
     * alert(config['custrecord_field1']);
     * @example
     * var config = bb.config.getConfigurations([bb.config.fields.SITE_AUDIT_ITEM, bb.config.fields.SYSTEM_DESIGN_ITEM]);
     * alert(config[bb.config.fields.SITE_AUDIT_ITEM]);
     */
    getConfigurations: function getConfigurations(fieldIds) {
        var fields = {};

        // Construct search
        var searchFilters = [['isinactive', 'is', 'F']];
        var searchColumns = [];
        _.each(fieldIds, function(fieldId) {
            searchColumns.push(
                new nlobjSearchColumn(fieldId)
                    .setLabel(fieldId)
            );
            return true;
        });

        var configSearch = nlapiCreateSearch('customrecord_bb_solar_success_configurtn',
            searchFilters,
            searchColumns
        );

        configSearch.runSearch().forEachResult(function (result) {
            _.each(result.getAllColumns(), function(column) {
                fields[column.getLabel()] = {
                    value: result.getValue(column),
                    text: result.getText(column)
                }
            });
            return false;
        });

        return fields;
    },
    getCustomSegmentConfiguration: function getCustomSegmentConfiguration(fieldIds) {
        var fieldsArray = [];
        var segmentObj = {
            segmentId: 'cseg_bb_project',
            value: null
        };
        // Construct search
        var searchFilters = [['isinactive', 'is', 'F']];
        var searchColumns = [];
        _.each(fieldIds, function(fieldId) {
            searchColumns.push(
                new nlobjSearchColumn(fieldId)
                    .setLabel(fieldId)
            );
            return true;
        });

        var configSearch = nlapiCreateSearch('customrecord_bb_cust_seg_mapping',
            searchFilters,
            searchColumns
        );

        configSearch.runSearch().forEachResult(function (result) {
            var fields = {};
            _.each(result.getAllColumns(), function(column) {
                fields[column.getLabel()] = {
                    value: result.getValue(column),
                    text: result.getText(column)
                }
            });
            fieldsArray.push({
                segmentId: fields.custrecord_bb_cust_seg_field_id.value,
                value: null
            });

            return true;
        });
        if (!fieldsArray.length) {
            fieldsArray.push(segmentObj);
        }
        return fieldsArray;
    },

    /**
     * Makes use of getConfigurations passing in single fieldId as parameter in array format.
     *
     * @param {string} fieldId - The field ID to retrieve from configuration record.
     * @returns {string} The value of the field
     * @example
     * var config = bb.config.getConfiguration('custrecord_field1');
     * alert(config);
     * @example
     * var config = bb.config.getConfiguration(bb.config.fields.SITE_AUDIT_ITEM);
     * alert(config);
     */
    getConfiguration: function getConfiguration(fieldId) {
        return this.getConfigurations([fieldId])[fieldId];
    },

    /**
     * Makes use of getConfigurations passing in all fields defined in fields enumeration.
     *
     * @returns {Object} Configuration object containing all fields.
     */
    getAllConfigurations: function getAllConfigurations() {
        var fieldIds = [];
        var fields = this.fields;
        _.each(fields, function(field) {
            fieldIds.push(fields[field]);
        });
        return this.getConfigurations(fieldIds);
    },

    processProjectedRevenueCOGSActualLines: function processProjectedRevenueCOGSActualLines(recType, transactionRecord, standardLines, customLines, a_accounts, cogsAccounts, revAccounts, config) {
        // get custom segment mappings
        var customSegmentMappingArray = this.getCustomSegmentConfiguration(['custrecord_bb_cust_seg_field_id']);

        this.getCustomSegmentRecordValues(transactionRecord, customSegmentMappingArray);

        nlapiLogExecution("DEBUG", 'customSegmentMapping', JSON.stringify(customSegmentMappingArray));

        //transaction fields needed for all deferral scenarios
        var milestone = transactionRecord.getFieldText('custbody_bb_milestone');
        var str_acctgMethod = transactionRecord.getFieldText('custbody_bb_project_acctg_method');
        var projectID = transactionRecord.getFieldValue('custbody_bb_project');
        var epcRole = transactionRecord.getFieldText('custbody_bb_ss_if_epc_role');

        // nlapiLogExecution('DEBUG', 'EPC Role', epcRole);
        nlapiLogExecution("DEBUG", 'projectId', projectID);

        var memoText = (isCOGS) ? 'cost of sale' : 'revenue';
        var deferredMemo = 'Deferring ' + memoText + ' to be recognized on 100% Revenue Projected and COGS Actuals';

        // gets line details to map back to the line memo field for the deferral accounts
        var transactionLines = this.getTransactionLineItemValues(transactionRecord, recType, customSegmentMappingArray);
        var journalRecLines = this.getJournalLineDetails(transactionRecord, recType, customSegmentMappingArray);

        var accrualJECompleted = transactionRecord.getFieldValue('custbody_bb_proj_accrual_je_record');
        var advAccrualJE = transactionRecord.getFieldValue('custbody_bb_adv_pay_recognition_je');

        var isCOGS = (recType != 'invoice' && recType !='creditmemo' && recType != 'journal');
        var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
        nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
        nlapiLogExecution('DEBUG', 'isClawback', isClawback);

        var deferredAccount = (isCOGS) ? (epcRole == 'Installer' ? parseInt(config['custrecord_bb_ss_inv_rec_not_bill_acct'].value) :
            parseInt(config['custrecord_bb_deferred_proj_cost_account'].value)) : parseInt(config['custrecord_bb_unbilled_ar_account'].value);

        var standardLine, newCustomLine;
        var amount, departmentId, classId, locationId;
        if (recType == 'check' || recType == 'invoice' || recType == 'itemfulfillment' || recType == 'vendorbill' || recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt' || recType == 'customtransaction_bb_balance_of_system' || (recType == 'journalentry' && milestone != 'Accrual')) {

            // stop execution if the record type is not invoice or credit memo all cogs post directly to cash
            // if (isCOGS) return;

            // loop over standard lines
            for (var i = 0; i < standardLines.getCount(); i++) {
                var isCOGS = (recType != 'invoice' && recType !='creditmemo');
                var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
                nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
                nlapiLogExecution('DEBUG', 'isClawback', isClawback);
                var jeClawback = false;
                standardLine = standardLines.getLine(i);
                nlapiLogExecution('DEBUG', '1 Standard Line ' + i + ' Account ID', standardLine.getAccountId());

                // check if account only matches the revenue accounts listed on the config record
                var orignalAccountId = standardLine.getAccountId();
                var indexOfAccountID = a_accounts.indexOf(standardLine.getAccountId());

                // matching account id on the standard line from the config accounts
                if (indexOfAccountID != -1) {
                    if (recType == 'creditmemo') {
                        var debitAmount = standardLine.getDebitAmount();
                        if(debitAmount > 0 && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                            isCOGS = true;
                        }
                    }
                    //get values from standard lines
                    //get amount from standard line base on record type
                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                        amount = (isCOGS != isClawback) ? standardLine.getCreditAmount() : standardLine.getDebitAmount();
                    } else {
                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            amount = (isCOGS != isClawback) ? standardLine.getDebitAmount() : standardLine.getCreditAmount();
                        } else {// journal entry
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                amount = standardLine.getDebitAmount();
                                if (amount == parseInt(0)) {
                                    amount = standardLine.getCreditAmount();
                                    jeClawback = true;
                                }
                            }
                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                amount = standardLine.getCreditAmount();
                                if (amount == parseInt(0)) {
                                    amount = standardLine.getDebitAmount();
                                    jeClawback = true;
                                }
                            }
                        }
                    }

                    departmentId = standardLine.getDepartmentId();
                    classId = standardLine.getClassId();
                    locationId = standardLine.getLocationId();
                    entityId = standardLine.getEntityId();
                    var accountName = '';

                    if (amount == 0) continue;

                    // get matching transaction data to update memo field with deferral account name
                    var matchingTransactionDetails;
                    if (recType != 'journalentry') {
                        //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                        matchingTransactionDetails = this.getMatchingLineDetails(transactionLines, i);
                        deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;
                    } else {
                        matchingTransactionDetails = this.getMatchingLineDetailsByAccountId(journalRecLines, orignalAccountId);
                        deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;
                    }
                    if (matchingTransactionDetails.accountName) {
                        accountName = matchingTransactionDetails.accountName;
                        nlapiLogExecution('DEBUG', 'accountName', accountName)
                    } else {
                        var accountDetails = this.getMatchingLineDetailsByAccountId(transactionLines, orignalAccountId);
                        if (accountDetails.accountName) {
                            accountName = accountDetails.accountName;
                        }
                    }
                    var memoWithAcctName = (accountName) ? deferredMemo + ' || ' + accountName : deferredMemo;
                    // var memoWithAcctName = (matchingTransactionDetails.accountName) ? deferredMemo + ' || ' + matchingTransactionDetails.accountName : deferredMemo;

                    // stop accrual on cogs accounts when the accrual journal is already created. Should only execute revenue deferral for projected revenue
                    if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1 && accrualJECompleted) continue;

                    // adding matching offset account and amount
                    newCustomLine = customLines.addNewLine();
                    newCustomLine.setDepartmentId(departmentId);
                    newCustomLine.setClassId(classId);
                    newCustomLine.setLocationId(locationId);
                    newCustomLine.setAccountId(a_accounts[indexOfAccountID]);
                    newCustomLine.setEntityId(entityId);
                    this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);

                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {

                        (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);

                    } else {
                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);
                            newCustomLine.setMemo(memoWithAcctName);
                        } else {
                            // process journal entry lines to set offset account amount
                            nlapiLogExecution('DEBUG', 'jeClawback', jeClawback);
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setDebitAmount(amount);
                                } else {
                                    newCustomLine.setCreditAmount(amount);
                                }
                            }

                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setCreditAmount(amount);
                                } else {
                                    newCustomLine.setDebitAmount(amount);
                                }
                            }
                            var jeMem = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                            var jeDeferredMem = 'Deferring ' + jeMem + ' to be recognized on M3 per configuration';
                            var jeMemWithAcctName = (accountName) ? jeDeferredMem + ' || ' + accountName : jeDeferredMem;
                            newCustomLine.setMemo(jeMemWithAcctName);
                        }
                    }
                    //finished setting first custom GL line

                    // Add deferred revenue or COGS account line
                    newCustomLine = customLines.addNewLine();
                    newCustomLine.setDepartmentId(departmentId);
                    newCustomLine.setClassId(classId);
                    newCustomLine.setLocationId(locationId);
                    newCustomLine.setEntityId(entityId);
                    this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);


                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) { // setting correct line amount debit or credit
                        // set the correct deferrement amount when invoice contains a cogs item matching bb config COGS Accounts
                        (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);
                        var deferredProjectCostsAcct = parseInt(config['custrecord_bb_deferred_proj_cost_account'].value);

                        newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredProjectCostsAcct);
                        newCustomLine.setMemo(deferredMemo);
                        newCustomLine.setEntityId(entityId);

                    } else {

                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                            // for invoices or credit memos with revenue type accounts - if the advJE is populated - set the deferred revenue account to unbilled AR
                            // the invoice has already been included into the Journal entry as unbilled AR
                            if ((recType == 'invoice' || recType == 'creditmemo')) {
                                newCustomLine.setAccountId((!advAccrualJE) ? ((deferredAccountLineAccount) ? deferredAccountLineAccount : parseInt(config['custrecord_bb_deferred_revenue_account'].value)): parseInt(config['custrecord_bb_unbilled_ar_account'].value));
                            } else {
                                newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredAccount);
                            }
                            newCustomLine.setMemo(memoWithAcctName);

                        } else {
                            // set proper deferral line on journal entry
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setCreditAmount(amount);
                                } else {
                                    newCustomLine.setDebitAmount(amount);
                                }
                            }
                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setDebitAmount(amount);
                                } else {
                                    newCustomLine.setCreditAmount(amount);
                                }
                            }
                            var journalDeferredAccount = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? parseInt(config['custrecord_bb_deferred_proj_cost_account'].value) : parseInt(config['custrecord_bb_unbilled_ar_account'].value)
                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : journalDeferredAccount);

                            var jeMemo = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                            var jeDeferredMemo = 'Deferring ' + jeMemo + ' to be recognized on M3 per configuration';
                            var jeMemoWithAcctName = (accountName) ? jeDeferredMemo + ' || ' + accountName : jeDeferredMemo;
                            newCustomLine.setMemo(jeMemoWithAcctName);
                        }
                    }
                } //end account match
            } //end standard line loop
        }
    },


    processAccrualDeferalLines: function processAccrualDeferalLines(recType, transactionRecord, standardLines, customLines, a_accounts, cogsAccounts, revAccounts, config) {
        //transaction fields needed for all deferral scenarios
        var invoiceActuals = this.getConfigurations(['custrecord_bb_invoice_actuals_boolean']);
        var reduceTaxesFromM1 = this.getConfigurations(['custrecord_bb_reduce_tax_inv_credmem_bol'])
        var milestone = transactionRecord.getFieldText('custbody_bb_milestone');
        var str_acctgMethod = transactionRecord.getFieldText('custbody_bb_project_acctg_method');
        var advancedPaymentScheduleAcctMethod = transactionRecord.getFieldText('custbody_bb_adv_pay_recognition_type');
        var projectID = transactionRecord.getFieldValue('custbody_bb_project');
        var epcRole = transactionRecord.getFieldText('custbody_bb_ss_if_epc_role');

        var discountItem = (transactionRecord.getFieldValue('discountitem')) ? parseInt(transactionRecord.getFieldValue('discountitem')) : null;
        var discountItemGLAccount = transactionRecord.getFieldValue('custbody_bb_discount_item_gl_account');
        var discountItemGLAccountName = transactionRecord.getFieldText('custbody_bb_discount_item_gl_account');

        //tax account details
        var taxAmount = transactionRecord.getFieldValue('custbody_bb_ss_sales_order_tax_amt');
        var taxAccount = transactionRecord.getFieldValue('custbody_bb_ss_sales_tax_account');
        var taxMemo = transactionRecord.getFieldText('custbody_bb_ss_sales_tax_account');

        // warranty reserve account details
        var warrantyReserveAmt = transactionRecord.getFieldValue('custbody_bb_warranty_reserve_amt') || 0;
        var warrantyReserveAccount = parseInt(config['custrecord_bb_warranty_reserve_account'].value);

        var InvoiceAmount = Math.abs(transactionRecord.getFieldValue('custbody_bb_ss_credit_mem_inv_amt'));

        // get custom segment mappings
        var customSegmentMappingArray = this.getCustomSegmentConfiguration(['custrecord_bb_cust_seg_field_id']);

        this.getCustomSegmentRecordValues(transactionRecord, customSegmentMappingArray);

        nlapiLogExecution("DEBUG", 'customSegmentMapping', JSON.stringify(customSegmentMappingArray));

        // used currently only for invoice and credit memo transactions
        var transactionDeferralAccount = parseInt(transactionRecord.getFieldValue('custbody_bb_deferral_account'));

        nlapiLogExecution("DEBUG", 'projectId', projectID);

        // gets line details to map back to the line memo field for the deferral accounts
        var transactionLines = this.getTransactionLineItemValues(transactionRecord, recType, customSegmentMappingArray);
        var journalRecLines = this.getJournalLineDetails(transactionRecord, recType, customSegmentMappingArray);

        var isCOGS = (recType != 'invoice' && recType !='creditmemo');
        var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
        nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
        nlapiLogExecution('DEBUG', 'isClawback', isClawback);

        var deferredAccount = (isCOGS) ? (epcRole == 'Installer' ? parseInt(config['custrecord_bb_ss_inv_rec_not_bill_acct'].value) :
            parseInt(config['custrecord_bb_deferred_proj_cost_account'].value)) : ((transactionDeferralAccount) ? transactionDeferralAccount : parseInt(config['custrecord_bb_deferred_revenue_account'].value));

        var memoText = (isCOGS) ? 'cost of sale' : 'revenue';
        var deferredMemo;
        if (advancedPaymentScheduleAcctMethod == 'Actuals at Completion') {
            deferredMemo = 'Deferring ' + memoText + ' to be recognized on Actuals at Completion';
        } else if (advancedPaymentScheduleAcctMethod == 'Milestone') {
            deferredMemo = 'Deferring ' + memoText + ' to be recognized on Milestone Accrual';
        } else if (str_acctgMethod == 'Accrual') {
            deferredMemo = 'Deferring ' + memoText + ' to be recognized on M3 per configuration';
        } else if (str_acctgMethod == 'Actuals at Completion') {
            deferredMemo = 'Deferring ' + memoText + ' to be recognized on Actuals at Completion';
        } else if (str_acctgMethod == 'Milestone Accrual') {
            deferredMemo = 'Deferring ' + memoText + ' to be recognized on Milestone Accrual';
        }

        var standardLine, newCustomLine;
        var amount, departmentId, classId, locationId, entityId;
        if (recType == 'check' || recType == 'invoice' || recType == 'itemfulfillment' || recType == 'vendorbill' || recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt' || recType == 'customtransaction_bb_balance_of_system' || (recType == 'journalentry' && milestone != 'Accrual')) {
            // loop over standard lines
            for (var i = 0; i < standardLines.getCount(); i++) {
                var jeClawback = false;
                var isCOGS = (recType != 'invoice' && recType !='creditmemo');
                var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
                nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
                nlapiLogExecution('DEBUG', 'isClawback', isClawback);
                standardLine = standardLines.getLine(i);
                nlapiLogExecution('DEBUG', '2 Standard Line ' + i + ' Account ID', standardLine.getAccountId());


                var orignalAccountId = standardLine.getAccountId();
                var indexOfAccountID = a_accounts.indexOf(standardLine.getAccountId());

                // matching account id on the standard line from the config accounts
                if (indexOfAccountID != -1 ) {
                    //get values from standard lines
                    if (recType == 'creditmemo') {
                        var debitAmount = standardLine.getDebitAmount();
                        if(debitAmount > 0 && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                            isCOGS = true;
                        }
                    }
                    //calculate values from standard line for M1 deductions
                    var invUpdatedAmount = parseFloat(standardLine.getCreditAmount() - taxAmount - warrantyReserveAmt).toFixed(2);
                    var creditUpdatedAmount = parseFloat(standardLine.getDebitAmount() - taxAmount - warrantyReserveAmt).toFixed(2);

                    departmentId = standardLine.getDepartmentId();
                    classId = standardLine.getClassId();
                    locationId = standardLine.getLocationId();
                    entityId = standardLine.getEntityId();

                    if (str_acctgMethod != 'Cash') {

                        if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                            amount = (isCOGS != isClawback) ? standardLine.getCreditAmount() : standardLine.getDebitAmount();
                        } else {
                            if (recType != 'journalentry') {
                                //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                                amount = (isCOGS != isClawback) ? standardLine.getDebitAmount() : standardLine.getCreditAmount();
                            } else {// journal entry
                                if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    amount = standardLine.getDebitAmount();
                                    if (amount == parseInt(0)) {
                                        amount = standardLine.getCreditAmount();
                                        jeClawback = true;
                                    }
                                }
                                if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    amount = standardLine.getCreditAmount();
                                    if (amount == parseInt(0)) {
                                        amount = standardLine.getDebitAmount();
                                        jeClawback = true;
                                    }
                                }
                            }
                        }
                        // stop line execution if the amount = 0 or less than 0
                        if (amount == 0 || amount < 0) continue;
                        nlapiLogExecution('DEBUG', 'line amount', amount);
                        // get matching transaction data to update memo field with deferral account name
                        var memoWithAcctName;
                        var matchingTransactionDetails;
                        var deferredAccountLineAccount;
                        var segmentArray;
                        var accountName = '';
                        if (recType != 'journalentry') {
                            // handle discount item GL account name for memo purposes
                            if (a_accounts[indexOfAccountID] == discountItemGLAccount && discountItem) {
                                memoWithAcctName = (discountItemGLAccountName) ? deferredMemo + ' || ' + discountItemGLAccountName : deferredMemo;
                                matchingTransactionDetails = this.getMatchingLineDetails(transactionLines, i);
                                deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;

                            } else {
                                //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                                matchingTransactionDetails = this.getMatchingLineDetails(transactionLines, i);
                                if (matchingTransactionDetails.accountName) {
                                    accountName = matchingTransactionDetails.accountName;
                                } else {
                                    var accountDetails = this.getMatchingLineDetailsByAccountId(transactionLines, orignalAccountId);
                                    if (accountDetails.accountName) {
                                        accountName = accountDetails.accountName;
                                    }
                                }
                                memoWithAcctName = (accountName) ? deferredMemo + ' || ' + accountName : deferredMemo;
                                deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;

                            }

                        } else {
                            matchingTransactionDetails = this.getMatchingLineDetailsByAccountId(journalRecLines, orignalAccountId);
                            if (matchingTransactionDetails.accountName) {
                                accountName = matchingTransactionDetails.accountName;
                            } else {
                                var accountDetails = this.getMatchingLineDetailsByAccountId(transactionLines, orignalAccountId);
                                if (accountDetails.accountName) {
                                    accountName = accountDetails.accountName;
                                }
                            }
                            nlapiLogExecution('DEBUG', '2 accountName: ' + recType, accountName)
                            memoWithAcctName = (accountName) ? deferredMemo + ' || ' + accountName : deferredMemo;
                            deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;
                            segmentArray = matchingTransactionDetails.segmentArray;

                        }

                        // adding matching offset account and amount
                        newCustomLine = customLines.addNewLine();
                        newCustomLine.setDepartmentId(departmentId);
                        newCustomLine.setClassId(classId);
                        newCustomLine.setLocationId(locationId);
                        newCustomLine.setAccountId(a_accounts[indexOfAccountID]);
                        newCustomLine.setEntityId(entityId);
                        this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);

                        if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {

                            (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                            newCustomLine.setMemo(memoWithAcctName);

                        } else {
                            if (recType != 'journalentry') {
                                //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                                (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);
                                newCustomLine.setMemo(memoWithAcctName);
                            } else {
                                // process journal entry lines to set offset account amount
                                nlapiLogExecution('DEBUG', 'jeClawback', jeClawback);
                                if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    if (jeClawback) {
                                        newCustomLine.setDebitAmount(amount);
                                    } else {
                                        newCustomLine.setCreditAmount(amount);
                                    }
                                }

                                if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    if (jeClawback) {
                                        newCustomLine.setCreditAmount(amount);
                                    } else {
                                        newCustomLine.setDebitAmount(amount);
                                    }
                                }
                                var jeMem = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                                var jeDeferredMem = 'Deferring ' + jeMem + ' to be recognized on M3 per configuration';
                                var jeMemWithAcctName = (accountName) ? jeDeferredMem + ' || ' + accountName : jeDeferredMem;
                                newCustomLine.setMemo(jeMemWithAcctName);
                            }
                        }
                        //finished setting first custom GL line

                        // Add deferred revenue or COGS account line
                        newCustomLine = customLines.addNewLine();
                        newCustomLine.setDepartmentId(departmentId);
                        newCustomLine.setClassId(classId);
                        newCustomLine.setLocationId(locationId);
                        newCustomLine.setEntityId(entityId);
                        this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);

                        // specific script details to remove taxes and/or warranty reserve amounts from specific milestone invoice or credit memo.
                        if (recType == 'creditmemo' && milestone == 'M1' && epcRole != 'Installer' && taxAmount && taxAccount && (InvoiceAmount == parseFloat(amount).toFixed(2)) && reduceTaxesFromM1 == 'T') {
                            var newAmount = parseFloat(amount).toFixed(2); // precision amount to compare above
                            //nlapiLogExecution('DEBUG', 'CreditMemo Amount', newAmount);
                            if (invoiceActuals['custrecord_bb_invoice_actuals_boolean'].value == 'F') {
                                (isCOGS != isClawback) ? newCustomLine.setDebitAmount(creditUpdatedAmount) : newCustomLine.setCreditAmount(creditUpdatedAmount);
                                //Reverse tax liability account
                                nlapiLogExecution('DEBUG', 'Invoice Actuals', invoiceActuals['custrecord_bb_invoice_actuals_boolean'].value);

                                var taxLine = customLines.addNewLine();
                                taxLine.setDepartmentId(departmentId);
                                taxLine.setClassId(classId);
                                taxLine.setDebitAmount(taxAmount);
                                taxLine.setAccountId(parseInt(taxAccount));
                                taxLine.setMemo('Reversal - ' + taxMemo);
                                taxLine.setEntityId(entityId);
                                this.setCustomSegmentRecordValues(taxLine, customSegmentMappingArray)

                                if (warrantyReserveAmt > 0) {
                                    var warrantyLine = customLines.addNewLine();
                                    warrantyLine.setDepartmentId(departmentId);
                                    warrantyLine.setClassId(classId);
                                    warrantyLine.setDebitAmount(warrantyReserveAmt);
                                    warrantyLine.setAccountId(parseInt(warrantyReserveAccount));
                                    warrantyLine.setMemo('Warranty Reserve Amount');
                                    warrantyLine.setEntityId(entityId);
                                    this.setCustomSegmentRecordValues(warrantyLine, customSegmentMappingArray)
                                }
                            } else {
                                (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                            }

                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredAccount);
                            newCustomLine.setMemo(deferredMemo);
                            newCustomLine.setEntityId(entityId);

                        } else if (recType == 'invoice' && milestone == 'M1' && epcRole != 'Installer' && taxAmount && taxAccount && reduceTaxesFromM1 == 'T') {
                            // when invoice actuals is turned on, deduct the tax and warranty amounts from the line to balance out the deferred revenue amount
                            if (invoiceActuals['custrecord_bb_invoice_actuals_boolean'].value == 'F') {
                                nlapiLogExecution('DEBUG', 'updated invoice amount', invUpdatedAmount);
                                (isCOGS != isClawback) ? newCustomLine.setDebitAmount(invUpdatedAmount) : newCustomLine.setCreditAmount(invUpdatedAmount);
                                //set tax liability account
                                nlapiLogExecution('DEBUG', 'Invoice Actuals', invoiceActuals['custrecord_bb_invoice_actuals_boolean'].value);

                                if (invUpdatedAmount > 0) {
                                    nlapiLogExecution('DEBUG', 'tax line amount', taxAmount);
                                    var taxLine = customLines.addNewLine();
                                    taxLine.setDepartmentId(departmentId);
                                    taxLine.setClassId(classId);
                                    taxLine.setCreditAmount(taxAmount);
                                    taxLine.setAccountId(parseInt(taxAccount));
                                    taxLine.setMemo(taxMemo);
                                    taxLine.setEntityId(entityId);
                                }
                                // recognize warranty reserve
                                if (warrantyReserveAmt > 0) {
                                    nlapiLogExecution('DEBUG', 'warranty line amount', warrantyReserveAmt);
                                    var warrantyLine = customLines.addNewLine();
                                    warrantyLine.setDepartmentId(departmentId);
                                    warrantyLine.setClassId(classId);
                                    warrantyLine.setCreditAmount(warrantyReserveAmt);
                                    warrantyLine.setAccountId(parseInt(warrantyReserveAccount));
                                    warrantyLine.setMemo('Warranty Reserve Amount');
                                    warrantyLine.setEntityId(entityId);
                                }
                            } else {
                                // when invoice actuals is turned off return the normal amount from the line
                                (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                            }
                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredAccount);
                            newCustomLine.setMemo(deferredMemo);
                            newCustomLine.setEntityId(entityId);

                        } else if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) { // setting correct line amount debit or credit
                            // set the correct deferrement amount when invoice contains a cogs item matching bb config COGS Accounts
                            (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);

                            var deferredProjectCostsAcct = parseInt(config['custrecord_bb_deferred_proj_cost_account'].value);
                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredProjectCostsAcct);
                            newCustomLine.setMemo(memoWithAcctName);
                            newCustomLine.setEntityId(entityId);

                        } else {

                            if (recType != 'journalentry') {
                                //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                                (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                                try {
                                    newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredAccount);
                                } catch (error) {
                                    if (!deferredAccount) {
                                        throw 'The Deferred Revenue Account field (id: custrecord_bb_deferred_revenue_account) in the SolarSuccess Integration Configuration record cannot be empty. Please, set a value and try again.'                                    
                                    }
                                }
                                newCustomLine.setMemo(memoWithAcctName);

                            } else {
                                // set proper deferral line on journal entry
                                if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    if (jeClawback) {
                                        newCustomLine.setCreditAmount(amount);
                                    } else {
                                        newCustomLine.setDebitAmount(amount);
                                    }
                                }
                                if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                    if (jeClawback) {
                                        newCustomLine.setDebitAmount(amount);
                                    } else {
                                        newCustomLine.setCreditAmount(amount);
                                    }
                                }
                                var journalDeferredAccount = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? parseInt(config['custrecord_bb_deferred_proj_cost_account'].value) : parseInt(config['custrecord_bb_deferred_revenue_account'].value)
                                newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : journalDeferredAccount);

                                var jeMemo = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                                var jeDeferredMemo = 'Deferring ' + jeMemo + ' to be recognized on M3 per configuration';
                                var jeMemoWithAcctName =  (accountName) ? jeDeferredMemo + ' || ' + accountName : jeDeferredMemo;
                                newCustomLine.setMemo(jeMemoWithAcctName);
                            }
                        }
                    }

                    /*
                       ** Section for Cash Accrual **
                    */
                    // setup for cash and removing tax amount from revenue
                    if (str_acctgMethod == 'Cash' && recType == 'invoice' && milestone == 'M1' && epcRole != 'Installer' && taxAmount && taxAccount && reduceTaxesFromM1 == 'T') {

                        newCustomLine = customLines.addNewLine();
                        newCustomLine.setDepartmentId(departmentId);
                        newCustomLine.setClassId(classId);
                        newCustomLine.setLocationId(locationId);
                        (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(taxAmount);
                        newCustomLine.setAccountId(a_accounts[indexOfAccountID]);
                        newCustomLine.setMemo(deferredMemo);
                        newCustomLine.setEntityId(entityId);
                        this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray)

                        //set tax liability account
                        var taxLine = customLines.addNewLine();
                        taxLine.setDepartmentId(departmentId);
                        taxLine.setClassId(classId);
                        taxLine.setCreditAmount(taxAmount);
                        taxLine.setAccountId(parseInt(taxAccount));
                        taxLine.setMemo(taxMemo);
                        taxLine.setEntityId(entityId);
                        this.setCustomSegmentRecordValues(taxLine, customSegmentMappingArray)
                        // recognize warranty reserve
                        if (warrantyReserveAmt > 0) {
                            var warrantyLine = customLines.addNewLine();
                            warrantyLine.setDepartmentId(departmentId);
                            warrantyLine.setClassId(classId);
                            warrantyLine.setCreditAmount(warrantyReserveAmt);
                            warrantyLine.setAccountId(parseInt(warrantyReserveAccount));
                            warrantyLine.setMemo('Warranty Reserve Amount');
                            warrantyLine.setEntityId(entityId);
                            this.setCustomSegmentRecordValues(warrantyLine, customSegmentMappingArray)
                        }
                    } // end of cash deferrement section

                } //end account match
            } //end standard line loop
        }
    },


    processPercentCompleteLines: function processPercentCompleteLines(recType, transactionRecord, standardLines, customLines, a_accounts, cogsAccounts, revAccounts, config) {
        // get custom segment mappings
        var customSegmentMappingArray = this.getCustomSegmentConfiguration(['custrecord_bb_cust_seg_field_id']);

        this.getCustomSegmentRecordValues(transactionRecord, customSegmentMappingArray);

        nlapiLogExecution("DEBUG", 'customSegmentMapping', JSON.stringify(customSegmentMappingArray));

        //transaction fields needed for all deferral scenarios
        var milestone = transactionRecord.getFieldText('custbody_bb_milestone');
        var projectID = transactionRecord.getFieldValue('custbody_bb_project');
        var epcRole = transactionRecord.getFieldText('custbody_bb_ss_if_epc_role');

        var transactionDeferralAccount = parseInt(transactionRecord.getFieldValue('custbody_bb_deferral_account'));

        // nlapiLogExecution('DEBUG', 'EPC Role', epcRole);
        nlapiLogExecution("DEBUG", 'projectId', projectID);

        var memoText = (isCOGS) ? 'cost of sale' : 'revenue';
        var deferredMemo = 'Deferring ' + memoText + ' to be recognized on Percent Complete';

        // gets line details to map back to the line memo field for the deferral accounts
        var transactionLines = this.getTransactionLineItemValues(transactionRecord, recType, customSegmentMappingArray);
        var journalRecLines = this.getJournalLineDetails(transactionRecord, recType, customSegmentMappingArray);

        var accrualJECompleted = transactionRecord.getFieldValue('custbody_bb_proj_accrual_je_record');

        var isCOGS = (recType != 'invoice' && recType !='creditmemo' && recType != 'journal');
        var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
        nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
        nlapiLogExecution('DEBUG', 'isClawback', isClawback);

        var deferredAccount = (transactionDeferralAccount) ?  transactionDeferralAccount : parseInt(config['custrecord_bb_deferred_revenue_account'].value);

        var standardLine, newCustomLine;
        var amount, departmentId, classId, locationId;
        if (recType == 'check' || recType == 'invoice' || recType == 'itemfulfillment' || recType == 'vendorbill' || recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt' || recType == 'customtransaction_bb_balance_of_system' || (recType == 'journalentry' && milestone != 'Accrual')) {
            // stop execution if the record type is not invoice or credit memo all cogs post directly to cash
            if (isCOGS) return;

            // loop over standard lines
            for (var i = 0; i < standardLines.getCount(); i++) {
                var isCOGS = (recType != 'invoice' && recType !='creditmemo');
                var isClawback = (recType == 'creditmemo' || recType == 'vendorcredit' || recType == 'itemreceipt');
                nlapiLogExecution('DEBUG', 'isCOGS', isCOGS);
                nlapiLogExecution('DEBUG', 'isClawback', isClawback);
                var jeClawback = false;
                standardLine = standardLines.getLine(i);
                nlapiLogExecution('DEBUG', '3 Standard Line ' + i + ' Account ID', standardLine.getAccountId());

                // check if account only matches the revenue accounts listed on the config record
                var orignalAccountId = standardLine.getAccountId();
                var indexOfAccountID = a_accounts.indexOf(standardLine.getAccountId());

                if (recType == 'creditmemo') {
                    var debitAmount = standardLine.getDebitAmount();
                    if(debitAmount > 0 && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                        isCOGS = true;
                    }
                }
                // matching account id on the standard line from the config accounts
                if (indexOfAccountID != -1) {
                    //get values from standard lines
                    //get amount from standard line base on record type
                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                        amount = (isCOGS != isClawback) ? standardLine.getCreditAmount() : standardLine.getDebitAmount();
                    } else {
                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            amount = (isCOGS != isClawback) ? standardLine.getDebitAmount() : standardLine.getCreditAmount();
                        } else {// journal entry
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                amount = standardLine.getDebitAmount();
                                if (amount == parseInt(0)) {
                                    amount = standardLine.getCreditAmount();
                                    jeClawback = true;
                                }
                            }
                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                amount = standardLine.getCreditAmount();
                                if (amount == parseInt(0)) {
                                    amount = standardLine.getDebitAmount();
                                    jeClawback = true;
                                }
                            }
                        }
                    }

                    departmentId = standardLine.getDepartmentId();
                    classId = standardLine.getClassId();
                    locationId = standardLine.getLocationId();
                    entityId = standardLine.getEntityId();
                    var accountName = '';

                    if (amount == 0) continue;

                    // get matching transaction data to update memo field with deferral account name
                    var matchingTransactionDetails;
                    if (recType != 'journalentry') {
                        //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                        matchingTransactionDetails = this.getMatchingLineDetails(transactionLines, i);
                        deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;
                    } else {
                        matchingTransactionDetails = this.getMatchingLineDetailsByAccountId(journalRecLines, orignalAccountId);
                        deferredAccountLineAccount = (matchingTransactionDetails.deferredLineAccountId) ? matchingTransactionDetails.deferredLineAccountId : null;
                    }
                    if (matchingTransactionDetails.accountName) {
                        accountName = matchingTransactionDetails.accountName;
                    } else {
                        var accountDetails = this.getMatchingLineDetailsByAccountId(transactionLines, orignalAccountId);
                        if (accountDetails.accountName) {
                            accountName = accountDetails.accountName;
                        }
                    }
                    nlapiLogExecution('DEBUG', 'accountName', accountName)
                    var memoWithAcctName = (accountName) ? deferredMemo + ' || ' + accountName : deferredMemo;
                    // var memoWithAcctName = (matchingTransactionDetails.accountName) ? deferredMemo + ' || ' + matchingTransactionDetails.accountName : deferredMemo;

                    // stop accrual on cogs accounts when the accrual journal is already created. Should only execute revenue deferral for projected revenue
                    if (accrualJECompleted) continue; // 7/12/21 ML: removed from if condition -> cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1

                    // adding matching offset account and amount
                    newCustomLine = customLines.addNewLine();
                    newCustomLine.setDepartmentId(departmentId);
                    newCustomLine.setClassId(classId);
                    newCustomLine.setLocationId(locationId);
                    newCustomLine.setAccountId(a_accounts[indexOfAccountID]);
                    newCustomLine.setEntityId(entityId);
                    this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);

                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) {
                        (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                    } else {
                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);
                            newCustomLine.setMemo(memoWithAcctName);
                        } else {
                            // process journal entry lines to set offset account amount
                            nlapiLogExecution('DEBUG', 'jeClawback', jeClawback);
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setDebitAmount(amount);
                                } else {
                                    newCustomLine.setCreditAmount(amount);
                                }
                            }

                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setCreditAmount(amount);
                                } else {
                                    newCustomLine.setDebitAmount(amount);
                                }
                            }
                            var jeMem = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                            var jeDeferredMem = 'Deferring ' + jeMem + ' to be recognized on M3 per configuration';
                            var jeMemWithAcctName = (accountName) ? jeDeferredMem + ' || ' + accountName : jeDeferredMem;
                            newCustomLine.setMemo(jeMemWithAcctName);
                        }
                    }
                    //finished setting first custom GL line

                    // Add deferred revenue or COGS account line
                    newCustomLine = customLines.addNewLine();
                    newCustomLine.setDepartmentId(departmentId);
                    newCustomLine.setClassId(classId);
                    newCustomLine.setLocationId(locationId);
                    newCustomLine.setEntityId(entityId);
                    this.setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray);

                    if ((recType == 'invoice' || recType == 'creditmemo') && (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1)) { // setting correct line amount debit or credit
                        // set the correct deferrement amount when invoice contains a cogs item matching bb config COGS Accounts
                        (isCOGS != isClawback) ? newCustomLine.setCreditAmount(amount) : newCustomLine.setDebitAmount(amount);
                        var deferredProjectCostsAcct = parseInt(config['custrecord_bb_deferred_proj_cost_account'].value);
                        newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredProjectCostsAcct);
                        newCustomLine.setMemo(deferredMemo);
                        newCustomLine.setEntityId(entityId);

                    } else {

                        if (recType != 'journalentry') {
                            //all other transactions, vendor bills/credits, item fulfillments, item receipts, etc..
                            (isCOGS != isClawback) ? newCustomLine.setDebitAmount(amount) : newCustomLine.setCreditAmount(amount);
                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : deferredAccount);
                            newCustomLine.setMemo(memoWithAcctName);

                        } else {
                            // set proper deferral line on journal entry
                            if (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setCreditAmount(amount);
                                } else {
                                    newCustomLine.setDebitAmount(amount);
                                }
                            }
                            if (revAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) {
                                if (jeClawback) {
                                    newCustomLine.setDebitAmount(amount);
                                } else {
                                    newCustomLine.setCreditAmount(amount);
                                }
                            }
                            var journalDeferredAccount = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? parseInt(config['custrecord_bb_deferred_proj_cost_account'].value) : parseInt(config['custrecord_bb_unbilled_ar_account'].value)
                            newCustomLine.setAccountId((deferredAccountLineAccount) ? deferredAccountLineAccount : journalDeferredAccount);

                            var jeMemo = (cogsAccounts.indexOf(a_accounts[indexOfAccountID]) != -1) ? 'cost of sale' : 'revenue';
                            var jeDeferredMemo = 'Deferring ' + jeMemo + ' to be recognized on M3 per configuration';
                            var jeMemoWithAcctName = (accountName) ? jeDeferredMemo + ' || ' + accountName : jeDeferredMemo;
                            newCustomLine.setMemo(jeMemoWithAcctName);
                        }
                    }
                } //end account match
            } //end standard line loop
        }
    },

    isNotNull: function isNotNull(param) {
        return param != null && param != '' && param != undefined;
    },

    /**
     * function getJournalLineDetails(transactionRecord, recType)
     *
     * @param transactionRecord - NS Transaction Record - Read Only
     * @param recType - NS Transaction Record Type- Read Only
     * @returns - Array of journal entry line details used for GL line updates
     */
    getJournalLineDetails: function getJournalLineDetails(transactionRecord, recType, customSegmentMappingArray) {
        var projectArray = [];
        var lineCount = transactionRecord.getLineItemCount(this.getItemLineSublistId(recType));
        if (lineCount > 1) {
            for (var e = 1; e < lineCount + 1; e++) {
                if (!transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'entity', e)) continue;
                var lineObj = {}
                lineObj.projectId = transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'entity', e);
                lineObj.lineNum = e;
                lineObj.isAccrued = transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_proj_accrual_je_record', e);
                lineObj.accountingMethod = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'custcol_bb_je_proj_acct_method', e);
                lineObj.accountName = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'account', e);
                lineObj.accountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'account', e));
                lineObj.deferredLineAccountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_deferred_account_line', e));
                lineObj.segmentArray = [];
                if (customSegmentMappingArray.length > 0) {
                    for (var c = 0; c < customSegmentMappingArray.length; c++) {
                        var segmentFieldId = customSegmentMappingArray[c].segmentId;
                        nlapiLogExecution('DEBUG', 'segment field id type of ', typeof customSegmentMappingArray[c].segmentId);
                        var segmentLineValue = transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), customSegmentMappingArray[c].segmentId, e);
                        if (segmentLineValue && segmentFieldId) {
                            var segmentObj = {};
                            segmentObj[segmentFieldId] = segmentLineValue
                            lineObj.segmentArray.push(segmentObj);
                        }
                    }
                }
                projectArray.push(lineObj);
            }

        }
        nlapiLogExecution('DEBUG', 'Journal entry project entity ids', JSON.stringify(projectArray));
        return projectArray;

    },

    getExpenseLineDetails: function getExpenseLineDetails(transactionRecord, recType, customSegmentMappingArray) {
        var projectArray = [];
        var lineCount = transactionRecord.getLineItemCount('expense');
        nlapiLogExecution('DEBUG', 'Expense line count', lineCount);
        if (lineCount >= 1) {
            for (var e = 1; e < lineCount + 1; e++) {
                if (!transactionRecord.getLineItemValue('expense', 'customer', e)) continue;
                var lineObj = {};
                lineObj.projectId = transactionRecord.getLineItemValue('expense', 'customer', e);
                lineObj.lineNum = e;
                lineObj.isAccrued = transactionRecord.getLineItemValue('expense', 'custcolcustcol_bb_proj_accrual_expens', e);
                lineObj.accountingMethod = transactionRecord.getLineItemText('expense', 'custcol_bb_expense_proj_acct_method', e);
                lineObj.accountName = transactionRecord.getLineItemText('expense', 'account', e);
                lineObj.accountId = parseInt(transactionRecord.getLineItemValue('expense', 'account', e));
                lineObj.deferralLineAccountId = parseInt(transactionRecord.getLineItemValue('expense', 'custcol_bb_deferred_account_line', e));
                lineObj.segmentArray = [];
                if (customSegmentMappingArray.length > 0) {
                    for (var c = 0; c < customSegmentMappingArray.length; c++) {
                        var segmentFieldId = customSegmentMappingArray[c].segmentId;
                        nlapiLogExecution('DEBUG', 'segment field id ', customSegmentMappingArray[c].segmentId);
                        var segmentLineValue = transactionRecord.getLineItemValue('expense', customSegmentMappingArray[c].segmentId, e);
                        nlapiLogExecution('DEBUG', 'segment line value ', segmentLineValue);
                        if (segmentLineValue && segmentFieldId) {
                            var segmentObj = {};
                            segmentObj[segmentFieldId] = segmentLineValue
                            lineObj.segmentArray.push(segmentObj);
                        }
                    }
                }
                projectArray.push(lineObj);
            }
        }
        nlapiLogExecution('DEBUG', 'Expense Line project entity ids', JSON.stringify(projectArray));
        return projectArray;

    },


    /**
     * function getTransactionLineItemValues(transactionRecord, recType)
     *
     * @param transactionRecord - NS Transaction Record - Read Only
     * @param recType - NS Transaction Record Type- Read Only
     * @returns - Array of transaction line details used for GL line updates
     */
    getTransactionLineItemValues: function getTransactionLineItemValues(transactionRecord, recType) {
        var transactionArray = [];
        var lineCount = transactionRecord.getLineItemCount(this.getItemLineSublistId(recType));
        nlapiLogExecution('DEBUG', 'transaction line count', lineCount);
        if (lineCount > 0) {
            var z  = 1;
            for (var t = 1; t < lineCount + 1; t++) {
                var accountName;
                var accountId;
                var deferredLineAccountId;
                var amount = transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'amount', t);
                if (recType == 'invoice' || recType == 'creditmemo') {
                    //TODO - look at the value commented out for getting the account name and id for revenue based accounts
                    // accountName = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'custcol_bb_revenue_account_sourced', t);
                    // accountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_revenue_account_sourced', t));
                    accountName = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'custcol_bb_discount_item_account', t);
                    accountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_discount_item_account', t));
                    deferredLineAccountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_deferred_rev_acct_item', t));

                } else {
                    if (recType != 'journalentry') {
                        accountName = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'custcol_bb_cogs_account_sourced', t);
                        accountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_cogs_account_sourced', t));
                        deferredLineAccountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_deferred_cogs_acct_item', t));
                    } else {
                        accountName = transactionRecord.getLineItemText(this.getItemLineSublistId(recType), 'account', t);
                        accountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'account', t));
                        deferredLineAccountId = parseInt(transactionRecord.getLineItemValue(this.getItemLineSublistId(recType), 'custcol_bb_deferred_account_line', t));
                    }
                }

                if (recType == 'itemfulfillment' && t > 1) {
                    transactionArray.push({
                        accountName: accountName,
                        accountId: accountId,
                        deferredLineAccountId: deferredLineAccountId,
                        lineNum: z += 3,
                        sublistId: this.getItemLineSublistId(recType)
                    });
                } else {
                    transactionArray.push({
                        accountName: accountName,
                        accountId: accountId,
                        deferredLineAccountId:deferredLineAccountId,
                        lineNum: t,
                        sublistId: this.getItemLineSublistId(recType)
                    });

                }
            }// end of loop
        }

        if ((recType == 'vendorbill' || recType == 'check' || recType == 'vendorcredit')) {
            var expenseLineCount = transactionRecord.getLineItemCount('expense'); //this.getItemLineSublistId(recType)
            nlapiLogExecution('DEBUG', 'expense line count', expenseLineCount);
            if (expenseLineCount > 0) {
                var n = 1;
                for (var e = 1; e < expenseLineCount + 1; e++) {
                    var amount = transactionRecord.getLineItemValue('expense', 'amount', e)
                    var accountName = transactionRecord.getLineItemText('expense', 'account', e);
                    var accountId = parseInt(transactionRecord.getLineItemValue('expense', 'account', e));
                    var deferredLineAccountId = parseInt(transactionRecord.getLineItemValue('expense', 'custcol_bb_deferred_account_line', e));
                    transactionArray.push({
                        accountName: accountName,
                        accountId: accountId,
                        deferredLineAccountId: deferredLineAccountId,
                        lineNum: e,
                        sublistId: 'expense'
                    });
                }
            }
        }
        nlapiLogExecution('DEBUG', 'Transactions Account Name and Ids', JSON.stringify(transactionArray));
        return transactionArray;
    },

    /**
     * function getMatchingLineDetails(lines, lineNumber)
     *
     * @param lines - Array of objecs of NS Transaction Record
     * @param lineNumber - line id
     * @returns - matching line object
     */
    getMatchingLineDetails: function getMatchingLineDetails(lines, lineNumber) {
        var indexNumber = lines.map(function(result) {return result.lineNum;}).indexOf(lineNumber);
        if (indexNumber != -1) {
            return lines[indexNumber];
        } else {
            return -1;
        }
    },

    /**
     * function getMatchingLineDetailsByAccountId(lines, accountId)
     *
     * @param lines - Array of objecs of NS Transaction Record
     * @param accountId - NS Account ID
     * @returns - matching line object
     */
    getMatchingLineDetailsByAccountId: function getMatchingLineDetailsByAccountId(lines, accountId) {
        var indexNumber = lines.map(function(result) {return result.accountId;}).indexOf(accountId);
        if (indexNumber != -1) {
            return lines[indexNumber];
        } else {
            return -1;
        }
    },

    /**
     * function getItemLineSublistId(recType)
     *
     * @param recType - NS Transaction Record Type- Read Only
     * @returns - NS Sublist internal id
     */
    getItemLineSublistId: function getItemLineSublistId(recType) {
        switch (recType) {
            case 'invoice' : return 'item';
            case 'creditmemo' : return 'item';
            case 'vendorbill' : return 'item';
            case 'itemfulfillment' : return 'item';
            case 'journalentry' : return 'line';
            case 'vendorcredit' : return 'item';
            case 'itemreceipt' : return 'item';
            case 'customtransaction_bb_balance_of_system' : return 'line';
            default: 'item';
                break;
        }
    },

    /**
     * function getExpenseLineSublistId(recType)
     *
     * @param recType - NS Transaction Record Type- Read Only
     * @returns - NS Expense Sublist internal id
     */
    getExpenseLineSublistId: function getExpenseLineSublistId(recType) {
        switch (recType) {
            case 'vendorbill' : return 'expense';
            case 'check' : return 'expense';
            case 'vendorcredit': return 'expense';
            default: 'expense';
        }
    },

    /**
     * function getCustomSegmentRecordValues(transactionRecord, customSegmentMappingArray)
     * updates the customSegmentObject to add values from the transaction header level fields
     * @param transactionRecord - NS Transaction Record Type- Read Only
     * @param customSegmentMappingArray - Array of Objects contains custom segment field Id's
     * @returns - void
     */
    getCustomSegmentRecordValues: function getCustomSegmentRecordValues(transactionRecord, customSegmentMappingArray) {
        if (customSegmentMappingArray.length > 0) {
            for (var i = 0; i < customSegmentMappingArray.length; i++) {
                var segmentFieldId = customSegmentMappingArray[i].segmentId;
                var custSegmentRecordValue = transactionRecord.getFieldValue(segmentFieldId);
                if (custSegmentRecordValue) {
                    customSegmentMappingArray[i].value = custSegmentRecordValue;
                }
            }
        }
    },

    /**
     * function setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray)
     * sets the custom segment line data for custom gl lines - used for transactions using items
     * @param transactionRecord - NS Transaction Record Type- Read Only
     * @param customSegmentMappingArray - Array of Objects contains custom segment field Id's
     * @returns - void
     */
    setCustomSegmentRecordValues: function setCustomSegmentRecordValues(newCustomLine, customSegmentMappingArray) {
        if (customSegmentMappingArray.length > 0) {
            for (var i = 0; i < customSegmentMappingArray.length; i++) {
                var custSegmentRecordValue = customSegmentMappingArray[i].value;
                var custSegmentFieldId = customSegmentMappingArray[i].segmentId;
                var lineSegmentValue = newCustomLine.getSegmentValueId(custSegmentFieldId);
                if (custSegmentFieldId && lineSegmentValue) {
                    newCustomLine.setSegmentValueId(custSegmentFieldId, parseInt(lineSegmentValue))
                } else if (custSegmentFieldId && custSegmentRecordValue) {
                    newCustomLine.setSegmentValueId(custSegmentFieldId, parseInt(custSegmentRecordValue));
                }
            }
        }
    },

    /**
     * function setCustomSegmentRecordLineValues(newCustomLine, segmentArray)
     * sets the custom segment line data for custom gl lines - used for bills with expense lines and journal entry lines
     * @param transactionRecord - NS Transaction Record Type- Read Only
     * @param segmentArray - Array of Objects contains custom segment field Id's and values
     * @returns - void
     */
    setCustomSegmentRecordLineValues: function setCustomSegmentRecordLineValues(newCustomLine, segmentArray) {
        if (segmentArray.length > 0) {
            for (var i = 0; i < segmentArray.length; i++) {
                nlapiLogExecution('DEBUG', 'Segment array line values', JSON.stringify(segmentArray[i]));
                for (var key in segmentArray[i]) {
                    nlapiLogExecution('DEBUG', 'Segment array key value', key);
                    nlapiLogExecution('DEBUG', 'Segment array line value', parseInt(segmentArray[i][key]));
                    newCustomLine.setSegmentValueId(key, parseInt(segmentArray[i][key]));
                }
            }
        }
    },

};