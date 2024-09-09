/**
 * Data Processor plugin implementation for KW/Month invoicing
 * @NApiVersion 2.x
 * @NScriptType plugintypeimpl
 */
define(['N/search', 'N/record', './BB SS/SS Lib/BB.MD.AlsoEnergy.Auto.Invoice.js', './BB SS/SS Lib/moment.min', 'N/format'], function (search, record, autoInvoice, moment, format) {
    'use strict';
    var FIXED = 1;
    var SEASONAL = 2;
    var SEASONAL_WITH_TIME = 3;
    var UNIT_WATT=1;
    var UNIT_KWH=2;
    var ENERGY_UNITS = {1: 'kwh', 2: 'w'};

    function convertInDesiredUnits(sourceUnit, DesiredUnit, sourceEnergyproduced) {
        for (var key in ENERGY_UNITS) {
            if (sourceUnit.toLowerCase() == ENERGY_UNITS[key]) {
                sourceUnit = key;
            }
            if (sourceUnit == UNIT_KWH && DesiredUnit == UNIT_WATT) {
                return sourceEnergyproduced / 1000;
            } else if (sourceUnit == UNIT_WATT && DesiredUnit == UNIT_KWH) {
                return sourceEnergyproduced * 1000;
            }

        }

    }

    return {

        createInvoice: function (projectData) {
            log.debug('in create invoice::', projectData);
            var startDate = new Date(moment(projectData.periodEndDate).subtract(1, 'months').add(1, 'days'));
            var endDate = new Date(projectData.periodEndDate);
            var projectId = projectData.project;
            var customerIds = projectData.customer;
            var meterIdString = '';

            //loop through offtakte customes and create invoice vor each
            for (var x = 0; x < customerIds.length; x++) {
                //check for existing invoices
                if (autoInvoice.existingInvoice(endDate, projectId, customerIds[x].customer)) {
                    log.debug('Invoice Creation Error',
                        'An invoice for this end date, project, and customer already exists. End Date: '
                        + endDate + ', Project: ' + projectId, ', Customer: ' + customerIds[x]);
                    continue;
                }

                var invoice = record.create({
                    type: record.Type.INVOICE,
                    isDynamic: true
                });

                invoice.setValue({fieldId: 'entity', value: customerIds[x].customer});
                invoice.setValue({fieldId: 'trandate', value: endDate});
                invoice.setValue({fieldId: 'subsidiary', value: projectData.subsidiary});
                invoice.setValue({fieldId: 'custbody_bb_project', value: projectId});

                invoice.setValue({fieldId: 'custbody_bb_inv_period_start_date', value: startDate});
                invoice.setValue({fieldId: 'custbody_bb_inv_period_end_date', value: endDate});
                //invoice.setValue({ fieldId: 'custbody_c2_phase', value: 1 });
                invoice.setValue({
                    fieldId: 'custbody_bb_customer_utility_accnt_num',
                    value: customerIds[x].accountNumber
                });
                invoice.setValue({fieldId: 'custbody_custmr_offtkr_percent', value: customerIds[x].monthlyPercentage});


                var scheduleRate = 0;
                var fixedMonthly = 0;
                var unitOfmeasureForInv = '';
                for (var line in projectData.lines) {
                    log.debug('line',line);
                    log.debug('projectData.lines.hasOwnProperty(line)',projectData.lines.hasOwnProperty(line));
                    log.debug('!projectData.lines.hasOwnProperty(line)',!projectData.lines.hasOwnProperty(line));

                    if (!projectData.lines.hasOwnProperty(line)) {
                        log.debug('IN IF','IN IF');

                        continue;
                    }
                    log.debug('OUT IF','OUT IF');

                    if (projectData.rateType == FIXED) {
                        log.debug('in fixed')
                        for (var partRate in projectData.schedulePartitions) {
                            scheduleRate = projectData.schedulePartitions[partRate].scheduleRate
                            unitOfmeasureForInv = projectData.schedulePartitions[partRate].energyUnit
                        }
                        var energyProducedInDesiredUnits = convertInDesiredUnits(projectData.lines[line].unit, unitOfmeasureForInv, projectData.lines[line].energyProduced)
                        log.debug('energyProducedInDesiredUnits', energyProducedInDesiredUnits);
                        invoice.selectNewLine({sublistId: 'item'});
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: projectData.lines[line].itemId,
                            ignoreFieldChange: true
                        });

                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_ss_site_id_in_inv',
                            value: projectData.lines[line].site,
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: parseFloat(energyProducedInDesiredUnits).toFixed(3),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_energy_prd_date_for_inv',
                            value: format.parse({value: projectData.lines[line].startDate, type: format.Type.DATE}),
                            ignoreFieldChange: true
                        });

                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_total_energy_consumed',
                            value: parseFloat(energyProducedInDesiredUnits),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_rate_without_prcnt_offtake',
                            value: parseFloat(scheduleRate),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: parseFloat(scheduleRate) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: (parseFloat(energyProducedInDesiredUnits) * parseFloat(scheduleRate)) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'description',
                            value: 'Per Kwh - Fixed',
                            ignoreFieldChange: true
                        });
                        invoice.commitLine({sublistId: 'item'});
                    } else if (projectData.rateType == SEASONAL) {
                        log.debug('in Seasonal',projectData)
                        var energyProdStartDate = new Date(projectData.lines[line].startDate)

                        invoice.selectNewLine({sublistId: 'item'});
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: projectData.lines[line].itemId,
                            ignoreFieldChange: true
                        });


                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_energy_prd_date_for_inv',
                            value: format.parse({value: projectData.lines[line].startDate, type: format.Type.DATE}),
                            ignoreFieldChange: true
                        });

                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_total_energy_consumed',
                            value: energyProducedInDesiredUnits.toFixed(3),
                            ignoreFieldChange: true
                        });


                        findSchedule:
                            for (var partRate in projectData.schedulePartitions) {
                                var scheduleParts = partRate.split('?');
                                var ScheduleStartDate = new Date(scheduleParts[0]);
                                var ScheduleEndDate = new Date(scheduleParts[1]);
                                if (energyProdStartDate >= ScheduleStartDate && energyProdStartDate <= ScheduleEndDate) {
                                    scheduleRate = projectData.schedulePartitions[partRate].scheduleRate
                                    unitOfmeasureForInv = projectData.schedulePartitions[partRate].energyUnit
                                    break findSchedule;
                                }
                            }
                        var energyProducedInDesiredUnits = convertInDesiredUnits(projectData.lines[line].unit, unitOfmeasureForInv, projectData.lines[line].energyProduced)
                        log.debug('energyProducedInDesiredUnits',energyProducedInDesiredUnits);
                        log.debug('scheduleRate', scheduleRate);


                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: parseFloat(energyProducedInDesiredUnits).toFixed(3),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_rate_without_prcnt_offtake',
                            value: scheduleRate,
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: parseFloat(scheduleRate) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            value: (parseFloat(energyProducedInDesiredUnits * scheduleRate)) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
                            ignoreFieldChange: true
                        });
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'description',
                            value: 'Per Kwh - Seasonal',
                            ignoreFieldChange: true
                        });
                        invoice.commitLine({sublistId: 'item'});
                    } else if (projectData.rateType == SEASONAL_WITH_TIME) {
                        log.debug('in Seasonal with time')
                        var energyProdDetailsRecs = projectData.lines[line].energyProdDetails
                        var energyProdAmount = 0;
                        var scheduleRateGroups = {};
                        for (var prodNum = 0; prodNum < energyProdDetailsRecs.length; prodNum++) {

                            var rateForSch = 0;
                            var rateForSchWithoutPercentOfftake = 0;
                            var matchedScheduleDesciption;
                            var energyProd = energyProdDetailsRecs[prodNum];
                            var energyProdStartDate = energyProd.Date;
                            var energyProdTime = moment(energyProd.Time, ["h:mm A"]).format("HH:mm");
                            var energyProdStartDateTime = new Date(energyProdStartDate);


                            findSchedule:
                                for (var partRate in projectData.schedulePartitions) {
                                    var scheduleParts = partRate.split('?');
                                    var ScheduleStartDate = scheduleParts[0];
                                    var ScheduleEndDate = scheduleParts[1];
                                    var ScheduleStartTime = moment(scheduleParts[2], ["h:mm A"]).format("HH:mm");
                                    var ScheduleEndTime = moment(scheduleParts[3], ["h:mm A"]).format("HH:mm");
                                    var scheduleStartDateTime = new Date(ScheduleStartDate);
                                    var scheduleEndDateTime = new Date(ScheduleEndDate);


                                    if (energyProdStartDateTime >= scheduleStartDateTime && energyProdStartDateTime <= scheduleEndDateTime && energyProdTime >= ScheduleStartTime && energyProdTime <= ScheduleEndTime) {

                                        rateForSchWithoutPercentOfftake = projectData.schedulePartitions[partRate].scheduleRate;
                                        log.debug('in matched for seasonal time of day rateForSch', rateForSchWithoutPercentOfftake);
                                        rateForSch = parseFloat(rateForSchWithoutPercentOfftake) * (parseFloat(customerIds[x].monthlyPercentage) / 100);
                                        matchedScheduleDesciption = 'Scheduled applied:' + ScheduleStartDate + ' To ' + ScheduleEndDate + ' at ' + rateForSchWithoutPercentOfftake + ' Without Customer offtake percent';
                                        unitOfmeasureForInv = projectData.schedulePartitions[partRate].energyUnit
                                        break findSchedule;
                                    }
                                }
                            if (!scheduleRateGroups[rateForSch]) {
                                var energyProducedInDesiredUnits = convertInDesiredUnits(projectData.lines[line].unit, unitOfmeasureForInv, energyProd.energyproduced)
                                scheduleRateGroups[rateForSch] = {
                                    energyProd: parseFloat(energyProducedInDesiredUnits),
                                    energyProdAmount: (parseFloat(energyProducedInDesiredUnits) * parseFloat(rateForSch)),
                                    matchedScheduleDesciption: matchedScheduleDesciption,
                                    rateForSchWithoutPercentOfftake: rateForSchWithoutPercentOfftake,
                                    unitForInv:energyProd.energyUnit

                                }
                            } else {
                                var rateObj = scheduleRateGroups[rateForSch];
                                var energyProducedInDesiredUnits = convertInDesiredUnits(projectData.lines[line].unit, unitOfmeasureForInv, energyProd.energyproduced)
                                rateObj.energyProd = rateObj.energyProd + parseFloat(energyProducedInDesiredUnits);
                                rateObj.energyProdAmount = parseFloat(rateObj.energyProdAmount) + (parseFloat(energyProducedInDesiredUnits) * parseFloat(rateForSch));
                                rateObj.matchedScheduleDesciption = matchedScheduleDesciption;
                                rateObj.rateForSchWithoutPercentOfftake = rateForSchWithoutPercentOfftake;
                                rateObj.unitForInv=energyProd.energyUnit
                                scheduleRateGroups[rateForSch] = rateObj;
                            }

                            //   energyProdAmount = energyProdAmount + (parseFloat(energyProd.energyproduced) * parseFloat(rateForSch));
                        }

                        log.debug('scheduleRateGroups', scheduleRateGroups);
                       
                        for (var schduleRateLine in scheduleRateGroups) {
                            log.debug('inside schduleRateLine', schduleRateLine);
                            log.debug('inside projectData.lines[line].itemId', projectData.lines[line].itemId);
                            invoice.selectNewLine({sublistId: 'item'});
                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                value: projectData.lines[line].itemId,
                                ignoreFieldChange: true
                            });

                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                value: 1,
                                ignoreFieldChange: true
                            });
                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_bb_energy_prd_date_for_inv',
                                value: format.parse({value: projectData.lines[line].startDate, type: format.Type.DATE}),
                                ignoreFieldChange: true
                            });

                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_bb_total_energy_consumed',
                                value: scheduleRateGroups[schduleRateLine].energyProd,
                                ignoreFieldChange: true
                            });
                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_bb_rate_without_prcnt_offtake',
                                value: scheduleRateGroups[schduleRateLine].rateForSchWithoutPercentOfftake,
                                ignoreFieldChange: true
                            });
                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                value: schduleRateLine,
                                ignoreFieldChange: true
                            });

                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'amount',
                                value: scheduleRateGroups[schduleRateLine].energyProdAmount,
                                ignoreFieldChange: true
                            });
                            invoice.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'description',
                                value: 'Per Kwh - Seasonal Time of Day( ' + scheduleRateGroups[schduleRateLine].matchedScheduleDesciption + ' )',
                                ignoreFieldChange: true
                            });
                            invoice.commitLine({sublistId: 'item'});

                        }


                    }
                    record.submitFields({
                        type: 'customrecord_bb_proj_energy_production',
                        id: line,
                        values: {
                            'custrecord_processed_for_invoice': true
                        }
                    });

                }
                ;

                //invoice.setValue({ fieldId: 'custbody_bb_meter_numbers', value: meterIdString });
                var invoiceID = invoice.save({ignoreMandatoryFields: true});
                log.debug('Create Invoice', 'Invoice ID: ' + invoiceID);
            }


            return invoiceID;
        },
        getRates: function (endDate, project) {

            log.debug('project in pwk', project);
            var ratesDetails = {}
            var schedulePartitions = {}
            var customrecord_bb_energy_rate_scheduleSearchObj = search.create({
                type: "customrecord_bb_energy_rate_schedule",
                filters:
                    [
                        ["custrecord_bb_proj_en_rate_project", "anyof", project]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "custrecord_schedule_monthly_rate",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Monthly Rate"
                        }),
                        search.createColumn({
                            name: "custrecord_schdl_end_date",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Schedule End Date"
                        }),
                        search.createColumn({
                            name: "custrecord_schdl_end_time_of_day",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Schedule End Time"
                        }),
                        search.createColumn({
                            name: "custrecord_schedule_rate",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Schedule Rate"
                        }),
                        search.createColumn({
                            name: "custrecordschdl_start_date",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Schedule Start Date"
                        }),
                        search.createColumn({
                            name: "custrecord_schdl_start_time_of_day",
                            join: "CUSTRECORD_LINKD_ENERGY_RT_SCHL",
                            label: "Schedule Start Time"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_energy_rate_sched_type",
                            label: "ENERGY RATE SCHEDULE TYPE"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_energy_unit",
                            label: "ENERGY UNIT"
                        })
                    ]
            });
            var searchResultCount = customrecord_bb_energy_rate_scheduleSearchObj.runPaged().count;
            log.debug("customrecord_bb_energy_rate_scheduleSearchObj result count", searchResultCount);

            customrecord_bb_energy_rate_scheduleSearchObj.run().each(function (result) {

                ratesDetails.rateType = result.getValue({
                    name: 'custrecord_bb_energy_rate_sched_type',
                });
                var monthlyrate = result.getValue({
                    name: 'custrecord_schedule_monthly_rate',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var scheduleEndDate = result.getValue({
                    name: 'custrecord_schdl_end_date',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var scheduleStartDate = result.getValue({
                    name: 'custrecordschdl_start_date',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var scheduleEndTime = result.getValue({
                    name: 'custrecord_schdl_end_time_of_day',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var scheduleStartTime = result.getValue({
                    name: 'custrecord_schdl_start_time_of_day',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var scheduleRate = result.getValue({
                    name: 'custrecord_schedule_rate',
                    join: 'CUSTRECORD_LINKD_ENERGY_RT_SCHL'
                });
                var energyUnit = result.getValue({
                    name: 'custrecord_bb_energy_unit'
                });
                var scheduleKey = scheduleStartDate + '?' + scheduleEndDate + '?' + scheduleStartTime + '?' + scheduleEndTime + '?';
                schedulePartitions[scheduleKey] = {
                    monthlyrate: monthlyrate,
                    scheduleRate: scheduleRate,
                    energyUnit: energyUnit
                }

                return true;


            });
            ratesDetails.schedulePartitions = schedulePartitions;
            log.debug('ratesDetails', ratesDetails);
            return ratesDetails;
        },
        createMeterReading: function (projectData) {
            return autoInvoice.createMeterReading(projectData);
        },
        getOfftaker: function (project) {
            return autoInvoice.getOfftaker(project);
        }

    };
});