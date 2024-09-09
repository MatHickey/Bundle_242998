/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Create Calendar Event.
 */
define(['N/record', 'N/search', 'N/runtime'],

    function(record, search, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(scriptContext) {
            // try {
                //get parameters from WF
                var differenceInDays = 0;
                var assignedTo = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_assigned_to'});
                var company = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_company'});
                var sDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_start_date'});
                var startTime = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_start_time'});
                var endTime = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_end_time'});
                var title = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_title'});
                var seriesStartDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_series_start_date'});
                var endBy = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_end_by_date'});
                var eDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_end_date'});
                var frequency = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_frequency'});
                log.debug('frequency', frequency);
                if (sDate && eDate) {
                    differenceInDays = getNumberOfDays(sDate, eDate);
                }
                if (differenceInDays > 0) {
                    // create first event
                    createCalendarEvent(assignedTo, company, title, sDate, sDate, startTime, endTime)
                    for (var d = 0; d < differenceInDays; d++) {
                        var startDate = new Date(sDate);
                        var tomorrow = startDate;
                        tomorrow.setDate(startDate.getDate()+d+1);
                        log.debug('tomorrow', tomorrow);
                        createCalendarEvent(assignedTo, company, title, tomorrow, tomorrow, startTime, endTime);
                    }
                }
                return scriptContext.newRecord;
            // } catch (e) {
            //     log.error('error generating calendar event', e);
            // }
        }

        function createCalendarEvent(assignedTo, company, title, startDate, endDate, startTime, endTime) {
            if (assignedTo && company && title && startDate && endDate) {
                var event = record.create({
                    type: record.Type.CALENDAR_EVENT,
                    isDynamic: true
                });
                event.setValue({
                    fieldId: 'title',
                    value: title
                });
                if (startDate) {
                    event.setValue({
                        fieldId: 'startdate',
                        value: startDate
                    });
                }
                if (endDate) {
                    event.setValue({
                        fieldId: 'enddate',
                        value: endDate
                    });
                }
                if (startTime) {

                    event.setValue({
                        fieldId: 'starttime',
                        value: startTime
                    });
                }
                if (endTime) {

                    event.setValue({
                        fieldId: 'endtime',
                        value: endTime
                    });
                }

                event.save({
                    ignoreMandatoryFields: true
                });
                log.debug('calendar event saved');
            }
        }

        function getNumberOfDays(start, end) {
            const date1 = new Date(start);
            const date2 = new Date(end);

            // One day in milliseconds
            const oneDay = 1000 * 60 * 60 * 24;

            // Calculating the time difference between two dates
            const diffInTime = date2.getTime() - date1.getTime();

            // Calculating the no. of days between two dates
            const diffInDays = Math.round(diffInTime / oneDay);

            return diffInDays;
        }

        return {
            onAction : onAction
        };

    });
