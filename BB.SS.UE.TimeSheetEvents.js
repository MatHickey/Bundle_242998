/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Weekly timesheet overall time calculations - get values from sublist and set totals per regular, overtime and double time
 */
define(['N/record', 'N/search'],

function(record, search) {
   

    function afterSubmit(scriptContext) {
        var recordId = scriptContext.newRecord.id;
        var timeSheet = record.load({
            type: record.Type.TIME_SHEET,
            id: recordId,
        });

        var lineCount = timeSheet.getLineCount({
            sublistId: 'timeitem'
        });
        log.debug('time sheet line count',lineCount);


        var otherPay = parseFloat(0.00);

        var hours0 = parseFloat(0.00);
        var hours1 = parseFloat(0.00);
        var hours2 = parseFloat(0.00);
        var hours3 = parseFloat(0.00);
        var hours4 = parseFloat(0.00);
        var hours5 = parseFloat(0.00);
        var hours6 = parseFloat(0.00);

        // sunday - saturday days per week
        var daysOfWeek = ['hours0', 'hours1', 'hours2', 'hours3', 'hours4', 'hours5', 'hours6'];

        if (lineCount > 0) {
            for (var t = 0; t < lineCount; t++) {
                var timeItem = timeSheet.getSublistValue({
                    sublistId: 'timeitem',
                    fieldId: 'item',
                    line: t
                });

                for (var i = 0; i < daysOfWeek.length; i++) {

                    var amount = timeSheet.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: daysOfWeek[i],
                        line: t
                    });

                    var fieldId = String(daysOfWeek[i]);

                    if (amount) {
                        var availableOT = evaluateTimeItem(timeItem);
                        if (availableOT) {

                            if (fieldId == 'hours0') {
                                hours0 = hours0 + amount;
                            } else if (fieldId == 'hours1') {
                                hours1 = hours1 + amount;
                            } else if (fieldId == 'hours2') {
                                hours2 = hours2 + amount;
                            } else if (fieldId == 'hours3') {
                                hours3 = hours3 + amount;
                            } else if (fieldId == 'hours4') {
                                hours4 = hours4 + amount;
                            } else if (fieldId == 'hours5') {
                                hours5 = hours5 + amount;
                            } else if (fieldId == 'hours6') {
                                hours6 = hours6 + amount;
                            } else {
                                // do nothing
                            }                      

                        } else { // non approved item for overtime = PTO, sick and vacation items
                            otherPay = otherPay + amount;
                        }

                    } else {
                        if (amount) {
                            otherPay = otherPay + amount;
                        }
                    }
                }
            }// end of line loop
            var weekDayTotals = [hours0, hours1, hours2, hours3, hours4, hours5, hours6];
            var time = calculateHours(weekDayTotals);

            if (otherPay > 0 && time.regtime) {
                time.regtime + otherPay;
            }
        }

        if (time.regtime) {
            log.debug('regular time total', time.regtime);
            var regtotal = time.regtime + otherPay;

            timeSheet.setValue({
                fieldId: 'custrecord_bb_total_reg_hrs_dec',
                value: regtotal
            }); 
        }
        if (time.ot1) {
            log.debug('ot1 total', time.ot1);
            timeSheet.setValue({
                fieldId: 'custrecord_bb_ot1_total_hrs_dec',
                value: parseFloat(time.ot1)
            });
        }
        if (time.ot2) {
            log.debug('ot2 total', time.ot2);
            timeSheet.setValue({
                fieldId: 'custrecord_bb_ot2_total_hrs_dec',
                value: parseFloat(time.ot2)
            });
        }
        if (time.totalHrs) {
            timeSheet.setValue({
                fieldId: 'custrecord_bb_total_hours_dec',
                value: parseFloat(time.totalHrs)
            });
        }


        var table = setHTMLTable(timeSheet, regtotal, time.ot1, time.ot2, time.totalHrs);

        timeSheet.setValue({
            fieldId: 'custrecord_bb_hour_summary_html',
            value: table
        });

        timeSheet.save({
            ignoreMandatoryFields: true
        });
    }

    function setHTMLTable(timeSheet, regtime, ot1, ot2, totalHrs) {
        var htmlTable = '<table cellspacing="5">';
        htmlTable +='    <tr>';
        htmlTable +='         <th style="font-weight: bold; text-align: left;">Regular</th>';
        htmlTable +='         <th style="font-weight: bold; text-align: right;">OT-1</th>';
        htmlTable +='         <th style="font-weight: bold; text-align: right;">OT-2</th>';
        htmlTable +='         <th style="font-weight: bold; text-align: right;">Total</th>';
        htmlTable +='    </tr>';
        htmlTable +='    <tr>';
        htmlTable +='         <td><div style="width: 75px">' + regtime.toFixed(2) +'</div></td>';
        htmlTable +='         <td align="right"><div style="width: 75px">' + ot1.toFixed(2) + '</div></td>';
        htmlTable +='         <td align="right"><div style="width: 75px">' + ot2.toFixed(2) + '</div></td>';
        htmlTable +='         <td align="right"><div style="width: 75px">' + totalHrs.toFixed(2) + '</div></td>';
        htmlTable +='    </tr>';
        htmlTable +=' </table>';
       

        return htmlTable;
    }
    // Remove hard coded item id values and add time sheet PTO and vacation items to BBSS config
    function evaluateTimeItem(item) {
        if (item != 1034 || item != 1035 || item != 1036) {
            // over time allowed
            return true;
        } else {
            // pay standard time
            return false;
        }
    }

    function calculateHours(weekDayTotals) {
        var regtime = parseFloat(0.00);
        var ot1 = parseFloat(0.00);
        var ot2 = parseFloat(0.00);

        if (weekDayTotals.length > 0) {
            for (var i = 0; i < weekDayTotals.length; i++) {
                var overage1 = parseFloat(0.00);
                var overage2 = parseFloat(0.00);

                var amount = weekDayTotals[i];
                if (amount > 0) {

                    // pay standard time
                    if (amount <= 8 && regtime < 40) { 
                        //check if amount takes regular time over 40 hrs
                        if ((amount + regtime) > 40) {
                            var overage1 = (regtime + amount) - 40;
                            regtime = 40;
                            ot1 = ot1 + overage1;
                        } else {
                            regtime = amount + regtime;
                        }

                    } else if (amount > 8 && amount <= 12) { // ot1 pay
                        //check if ot1 amount takes regular time over 40 hours
                        if (regtime < 40) { // example 30 hrs

                            var preCalc1 = amount - 8; // overage example 11 - 8 = 3
                            var regCalc1 = amount - preCalc1; // example 11 - 3 = 8

                            if ((regCalc1 + regtime) > 40) { // if 8 + regular time > 40 -- example 8 + 35 (43) > 40

                                var preCalc2 = regCalc1 + regtime - 40;
                                ot1 = ot1 + preCalc2;
                                regtime = 40;

                            } else { 

                                regtime = regtime + regCalc1;
                                ot1 = ot1 + preCalc1;

                            }

                        } else {
                            //place amount directly to ot1 regular time is over 40 hrs
                            ot1 = amount + ot1;
                        }

                    } else if (amount > 12) {

                        if (regtime > 40) {
                            ot1 = ot1 + 8;
                            ot2 = ot2 + (amount - 12);

                        } else {
                            // check if line amount takes regular time over 40 hrs
                            var ot2Calc = amount - 12;
                            var ot1Calc = amount - ot2Calc;
                            var regCalc = amount - ot1Calc;
                            if ((regCalc + regtime) > 40) {
                                overage2 = amount - 12;
                                overage1 = 40 - regtime;
                                ot1 = ot1 + overage1;
                                ot2 = ot2 + overage2;
                                regtime = 40;
                            } else {
                                regtime = regtime + 8;
                                ot1 = ot1 + 4 
                                overage2 = amount - 12;
                                ot2 = ot2 + overage2;
                            }

                        }

                    } else { 
                        // amount is 8 hrs or less with more than 40 hours
                        ot1 = ot1 + amount;
                    }

                }// end of amount check

            }// end of loop

        }// end of array check
        var totalHrs = regtime + ot1 + ot2;
        return {
            regtime: regtime,
            ot1: ot1,
            ot2: ot2,
            totalHrs: totalHrs
        };
    }


    return {
        afterSubmit: afterSubmit
    };
    
});
