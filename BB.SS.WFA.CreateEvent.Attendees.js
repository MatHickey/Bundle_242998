/**
 * @NApiVersion 2.1
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
            try {
                //get parameters from WF
                let func = "onAction";
                let differenceInDays = 0;	// here we go  custrecord_bb_proj_act_event_single
                const assignedTo = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_assigned_to'});
                const company = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_company'});
                const sDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_start_date'});
                const startTime = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_start_time'});
                const endTime = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_end_time'});
                const title = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_title'});
                const seriesStartDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_series_start_date'});
                const endBy = runtime.getCurrentScript().getParameter({name: 'custscript_bb_event_end_by_date'});
                const eDate = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_end_date'});
                const frequency = runtime.getCurrentScript().getParameter({name: 'custscript_bb_evnt_frequency'});
                let multAtd = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_act_event_attd'});
                let singleAtd = runtime.getCurrentScript().getParameter({name: 'custscript_bb_proj_act_event_single'});
                let eventRec;
                log.audit('Assigned To', assignedTo);
                log.audit('Company', company);
                log.audit('Start Date', sDate);
                log.audit('Start Time', startTime);
                log.audit('End Time', endTime);
                log.audit('Title', title);
                log.audit('Series Start Date', seriesStartDate);
                log.audit('End By', endBy);
                log.audit('End Date', eDate);
                log.audit('Frequency', frequency);
                log.audit('Multi Attendee Field', multAtd);
                log.audit('Single Attendee Field', singleAtd);
                var atdList = [];
                // Add the multi attendee (Attendees) and the single attendee (Assigned to Tech) to the array 
                // to send to createCalendarEvent

                log.audit('Attendee List Length', multAtd.length);
                log.audit('Single Attendee Length', singleAtd.length);

                if (multAtd.length > 0) {
                    let multiAttendeesName = splitNames(multAtd);
                    for (let i = 0; i < multiAttendeesName.length; i++) {
                        atdList.push(getEmployeeID(multiAttendeesName[i]));
                    }                    
                }
                if (singleAtd.length > 0) {
                    atdList.push(getEmployeeID(singleAtd));
                }
                // Remove duplicates
                atdList = atdList.reduce(function (pv, cv) {
                    if (pv.indexOf(cv) === -1) { pv.push(cv) }
                    return pv
                }, []);
                log.audit('Attendee List', atdList);
                log.debug(func, "Start: " + JSON.stringify({
                    singleAtd: singleAtd,
                    multAtd: multAtd,
                    atdList: atdList,
                    differenceInDays: differenceInDays,
                    assignedTo: assignedTo,
                    company: company,
                    sDate: sDate,
                    startTime: startTime,
                    endTime: endTime,
                    title: title,
                    seriesStartDate: seriesStartDate,
                    endBy: endBy,
                    eDate: eDate, 
                    frequency: frequency
                }));

                // create first event
                eventRec = createCalendarEvent(assignedTo, company, title, sDate, sDate, startTime, endTime, singleAtd, atdList)

                if (sDate && eDate) {
                    differenceInDays = getNumberOfDays(sDate, eDate);
                }

                // To create events spanning multiple days
                if (differenceInDays > 0) {
                    /**
                    for (var d = 0; d < differenceInDays; d++) {
                        var startDate = new Date(sDate);
                        var tomorrow = startDate;
                        tomorrow.setDate(startDate.getDate()+d+1);
                        log.debug('tomorrow', tomorrow);
                        createCalendarEvent(assignedTo, company, title, tomorrow, tomorrow, startTime, endTime, atdList);
                    }
                    */
                }
                log.debug(func, "Returning, eventRec: " + JSON.stringify({eventRec: eventRec}));

                // set the event rec id in the "Appointment Field"
                if(!isNullOrEmpty(eventRec)) {
                    scriptContext.newRecord.setValue({fieldId: "custrecord_bb_proj_action_event", value: eventRec.id});
                }
                
            } catch (e) {
                 log.error(e.name, JSON.stringify(e));
            }
        }

        function createCalendarEvent(assignedTo, company, title, startDate, endDate, startTime, endTime, singleAtd, atdList) {
            try {
                log.audit('createCalendarEvent', 'Starting');
                log.debug('createCalendarEvent Event Attendee', singleAtd)
                var func = "createCalendarEvent"; 
                var event, eventId, i; 
                if (assignedTo && company && title && startDate && endDate && !isNullOrEmpty(atdList)) {
                    event = record.create({
                        type: record.Type.CALENDAR_EVENT,
                        isDynamic: true
                    });
                    event.setValue({ fieldId: 'title', value: title });
                    if (startDate) {
                        event.setValue({ fieldId: 'startdate', value: startDate });
                    }
                    if (endDate) {
                        event.setValue({ fieldId: 'enddate', value: endDate });
                    }
                    if (startTime) {
                        event.setValue({ fieldId: 'starttime', value: startTime });
                    }
                    if (endTime) {
                        event.setValue({ fieldId: 'endtime', value: endTime });
                    }
                    if (singleAtd.length > 0) {
                        event.setValue({ fieldId: 'organizer', value: getEmployeeID(singleAtd) });
                    }
                    if (singleAtd.length > 0) {
                        event.setValue({ fieldId: 'owner', value: getEmployeeID(singleAtd) });
                    }
                    if (atdList.length > 0) {
                        log.debug(func, "In attendee list.");
                        for(i = 0; i < atdList.length; i += 1) {
                            event.selectNewLine({ sublistId: 'attendee' });
                            event.setCurrentSublistValue({ sublistId: 'attendee', fieldId: 'attendee', value: atdList[i] });
                            if (atdList[i] === getEmployeeID(singleAtd)) {
                                event.setCurrentSublistValue({ sublistId: 'attendee', fieldId: 'response', value: "ACCEPTED" });
                            } else {
                                event.setCurrentSublistValue({ sublistId: 'attendee', fieldId: 'response', value: "NORESPONSE" });
                            }
                            event.commitLine({ sublistId: 'attendee' });
                        }
                    }
                    log.debug('calendar event before save');
                    eventId = event.save({ ignoreMandatoryFields: true });
                    log.debug('calendar event saved');
                }
                log.debug("Calendar Event Id:" , eventId);
                return event;
            } catch (e) {
                 log.error(e.name, JSON.stringify(e));
            }
        }

        function getNumberOfDays(start, end) {
            const func = "getNumberOfDays";
            const date1 = new Date(start);
            const date2 = new Date(end);

            // One day in milliseconds
            const oneDay = 1000 * 60 * 60 * 24;

            // Calculating the time difference between two dates
            const diffInTime = date2.getTime() - date1.getTime();

            // Calculating the no. of days between two dates
            const diffInDays = Math.round(diffInTime / oneDay);

            log.debug(func, "Returning: " + diffInDays);
            return diffInDays;
        }

        /**
         * @description isNullOrEmpty: method that validates if a variable has null or empty value.
         * @param {*} _value [required];
         * @returns {boolean}. Return true if the variable is null or empty
         */
        function isNullOrEmpty (_value) {
            if (typeof _value === 'undefined' || _value === null) {
                return true;
            } else if (util.isString(_value)) {
                if (_value.trim() === '' || _value.length === 0) {
                    return true;
                }
            } else if (util.isArray(_value)) {
                if (_value.length === 0) {
                    return true;
                }
            } else if (util.isObject(_value)) {
                for (var key in _value) {
                    if (_value.hasOwnProperty(key)) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        };

        function getEmployeeID(employeeName) {
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                [
                   ["entityid", "contains", employeeName]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "entityid", label: "Name"}),
                    search.createColumn({name: "email", label: "Email"}),
                    search.createColumn({name: "phone", label: "Phone"}),
                    search.createColumn({name: "altphone", label: "Office Phone"}),
                    search.createColumn({name: "fax", label: "Fax"}),
                    search.createColumn({name: "supervisor", label: "Supervisor"}),
                    search.createColumn({name: "title", label: "Job Title"}),
                    search.createColumn({name: "altemail", label: "Alt. Email"}),
                    search.createColumn({name: "custentity_restrictexpensify", label: "Restrict Access to Expensify"}),
                    search.createColumn({name: "custentity_ts_offboarded_subp", label: "Offboarded"})
                ]
             });
             var searchResultCount = employeeSearchObj.runPaged().count;
             log.debug("employeeSearchObj result count",searchResultCount);
             employeeSearchObj.run().each(function(result) {
                recordId = result.getValue('internalid');
                log.debug("Attendee Internalid", recordId);
                return true;
             });
             return recordId;
        }

        function splitNames(input) {
            // Regular expression to match two words (first and last name) separated by any kind of whitespace or special character
            const regex = /[A-Z][a-z]* [A-Z][a-z]*/g;
        
            // Use match() to find all matches of the pattern in the input string
            const names = input.match(regex);
            log.debug('names', names);
        
            return names || []; // Return the array of names, or an empty array if no matches found
        }

        return {
            onAction : onAction
        };

    });
