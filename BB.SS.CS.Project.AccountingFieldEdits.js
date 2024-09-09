/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @author Ashley Wallace
 * @NModuleScope Public
 * @version 0.1.1
 * @fileOverview update accounting fields after field edit
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search', './BB SS/SS Lib/BB.SS.MD.AccountingFieldCalculations'], function(record, search, accountingCalc) {

    var _updateFunc = {};
    _updateFunc['custentity_bb_services_costs_amount'] = function(record){
        var _servicesCostAmount = accountingCalc.calculation['custentity_bb_services_costs_amount'](record);
        if(_servicesCostAmount > 0) {
            record.setValue({fieldId: 'custentity_bb_services_costs_amount', value: _servicesCostAmount});
            var _servicesCostPerWatt = accountingCalc.calculation['custentity_bb_services_costs_pr_watt_amt'](record, _servicesCostAmount);
            if(_servicesCostPerWatt > 0){
                record.setValue({fieldId: 'custentity_bb_services_costs_pr_watt_amt', value: _servicesCostPerWatt});
            }
        }
    };

    var _updateTrigger = {};
    _updateTrigger['custentity_bb_site_audit_amount'] = _updateFunc['custentity_bb_services_costs_amount'];
    _updateTrigger['custentity_bb_design_amount'] = _updateFunc['custentity_bb_services_costs_amount'];
    _updateTrigger['custentity_bb_installer_vbill_ttl_amt'] = _updateFunc['custentity_bb_services_costs_amount'];
    _updateTrigger['custentity_bb_inspection_amount'] = _updateFunc['custentity_bb_services_costs_amount'];
    _updateTrigger['custentity_bb_warranty_service_amount'] = _updateFunc['custentity_bb_services_costs_amount'];


    function fieldChanged(context) {
    	var currentRecord = context.currentRecord;
        var currentFieldId = context.fieldId;
        var payScheduleId = currentRecord.getValue({
            fieldId: 'custentity_bb_financier_payment_schedule'
        });
        console.log('payschedule id', payScheduleId);
        var downPayment;
        var downPaymentMilestoneName;
        if (payScheduleId) {
            var lookup = search.lookupFields({
                type: 'customrecord_bb_milestone_pay_schedule',
                id: payScheduleId,
                columns: ['custrecord_bb_mps_down_payment_amount', 'custrecord_bb_down_payment_milestone']
            });
            downPayment = lookup.custrecord_bb_mps_down_payment_amount;
            if (lookup.custrecord_bb_down_payment_milestone.length > 0) {
                downPaymentMilestoneName = lookup.custrecord_bb_down_payment_milestone[0].text
            } else {
                downPaymentMilestoneName = null;
            }
        }
        console.log('down payment amount', downPayment);
        
        try {
            switch (currentFieldId) {
    	
                case 'custentity_bb_rebate_application_amount': 
                    currentRecord.setValue ({ //Rebate Variance Amount
                        fieldId: 'custentity_bb_rebate_variance_amount', 
                        value: accountingCalc.getRebateVariance(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Rebate Application Amount Copy
                        fieldId: 'custentity_bb_rebate_app_amount_copy', 
                        value: currentRecord.getValue('custentity_bb_rebate_application_amount'),
                        ignoreFieldChange: true
                    });
                    break;
                
                case 'custentity_bb_rebate_confirmation_amount': 
                    currentRecord.setValue ({ //Rebate Variance Amount
                        fieldId: 'custentity_bb_rebate_variance_amount', 
                        value: accountingCalc.getRebateVariance(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Rebate Confirmation Amount Copy
                        fieldId: 'custentity_bb_rebate_conf_amount_copy', 
                        value: currentRecord.getValue('custentity_bb_rebate_confirmation_amount'),
                        ignoreFieldChange: true
                    });
                    break;
                
                case 'custentity_bb_fin_base_fees_amount':
                    currentRecord.setValue ({ //Financier Total Fees Amount
                        fieldId: 'custentity_bb_fin_total_fees_amount',
                        value: accountingCalc.getFinancierTotalFees(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Financier Total Invoice Amount
                        fieldId: 'custentity_bb_fin_total_invoice_amount',
                        value: accountingCalc.getFinancierTotalInvoiceAmount(currentRecord),
                        ignoreFieldChange: true
                    });

                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
                
                case 'custentity_bb_fin_prelim_purch_price_amt':
                    currentRecord.setValue ({ //Financier Total Invoice Amount
                        fieldId: 'custentity_bb_fin_total_invoice_amount',
                        value: accountingCalc.getFinancierTotalInvoiceAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Financier Purchase Price Per Watt Amount
                        fieldId: 'custentity_bb_fin_pur_price_p_watt_amt',
                        value: accountingCalc.getFinancierPurchPricePerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Origination Amount Per Watt
                        fieldId: 'custentity_bb_fin_orig_per_watt_amt',
                        value: accountingCalc.getOriginationAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Origination Base Amount
                        fieldId: 'custentity_bb_fin_orig_base_amt',
                        value: accountingCalc.getOriginationBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    currentRecord.setValue ({ //Originator Price Per Watt Amount
                        fieldId: 'custentity_bb_originator_per_watt_amt',
                        value: accountingCalc.getOriginatorAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Amount
                        fieldId: 'custentity_bb_originator_base_amt',
                        value: accountingCalc.getOriginatorBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Amount
                        fieldId: 'custentity_bb_orgntr_payment_tot_amt',
                        value: accountingCalc.getOriginatorPaymentTotal(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Per Watt Amount
                        fieldId: 'custentity_bb_orgntr_pay_tot_p_w_amt',
                        value: accountingCalc.getOriginatorPaymentTotalPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    setOriginatorMilestones(currentRecord);
                    break;

                case 'custentity_bb_fin_m1_invoice_percent':
                    currentRecord.setValue ({ //Financier M1 Invoice Amount
                        fieldId: 'custentity_bb_fin_m1_invoice_amount',
                        value: accountingCalc.getFinancierM1InvoiceAmount(currentRecord, downPayment, downPaymentMilestoneName),
                        ignoreFieldChange: true
                    });
                    break;
                
                case 'custentity_bb_fin_m3_invoice_percent':
                    currentRecord.setValue ({ //Financier M3 Invoice Amount
                        fieldId: 'custentity_bb_fin_m3_invoice_amount',
                        value: accountingCalc.getFinancierM3InvoiceAmount(currentRecord, downPayment, downPaymentMilestoneName),
                        ignoreFieldChange: true
                    });
                    break;
                
                case 'custentity_bb_fin_m2_invoice_percent':
                    currentRecord.setValue ({ //Financier M2 Invoice Amount
                        fieldId: 'custentity_bb_fin_m2_invoice_amount',
                        value: accountingCalc.getFinancierM2InvoiceAmount(currentRecord, downPayment, downPaymentMilestoneName),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_fin_m0_invoice_percent':
                    currentRecord.setValue ({ //Financier M0 Invoice Amount
                        fieldId: 'custentity_bb_fin_m0_invoice_amount',
                        value: accountingCalc.getFinancierM0InvoiceAmount(currentRecord, downPayment, downPaymentMilestoneName),
                        ignoreFieldChange: true
                    });
                    break;
                
                case 'custentity_bb_fin_install_per_watt_amt':
                    currentRecord.setValue ({ //Installation Base Amount
                        fieldId: 'custentity_bb_fin_install_base_amt',
                        value: accountingCalc.getInstallationBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
                
                case 'custentity_bb_fin_monitoring_fee_amount':
                    currentRecord.setValue ({ //Financier Total Fees Amount
                        fieldId: 'custentity_bb_fin_total_fees_amount',
                        value: accountingCalc.getFinancierTotalFees(currentRecord),
                        ignoreFieldChange: true
                    });

                    currentRecord.setValue ({ //Financier Total Invoice Amount
                        fieldId: 'custentity_bb_fin_total_invoice_amount',
                        value: accountingCalc.getFinancierTotalInvoiceAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
               
                case 'custentity_bb_system_size_decimal':
                    currentRecord.setValue ({ //Installation Base Amount
                        fieldId: 'custentity_bb_fin_install_base_amt',
                        value: accountingCalc.getInstallationBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Financier Purchase Price Per Watt
                        fieldId: 'custentity_bb_fin_pur_price_p_watt_amt',
                        value: accountingCalc.getFinancierPurchPricePerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Origination Base Amount
                        fieldId: 'custentity_bb_fin_orig_base_amt',
                        value: accountingCalc.getOriginationBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Origination Amount / Watt
                        fieldId: 'custentity_bb_fin_orig_per_watt_amt',
                        value: accountingCalc.getOriginationAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    setTotalContractValue(currentRecord); //total contract value & copy

                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts

                    currentRecord.setValue ({ //Originator Price Per Watt Amount
                        fieldId: 'custentity_bb_originator_per_watt_amt',
                        value: accountingCalc.getOriginatorAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Amount
                        fieldId: 'custentity_bb_originator_base_amt',
                        value: accountingCalc.getOriginatorBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Amount
                        fieldId: 'custentity_bb_orgntr_payment_tot_amt',
                        value: accountingCalc.getOriginatorPaymentTotal(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Per Watt Amount
                        fieldId: 'custentity_bb_orgntr_pay_tot_p_w_amt',
                        value: accountingCalc.getOriginatorPaymentTotalPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Sub-contractor Amount
                        fieldId: 'custentity_bb_installer_amt',
                        value: accountingCalc.getInstallerSubContractorAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Total Payment Amount
                        fieldId: 'custentity_bb_installer_total_pay_amt',
                        value: accountingCalc.getInstallerTotalPayment(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Total Payment Per Watt Amount
                        fieldId: 'custentity_bb_install_total_payment_p_w',
                        value: accountingCalc.getInstallerTotalPaymentPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    setOriginatorMilestones(currentRecord);
                    setInstallerSCMilestones(currentRecord);
                    break;
                
                case 'custentity_bb_fin_orig_base_per_watt_amt':
                    currentRecord.setValue ({ //Origination Amount Per Watt
                        fieldId: 'custentity_bb_fin_orig_per_watt_amt',
                        value: accountingCalc.getOriginationAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Origination Base Amount
                        fieldId: 'custentity_bb_fin_orig_base_amt',
                        value: accountingCalc.getOriginationBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });

                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
                
                case 'custentity_bb_fin_owned_equip_costs_amt':
                    currentRecord.setValue ({ //Financer Total Invoice Amount
                        fieldId: 'custentity_bb_fin_total_invoice_amount',
                        value: accountingCalc.getFinancierTotalInvoiceAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
                
                case 'jobtype':
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;
                
                case 'custentity_bb_epc_role':
                    setTotalContractValue(currentRecord); //total contract value & copy
                    setFinancierMilestoneAmounts(currentRecord, downPayment, downPaymentMilestoneName); //Financier M0 - M3 Amounts
                    break;

                case 'custentity_bb_originator_base_p_watt_amt':
                    var originatorVendor = currentRecord.getValue('custentity_bb_originator_vendor');
                    if (!originatorVendor)
                        break;
                    currentRecord.setValue ({ //Originator Price Per Watt Amount
                        fieldId: 'custentity_bb_originator_per_watt_amt',
                        value: accountingCalc.getOriginatorAmountPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Amount
                        fieldId: 'custentity_bb_originator_base_amt',
                        value: accountingCalc.getOriginatorBaseAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Amount
                        fieldId: 'custentity_bb_orgntr_payment_tot_amt',
                        value: accountingCalc.getOriginatorPaymentTotal(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Payment Per Watt Amount
                        fieldId: 'custentity_bb_orgntr_pay_tot_p_w_amt',
                        value: accountingCalc.getOriginatorPaymentTotalPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    setOriginatorMilestones(currentRecord);
                    break;

                case 'custentity_bb_installer_m0_vbill_perc':
                    currentRecord.setValue ({ //Installer M0 Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_m0_vbill_amt',
                        value: accountingCalc.getInstallerSubContrM0VBillAmt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Sub-contractor Total Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_vbill_ttl_amt',
                        value: accountingCalc.getInstallerTotalVBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_installer_m1_vbill_perc':
                    currentRecord.setValue ({ //Installer M1 Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_m1_vbill_amt',
                        value: accountingCalc.getInstallerSubContrM1VBillAmt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Sub-contractor Total Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_vbill_ttl_amt',
                        value: accountingCalc.getInstallerTotalVBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_installer_m2_vbill_perc':
                    currentRecord.setValue ({ //Installer M2 Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_m2_vbill_amt',
                        value: accountingCalc.getInstallerSubContrM2VBillAmt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Sub-contractor Total Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_vbill_ttl_amt',
                        value: accountingCalc.getInstallerTotalVBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_installer_m3_vbill_perc':
                    currentRecord.setValue ({ //Installer M3 Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_m3_vbill_amt',
                        value: accountingCalc.getInstallerSubContrM3VBillAmt(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Sub-contractor Total Vendor Bill Amount
                        fieldId: 'custentity_bb_installer_vbill_ttl_amt',
                        value: accountingCalc.getInstallerTotalVBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_installer_price_p_w':
                    var installerVendor = currentRecord.getValue('custentity_bb_installer_partner_vendor');
                    if (!installerVendor)
                        break;
                    currentRecord.setValue ({ //Installer Sub-contractor Amount
                        fieldId: 'custentity_bb_installer_amt',
                        value: accountingCalc.getInstallerSubContractorAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Total Payment Amount
                        fieldId: 'custentity_bb_installer_total_pay_amt',
                        value: accountingCalc.getInstallerTotalPayment(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Installer Total Payment Per Watt Amount
                        fieldId: 'custentity_bb_install_total_payment_p_w',
                        value: accountingCalc.getInstallerTotalPaymentPerWatt(currentRecord),
                        ignoreFieldChange: true
                    });
                    setInstallerSCMilestones(currentRecord);
                    break;

                case 'custentity_bb_orgntr_m0_vbill_perc':
                    currentRecord.setValue ({ //Originator M0 Vendor Bill Amount
                        fieldId: 'custentity_bb_orgntr_m0_vbill_amt',
                        value: accountingCalc.getOriginatorM0VendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Vendor Bill Amount
                        fieldId: 'custentity_bb_orig_tot_vendor_bill_amt',
                        value: accountingCalc.getOriginatorTotalVendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_orgntr_m1_vbill_perc':
                    currentRecord.setValue ({ //Originator M1 Vendor Bill Amount
                        fieldId: 'custentity_bb_orgntr_m1_vbill_amt',
                        value: accountingCalc.getOriginatorM1VendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Vendor Bill Amount
                        fieldId: 'custentity_bb_orig_tot_vendor_bill_amt',
                        value: accountingCalc.getOriginatorTotalVendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_orgntr_m2_vbill_perc':
                    currentRecord.setValue ({ //Originator M2 Vendor Bill Amount
                        fieldId: 'custentity_bb_orgntr_m2_vbill_amt',
                        value: accountingCalc.getOriginatorM2VendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Vendor Bill Amount
                        fieldId: 'custentity_bb_orig_tot_vendor_bill_amt',
                        value: accountingCalc.getOriginatorTotalVendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;

                case 'custentity_bb_orgntr_m3_vbill_perc':
                    currentRecord.setValue ({ //Originator M3 Vendor Bill Amount
                        fieldId: 'custentity_bb_orgntr_m3_vbill_amt',
                        value: accountingCalc.getOriginatorM3VendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    currentRecord.setValue ({ //Originator Total Vendor Bill Amount
                        fieldId: 'custentity_bb_orig_tot_vendor_bill_amt',
                        value: accountingCalc.getOriginatorTotalVendorBillAmount(currentRecord),
                        ignoreFieldChange: true
                    });
                    break;
                case 'custentity_bb_originator_vendor':
                    var originatorVendor = currentRecord.getValue('custentity_bb_originator_vendor');
                    if (!originatorVendor)
                    {
                        currentRecord.setValue ({ //Originator per watt amount
                            fieldId: 'custentity_bb_originator_per_watt_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator base amount
                            fieldId: 'custentity_bb_originator_base_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator payment total
                            fieldId: 'custentity_bb_orgntr_payment_tot_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator payment schedule
                            fieldId: 'custentity_bb_sales_partner_pay_schedule',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator M0 Amount
                            fieldId: 'custentity_bb_orgntr_m0_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator M1 Amount
                            fieldId: 'custentity_bb_orgntr_m1_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator M2 Amount
                            fieldId: 'custentity_bb_orgntr_m2_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator M3 Amount
                            fieldId: 'custentity_bb_orgntr_m3_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Originator Payment Total Per Watt
                            fieldId: 'custentity_bb_orgntr_pay_tot_p_w_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                    }
                    break;
                case 'custentity_bb_installer_partner_vendor':
                    var installerVendor = currentRecord.getValue('custentity_bb_installer_partner_vendor');
                    if (!installerVendor)
                    {
                        currentRecord.setValue ({ //Installer Amount
                            fieldId: 'custentity_bb_installer_amt',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //installer total payment amount
                            fieldId: 'custentity_bb_installer_total_pay_amt',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //installer total payment per watt
                            fieldId: 'custentity_bb_install_total_payment_p_w',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //Installer Payment Schedule
                            fieldId: 'custentity_bb_install_part_pay_schedule',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //Installer Vendor Bill Total Amount
                            fieldId: 'custentity_bb_installer_vbill_ttl_amt',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //Installer M0 Vendor Bill Amount
                            fieldId: 'custentity_bb_installer_m0_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //Installer M1 vendor bill amount
                            fieldId: 'custentity_bb_installer_m1_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        }); 
                        currentRecord.setValue ({ //Installer M2 vendor bill amount
                            fieldId: 'custentity_bb_installer_m2_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                        currentRecord.setValue ({ //Installer M3 vendor bill amount
                            fieldId: 'custentity_bb_installer_m3_vbill_amt',
                            value: null,
                            ignoreFieldChange: true
                        });
                    }
                break;


            };

            if(_updateTrigger.hasOwnProperty(currentFieldId)){
                _updateTrigger[currentFieldId](currentRecord);
            }
        }
        catch (error) {
            var recordID = currentRecord.id;
            if (recordID == null) {recordID = 'new unsaved record'};
            log.error({
                title: 'Debug', 
                details: 'Current Field: ' + currentFieldId + ' Current Record ID: ' + recordID + 'Error:' + error
                });
        }
        
    	
    };

   

    /**
     * Sets M0 - M3 Amount Fields
     * @param record - current NS Project record
     * @returns - void
     */
    function setFinancierMilestoneAmounts(record, downPayment, downPaymentMilestoneName) {


        record.setValue ({ //Financier M0 Invoice Amount
    		fieldId: 'custentity_bb_fin_m0_invoice_amount',
    		value: accountingCalc.getFinancierM0InvoiceAmount(record, downPayment, downPaymentMilestoneName),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Financier M1 Invoice Amount
    		fieldId: 'custentity_bb_fin_m1_invoice_amount',
    		value: accountingCalc.getFinancierM1InvoiceAmount(record, downPayment, downPaymentMilestoneName),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Financier M2 Invoice Amount
    		fieldId: 'custentity_bb_fin_m2_invoice_amount',
    		value: accountingCalc.getFinancierM2InvoiceAmount(record, downPayment, downPaymentMilestoneName),
    		ignoreFieldChange: true
    	});
        
        record.setValue ({ //Financier M3 Invoice Amount
    		fieldId: 'custentity_bb_fin_m3_invoice_amount',
    		value: accountingCalc.getFinancierM3InvoiceAmount(record, downPayment, downPaymentMilestoneName),
    		ignoreFieldChange: true
        });
        

    };
    
    

    /**
     * Sets Total Contract Value field & copy field
     * 
     * @param record - current NS project record
     * @returns - void
     */
    function setTotalContractValue(record) {
        var totalContractValue = accountingCalc.getTotalContractValue(record);

        record.setValue ({
            fieldId: 'custentity_bb_total_contract_value_amt',
            value: totalContractValue,
            ignoreFieldChange: true
        });

        record.setValue ({
            fieldId: 'custentity_bb_tot_contract_value_cpy_amt',
            value: totalContractValue,
            ignoreFieldChange: true
        });
    };


    /**
     * Sets Origination Milestone Amounts and total Fields
     * 
     * @param record - current NS Project record
     * @returns - void
     */
    function setOriginatorMilestones(record)
    {
        record.setValue ({ //Originator M0 Vendor Bill Amount
    		fieldId: 'custentity_bb_orgntr_m0_vbill_amt',
    		value: accountingCalc.getOriginatorM0VendorBillAmount(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Originator M1 Vendor Bill Amount
    		fieldId: 'custentity_bb_orgntr_m1_vbill_amt',
    		value: accountingCalc.getOriginatorM1VendorBillAmount(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Originator M2 Vendor Bill Amount
    		fieldId: 'custentity_bb_orgntr_m2_vbill_amt',
    		value: accountingCalc.getOriginatorM2VendorBillAmount(record),
    		ignoreFieldChange: true
    	});
        
        record.setValue ({ //Originator M3 Vendor Bill Amount
    		fieldId: 'custentity_bb_orgntr_m3_vbill_amt',
    		value: accountingCalc.getOriginatorM3VendorBillAmount(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Originator Total Vendor Bill Amount
    		fieldId: 'custentity_bb_orig_tot_vendor_bill_amt',
    		value: accountingCalc.getOriginatorTotalVendorBillAmount(record),
    		ignoreFieldChange: true
        });

    };




        /**
     * Sets Installer Sub-contractor Milestone Amounts and total Fields
     * 
     * @param record - current NS Project record
     * @returns - void
     */
    function setInstallerSCMilestones(record)
    {
        record.setValue ({ //Installer Sub-contractor M0 Vendor Bill Amount
    		fieldId: 'custentity_bb_installer_m0_vbill_amt',
    		value: accountingCalc.getInstallerSubContrM0VBillAmt(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Installer Sub-contractor M1 Vendor Bill Amount
    		fieldId: 'custentity_bb_installer_m1_vbill_amt',
    		value: accountingCalc.getInstallerSubContrM1VBillAmt(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Installer Sub-contractor M2 Vendor Bill Amount
    		fieldId: 'custentity_bb_installer_m2_vbill_amt',
    		value: accountingCalc.getInstallerSubContrM2VBillAmt(record),
    		ignoreFieldChange: true
    	});
        
        record.setValue ({ //Installer Sub-contractor M3 Vendor Bill Amount
    		fieldId: 'custentity_bb_installer_m3_vbill_amt',
    		value: accountingCalc.getInstallerSubContrM3VBillAmt(record),
    		ignoreFieldChange: true
        });

        record.setValue ({ //Installer Sub-contractor Total Vendor Bill Amount
    		fieldId: 'custentity_bb_installer_vbill_ttl_amt',
    		value: accountingCalc.getInstallerTotalVBillAmount(record),
    		ignoreFieldChange: true
        });

    };


    function pageInit(context){
        if(context.mode == 'edit'){
            jQuery('.payment-memo, .contract-value-history, #custentity_bb_contract_value_hist_html_val > table').prevAll('br').remove();
        }
    }


    return {
    	fieldChanged: fieldChanged,
        pageInit: pageInit
    };

    
});