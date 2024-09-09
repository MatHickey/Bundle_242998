/**
 * Data Processor plugin implementation for KW/Month invoicing
 * @NApiVersion 2.x
 * @NScriptType plugintypeimpl
 */
define(['N/search', 'N/record', './BB SS/SS Lib/moment.min', './BB SS/SS Lib/BB.MD.AlsoEnergy.Auto.Invoice.js'], function (search, record, moment, autoInvoice) {
	'use strict';
	var FIXED = 1;
	var SEASONAL = 2;
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

				invoice.setValue({ fieldId: 'entity', value: customerIds[x].customer });
				invoice.setValue({ fieldId: 'trandate', value: endDate });
				invoice.setValue({ fieldId: 'subsidiary', value: projectData.subsidiary });
				invoice.setValue({ fieldId: 'custbody_bb_project', value: projectId });
				
				invoice.setValue({ fieldId: 'custbody_bb_inv_period_start_date', value: startDate });
				invoice.setValue({ fieldId: 'custbody_bb_inv_period_end_date', value: endDate });
				//invoice.setValue({ fieldId: 'custbody_c2_phase', value: 1 });
				invoice.setValue({ fieldId: 'custbody_bb_customer_utility_accnt_num', value: customerIds[x].accountNumber });

				var fixedMonthly = 0;
				for (var line in projectData.lines) {
					if (!projectData.lines.hasOwnProperty(line)) {
						continue;
					}
					invoice.selectNewLine({ sublistId: 'item' });
					invoice.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'item',
						value: projectData.lines[line].itemId,
						ignoreFieldChange: true
					});
					invoice.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'description',
						value: 'Flat Fee',
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
						fieldId: 'location',
						value: projectData.lines[line].location,
						ignoreFieldChange: true
					});
					invoice.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_bb_total_energy_consumed',
						value: projectData.lines[line].kwhProd,
						ignoreFieldChange: true
					});
					invoice.setCurrentSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_bb_percentage_offtake',
						value: parseFloat(customerIds[x].monthlyPercentage),
						ignoreFieldChange: true
					});

					if (projectData.rateType == FIXED) {
						log.debug('in fixed')
						for (var partRate in projectData.schedulePartitions) {
							fixedMonthly = projectData.schedulePartitions[partRate].monthlyrate
						}
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'rate',
							value: fixedMonthly,
							ignoreFieldChange: true
						});
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'amount',
							value: (fixedMonthly) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
							ignoreFieldChange: true
						});
					} else if (projectData.rateType == SEASONAL) {
						log.debug('in Seasonal')
						var energyProdStartDate = projectData.lines[line].startDate
						var energyProdEndtDate = projectData.lines[line].endDate

						for (var partRate in projectData.schedulePartitions) {
							var scheduleParts = partRate.split('?');
							var ScheduleStartDate = scheduleParts[0];
							var ScheduleEndDate = scheduleParts[1];
							log.debug('energyProdStartDate',energyProdStartDate);
							log.debug('ScheduleStartDate',ScheduleStartDate);
							log.debug('energyProdEndtDate',energyProdEndtDate);
							log.debug('ScheduleEndDate',ScheduleEndDate);
							log.debug('energyProdStartDate >= ScheduleStartDate',energyProdStartDate >= ScheduleStartDate);
							log.debug('energyProdEndtDate <= ScheduleEndDate',energyProdEndtDate <= ScheduleEndDate);
							if (energyProdStartDate >= ScheduleStartDate && energyProdEndtDate <= ScheduleEndDate) {
								log.debug('in matched if')
								fixedMonthly = projectData.schedulePartitions[partRate].monthlyrate
							}
							invoice.setCurrentSublistValue({
								sublistId: 'item',
								fieldId: 'rate',
								value: fixedMonthly,
								ignoreFieldChange: true
							});
							invoice.setCurrentSublistValue({
								sublistId: 'item',
								fieldId: 'amount',
								value: (fixedMonthly) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
								ignoreFieldChange: true
							});
						}

						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'rate',
							value: fixedMonthly,
							ignoreFieldChange: true
						});
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'amount',
							value: (fixedMonthly) * (parseFloat(customerIds[x].monthlyPercentage) / 100),
							ignoreFieldChange: true
						});
					}


					/*	invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'custcol_bb_starting_kwh_value',
							value: projectData.lines[line].startingMeterReading,
							ignoreFieldChange: true
						});
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'custcol_bb_ending_kwh_value',
							value: projectData.lines[line].endingMeterReading,
							ignoreFieldChange: true
						});
						
						
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'custcol_bb_meter_id',
							value: projectData.lines[line].nsMeterId,
							ignoreFieldChange: true
						});
						invoice.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: 'custcol_bb_utility_account_number',
							value: projectData.lines[line].utilityMeterId,
							ignoreFieldChange: true
						});*/

					invoice.commitLine({ sublistId: 'item' });

				//	var utilityMeterId = projectData.lines[line].utilityMeterId;
				//	meterIdString = (meterIdString.length > 0) ? meterIdString + ', ' + utilityMeterId : utilityMeterId;
				};

				//invoice.setValue({ fieldId: 'custbody_bb_meter_numbers', value: meterIdString });
				var invoiceID = invoice.save({ ignoreMandatoryFields: true });
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
				var scheduleKey = scheduleStartDate + '?' + scheduleEndDate + '?' + scheduleStartTime + '?' + scheduleEndTime + '?';
				schedulePartitions[scheduleKey] = {
					monthlyrate: monthlyrate,
					scheduleRate: scheduleRate
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