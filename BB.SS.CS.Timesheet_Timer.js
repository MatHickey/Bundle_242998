/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 *@NModuleScope SameAccount
 * Version    Date            Author           Remarks
 * 1.00       10 February 2022   tmann
 */
define(['N/record', 'N/search', 'N/query'],
    function(record, search, query)
    {
        var myInterval= '';
        var timeLog = '';
        var startHours = 0,
            startMins = 0,
            startSecs = 0;

        //fields where all that is done is an upsert on field changes
        var a_upsertTempLogFieldList = ['custrecord_bb_timer_start_time_dt_time',
            'custrecord_bb_timer_project',
            'custrecord_bb_timer_svc_item',
            'custrecord_bb_timer_case',
            'custrecord_bb_timer_proj_action',
            'custrecord_bb_timer_memo'
        ];


        function pageInit(context) {
            var logTitle = 'pageInit ';
            var currentRecord = context.currentRecord;

            try{
                timeLog = getTimeLogQuery(currentRecord.id);
                log.debug(logTitle+'timeLog', timeLog);
                //restore timer values no matter what
                restoreTimerValues(currentRecord, timeLog, true);
                startHours = !isNull(timeLog.hours)?timeLog.hours:0;
                startMins = !isNull(timeLog.mins)?timeLog.mins:0;
                startSecs = !isNull(timeLog.secs)?timeLog.secs:0;
                var timerValue = (!isNull(timeLog.id))?timeLog.startTimer:false;
                if(timerValue){
                    //restart timer
                    lockHoursMinutes(currentRecord);
                    myInterval = setInterval(myTimer, 1000, currentRecord);
                }
            } catch (e) {
                log.error(logTitle + e.name, e.message);
            }

        }

        function fieldChanged(context){
            var logTitle = 'fieldChanged ';
            var currentRecord = context.currentRecord;
            var fieldName = context.fieldId;
            var sublistId = context.sublistId;
            //var lineId = context.line;

            if(fieldName == 'custrecord_bb_start_timer_bool'){
                try{
                    var timerValue = currentRecord.getValue('custrecord_bb_start_timer_bool');
                    log.debug(logTitle+'timerValue', timerValue);
                    if(timerValue){ //timer is checked
                        lockHoursMinutes(currentRecord);//don't allow user to change hours/minutes while timer is running
                        var startTime = currentRecord.getValue('custrecord_bb_timer_start_time_dt_time');
                        if(isNull(startTime)){
                            currentRecord.setValue({
                                fieldId: 'custrecord_bb_timer_start_time_dt_time',
                                value: new Date(),
                                ignoreFieldChange:true //triggering field change will attempt 2 upsert calls. Inefficient and error prone
                            });
                        }
                        timeLog.id = upsertTempTimeLog(currentRecord, timeLog);
                        myInterval = setInterval(myTimer, 1000, currentRecord);//start the timer
                    }
                    else{
                        //stop timer
                        currentRecord.setValue({
                            fieldId: 'custrecord_bb_timer_start_time_dt_time',
                            value: null,
                            ignoreFieldChange:false
                        });
                        startHours = currentRecord.getValue('custrecord_bb_timer_hours_int');
                        startMins = currentRecord.getValue('custrecord_bb_timer_min_int');
                        startSecs = currentRecord.getValue('custrecord_bb_timer_sec_int');
                        clearInterval(myInterval);
                        unlockHoursMinutes(currentRecord);//allow the user to edit the hours/minutes
                        timeLog.id = upsertTempTimeLog(currentRecord, timeLog);//ensure timelog is updated so on refresh the timer stays stopped
                    }
                } catch (e){
                    log.error(logTitle, e.message);
                }
            }
            else if(a_upsertTempLogFieldList.indexOf(fieldName) >-1){//all of these fields are just for capture
                log.debug(logTitle+ 'fieldName', fieldName);
                timeLog.id =  upsertTempTimeLog(currentRecord, timeLog);

            } else if(fieldName == 'custrecord_bb_timer_confirm_bool'){
                var confirmValue = currentRecord.getValue('custrecord_bb_timer_confirm_bool');
                if(confirmValue){//User has confirmed the entry to be created
                    //stop the timer if it is running
                    clearInterval(myInterval);
                    unlockHoursMinutes(currentRecord);
                    //create time entry
                    createTimeEntry(currentRecord, timeLog);//actually creates the time entry record
                    resetTimerValues(currentRecord);
                    timeLog.id = upsertTempTimeLog(currentRecord, timeLog);//reset the timelog record, rather than delete/recreate
                    onbeforeunload = null;
                    location.reload();//allows the user to see the new record
                }
            } else if(fieldName == 'custcol_bb_timer_replay'){
                var replayValue = currentRecord.getCurrentSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bb_timer_replay'
                });
                if(replayValue){
                    try{
                        //set the values from the line to the header
                        restoreTimerValues(currentRecord, getReplayValues(currentRecord, sublistId), false);

                        //reset the replay checkbox
                        currentRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId:'custcol_bb_timer_replay',
                            value:false
                        });
                    } catch (e){
                        log.error(logTitle+e.name,e.message);
                    }
                }
            }
        }

        /**
         * Sets the Hours and Minute fields to disabled.
         * Generally used when the timer is running
         *
         * @param currentRecord
         */
        function lockHoursMinutes(currentRecord){
            currentRecord.getField('custrecord_bb_timer_hours_int').isDisabled = true;
            currentRecord.getField('custrecord_bb_timer_min_int').isDisabled = true;
        }

        /**
         * Sets the hours and minutes fields back to normal
         * Done when timer is not running to allow for manual entry
         *
         * @param currentRecord
         */
        function unlockHoursMinutes(currentRecord){
            currentRecord.getField('custrecord_bb_timer_hours_int').isDisabled = false;
            currentRecord.getField('custrecord_bb_timer_min_int').isDisabled = false;
        }

        /**
         * Restores the values on the timesheet record from the data record
         * This is used on load from the Temporary Time Log object as well as for the "Replay" functionality
         *
         * @param currentRecord
         * @param data
         */
        function restoreTimerValues(currentRecord, data, ignoreProjectChange){
            var logTitle = 'restoreTimerValues ';
            log.debug(logTitle+'data',data);
            try {
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_start_time_dt_time',
                    value: !isNull(data.startTime)?data.startTime : null,
                    ignoreFieldChange: true
                });
                log.debug(logTitle + 'startTime', currentRecord.getValue('custrecord_bb_timer_start_time_dt_time'));
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_svc_item',
                    value: !isNull(data.item) ? data.item : null,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_memo',
                    value: !isNull(data.memo) ? data.memo : null,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_hours_int',
                    value: !isNull(data.hours) ? data.hours : 0,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_min_int',
                    value: !isNull(data.mins) ? data.mins : 0,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_sec_int',
                    value: !isNull(data.secs) ? data.secs : 0,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_project',
                    value: !isNull(data.project) ? data.project : null,
                    enableSourcing:true,
                    fireSlavingSync:true,
                    ignoreFieldChange: ignoreProjectChange
                });

                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_case',
                    value: !isNull(data.case) ? data.case : null,
                    enableSourcing:true,
                    ignoreFieldChange: true
                });
                currentRecord.setValue({
                    fieldId: 'custrecord_bb_timer_proj_action',
                    value: !isNull(data.projectAction) ? data.projectAction : null,
                    enableSourcing:true,
                    ignoreFieldChange: true
                });

                currentRecord.setValue({
                    fieldId: 'custrecord_bb_start_timer_bool',
                    value: !isNull(data.startTimer) ? data.startTimer : false,
                    ignoreFieldChange: !data.triggerTimer//to trigger the timer, you do not ignore. Making it an inverse
                });

                var currentTime =
                    '<span class="display" ' +
                    'style="grid-column: 1/3;' +
                    'grid-row: 1/2;' +
                    'display: flex;' +
                    'align-items: center;' +
                    'justify-content: center;' +
                    'font-size: 3rem;' +
                    'border: 5px solid rgb(124, 124, 123);' +
                    'padding: 0.5rem 1rem;' +
                    'color: rgb(82, 80, 80);margin-bottom: 20px;">'+
                    '<span id="hour">'+(!isNull(data.hours) ? data.hours : 0)+'</span>:'+
                    '<span id="min">'+(!isNull(data.mins) ? data.mins : 0)+'</span>:'+
                    '<span id="sec">'+(!isNull(data.secs) ? data.secs : 0)+'</span>'+
                    '</span>';

                currentRecord.setValue({fieldId: 'custrecord_bb_currenttime_html', value:currentTime});

            } catch (e){
                log.error(logTitle+e.name,e.message);
            }

        }

        /**
         * This sets all the timer values on the Timesheet to null/0/false
         * Generally used for after submission of the entry
         *
         * @param currentRecord
         */
        function resetTimerValues(currentRecord){
            var logTitle = 'resetTimerValues ';

            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_start_time_dt_time',
                value:null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_project',
                value: null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_svc_item',
                value: null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_case',
                value: null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_proj_action',
                value: null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_memo',
                value: null,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_hours_int',
                value:0,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_min_int',
                value:0,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_timer_sec_int',
                value:0,
                ignoreFieldChange:true
            });
            currentRecord.setValue({
                fieldId: 'custrecord_bb_start_timer_bool',
                value:false,
                ignoreFieldChange:false
            });
        }

        /**
         * Gets the values from the time sublist
         * This is called as a parameter to restoreTimerValues which sets these values on the header
         *
         * @param currentRecord - NS obj for the current timesheet
         * @param sublistId - string id for the sublist id
         * @return {} -JSON object to match what is needed for setting the header values
         */
        function getReplayValues(currentRecord, sublistId){
            var copyValues = {};
            copyValues.startTimer = true;
            //copyValues.startTime = new Date(result.getValue('custrecord_bb_temp_time_start_dt_time'));
            copyValues.project = currentRecord.getCurrentSublistValue({
                sublistId:sublistId,
                fieldId: 'customer'
            });
            copyValues.item = currentRecord.getCurrentSublistValue({
                sublistId:sublistId,
                fieldId: 'item'
            });
            copyValues.projectAction = currentRecord.getCurrentSublistValue({
                sublistId:sublistId,
                fieldId: 'custcol_bb_time_project_action'
            });
            copyValues.case = currentRecord.getCurrentSublistValue({
                sublistId:sublistId,
                fieldId: 'casetaskevent'
            });
            copyValues.memo = currentRecord.getCurrentSublistValue({
                sublistId:sublistId,
                fieldId: 'memo'
            });
            copyValues.triggerTimer = true;

            return copyValues;
        }


        /**
         * Determines time for timer based on start time.
         * This is done by using millisecond formulas to ensure accurate results
         *
         * Sets hours, minutes, and seconds on the Timesheet record. Seconds are hidden but used for displaying HTML
         * Also sets this in a stylized HTML format
         *
         * @param currentRecord - NS obj for timesheet record
         */
        function myTimer(currentRecord) {
            var logTitle = 'myTimer ';
            var hour = 0,
                min = 0,
                sec = 0;
            const now = new Date();
            var nowMS = now.getTime();
            try {

                var startTime = currentRecord.getValue('custrecord_bb_timer_start_time_dt_time');
                var startTimeMS = startTime.getTime();
                var diff = Math.abs(nowMS - startTimeMS);

                hour =  startHours + Math.floor(diff / 3600000);//number of MS in an hour
                min = startMins + Math.floor((diff % 3600000) / 60000);
                if(min >= 60){
                    min = min - 60;
                    hour = hour+1;
                }
                sec = startSecs + Math.floor((diff%60000)/1000);
                if(sec >= 60){
                    sec = sec - 60;
                    min = min+1;
                }
                var currentTime =
                    '<span class="display" ' +
                    'style="grid-column: 1/3;' +
                    'grid-row: 1/2;' +
                    'display: flex;' +
                    'align-items: center;' +
                    'justify-content: center;' +
                    'font-size: 3rem;' +
                    'border: 5px solid rgb(124, 124, 123);' +
                    'padding: 0.5rem 1rem;' +
                    'color: rgb(82, 80, 80);margin-bottom: 20px;">'+
                                     '<span id="hour">'+hour+'</span>:'+
                                     '<span id="min">'+min+'</span>:'+
                                     '<span id="sec">'+sec+'</span>'+
                     '</span>';

                currentRecord.setValue({fieldId: 'custrecord_bb_currenttime_html', value:currentTime});
                currentRecord.setValue({fieldId: 'custrecord_bb_timer_hours_int', value:hour});
                currentRecord.setValue({fieldId: 'custrecord_bb_timer_min_int', value:min});
                currentRecord.setValue({fieldId: 'custrecord_bb_timer_sec_int', value:sec});
            } catch (e){
                log.error(logTitle, e.message);
            }
        }


        /**
         * Create/Update the custom record 'Temporary Time Log' in order to maintain the current data in the event of
         * page refresh or close of browser etc.
         *
         * @param currentRecord - NS obj for current timesheet
         * @param timeLog - JSON object representing the tempTimeLog record for ease of use
         * @return {} - JSON object representing the tempTimeLog record for ease of use. Keeping it up to date to ensure no issues
         */
        function upsertTempTimeLog(currentRecord, timeLog){
            var logTitle = 'upsertTempTimeLog ';
            var timeLogId = -1;
            try{
                log.debug(logTitle+'timeLog', timeLog);
                log.debug(logTitle+'!isNull(timeLog.id)',!isNull(timeLog.id));
                if(!isNull(timeLog.id)){//if timeLog was already found and loaded, then update
                    timeLogId = updateTimeLog(currentRecord,timeLog);
                } else { //otherwise create
                    timeLogId = createTimeLog(currentRecord);
                }
                //keep the JSON in sync with the record
                updateTimeLogFromTimesheet(currentRecord,timeLog);
                return timeLogId;
            } catch (e){
                log.error(logTitle+e.name, e.message);
            }
        }

        /**
         * Creates the custom record 'Temporary Time Log' in order to maintain the current data in the event of
         * page refresh or close of browser etc.
         * There will only be 1 per timesheet. It is updated from there on
         *
         * @param currentRecord - NS obj for current timesheet
         * @returns integer - Internal id of timeLog
         */
        function createTimeLog(currentRecord){
            var tempTimeLog = '';

            tempTimeLog = record.create({
                type: 'customrecord_bb_temp_time_log',
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_timesheet',
                value: currentRecord.id
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_start_timer',
                value: currentRecord.getValue('custrecord_bb_start_timer_bool')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_start_dt_time',
                value: currentRecord.getValue('custrecord_bb_timer_start_time_dt_time')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_project',
                value: currentRecord.getValue('custrecord_bb_timer_project')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_service_item',
                value: currentRecord.getValue('custrecord_bb_timer_svc_item')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_case',
                value: currentRecord.getValue('custrecord_bb_timer_case')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_project_action',
                value: currentRecord.getValue('custrecord_bb_timer_proj_action')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_memo',
                value: currentRecord.getValue('custrecord_bb_timer_memo')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_hours_int',
                value: currentRecord.getValue('custrecord_bb_timer_hours_int')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_mins_int',
                value: currentRecord.getValue('custrecord_bb_timer_min_int')
            });
            tempTimeLog.setValue({
                fieldId: 'custrecord_bb_temp_time_secs_int',
                value: currentRecord.getValue('custrecord_bb_timer_sec_int')
            });

            var timeLogId = tempTimeLog.save();
            return timeLogId;
        }

        /**
         * Creates the custom record 'Temporary Time Log' in order to maintain the current data in the event of
         * page refresh or close of browser etc.
         * There will only be 1 per timesheet. It is updated from there on
         *
         * @param currentRecord - NS obj for current timesheet
         * @param timeLog - JSON object representing the tempTimeLog record for ease of use
         * @return integer - Internal id of timeLog
         */
        function updateTimeLog(currentRecord, timeLog){
            var values = {};
            values['custrecord_bb_temp_time_timesheet'] = currentRecord.id;
            values['custrecord_bb_temp_time_start_timer'] = currentRecord.getValue('custrecord_bb_start_timer_bool');
            values['custrecord_bb_temp_time_start_dt_time'] = currentRecord.getValue('custrecord_bb_timer_start_time_dt_time');
            values['custrecord_bb_temp_time_project'] = currentRecord.getValue('custrecord_bb_timer_project');
            values['custrecord_bb_temp_time_service_item'] = currentRecord.getValue('custrecord_bb_timer_svc_item');
            values['custrecord_bb_temp_time_case'] = currentRecord.getValue('custrecord_bb_timer_case');
            values['custrecord_bb_temp_time_project_action'] = currentRecord.getValue('custrecord_bb_timer_proj_action');
            values['custrecord_bb_temp_time_memo'] = currentRecord.getValue('custrecord_bb_timer_memo');
            values['custrecord_bb_temp_time_hours_int'] = currentRecord.getValue('custrecord_bb_timer_hours_int');
            values['custrecord_bb_temp_time_mins_int'] = currentRecord.getValue('custrecord_bb_timer_min_int');
            values['custrecord_bb_temp_time_secs_int'] = currentRecord.getValue('custrecord_bb_timer_sec_int');

            timeLog.id = record.submitFields({
                id:timeLog.id,
                type:'customrecord_bb_temp_time_log',
                values:values
            });
            return timeLog.id;
        }

        /**
         * Updates JSON for timelog to stay in sync with timesheet changes and avoid research/loading from DB
         *
         * @param currentRecord - NS obj for current timesheet
         * @param timeLog - JSON object representing the tempTimeLog record for ease of use
         */
        function updateTimeLogFromTimesheet(currentRecord,timeLog){
            timeLog.startTime = currentRecord.getValue('custrecord_bb_timer_start_time_dt_time');
            timeLog.project = currentRecord.getValue('custrecord_bb_temp_time_project');
            timeLog.item = currentRecord.getValue('custrecord_bb_timer_svc_item');
            timeLog.case = currentRecord.getValue('custrecord_bb_timer_case');
            timeLog.projectAction = currentRecord.getValue('custrecord_bb_timer_proj_action');
            timeLog.memo = currentRecord.getValue('custrecord_bb_timer_memo');
            timeLog.hours = currentRecord.getValue('custrecord_bb_timer_hours_int');
            timeLog.mins = currentRecord.getValue('custrecord_bb_timer_min_int');
        }

        /**
         * Creates the actual time entry based on values on the timesheet
         *
         * @param currentRecord - NS obj for current timesheet
         * @param timeLog - JSON object representing the tempTimeLog record for ease of use
         */
        function createTimeEntry(currentRecord, timeLog){
            var logTitle = 'createTimeEntry ';

            //get values
            var employeeId = currentRecord.getValue('employee');
            var date = isNull(currentRecord.getValue('custrecord_bb_timer_start_time_dt_time'))?
                new Date():currentRecord.getValue('custrecord_bb_timer_start_time_dt_time');

            var projectId = currentRecord.getValue('custrecord_bb_timer_project');
            var serviceItemId = currentRecord.getValue('custrecord_bb_timer_svc_item');
            var memo = currentRecord.getValue('custrecord_bb_timer_memo');
            var caseId = currentRecord.getValue('custrecord_bb_timer_case');
            var projectActionId = currentRecord.getValue('custrecord_bb_timer_proj_action');
            var min = currentRecord.getValue('custrecord_bb_timer_min_int');
            var hour = currentRecord.getValue('custrecord_bb_timer_hours_int');


            //set values
            try{
                var timeEntry = record.create({
                    type: record.Type.TIME_BILL,
                    isDynamic: true
                });
                timeEntry.setValue({fieldId: 'employee', value: employeeId});
                // timeEntry.setValue({fieldId: 'timesheet', value: timeSheetId});
                timeEntry.setValue({fieldId: 'customer', value: projectId});
                timeEntry.setValue({fieldId: 'trandate', value: date});
                var minConversion = (((parseFloat(min) * 100) / 60) / 100).toFixed(2);
                var minutes = minConversion.split('.').pop();
                var timeData = hour + '.' + minutes;
                log.debug(logTitle+'hour', hour);
                log.debug(logTitle+'min', minConversion);
                log.debug(logTitle+'timeDate Replay', timeData);
                timeEntry.setValue({fieldId: 'hours', value: timeData});
                if (caseId != 'null' && caseId != '') {
                    timeEntry.setValue({fieldId: 'casetaskevent', value: caseId});
                }
                if (projectActionId != 'null' && projectActionId != '') {
                    timeEntry.setValue({fieldId: 'custcol_bb_time_project_action', value: projectActionId});
                }
                if (serviceItemId != 'null' && serviceItemId != '') {
                    timeEntry.setValue({fieldId: 'item', value: serviceItemId});
                }
                timeEntry.setValue({fieldId: 'memo', value: memo});
                timeEntry.save({ignoreMandatoryFields: true});
            } catch (e){
                log.error(logTitle+e.name, e.message);
            }
        }

        /**
         * Searches for the 'Temporary Time Log' record matching this timesheet and returns it in JSON format
         * Using n/query for improved speed
         *
         * @param timesheetId - internal id of the timesheet
         * @return {} - JSON for the TimeLog that matches this timesheet
         */
        function getTimeLogQuery(timesheetId){
            var logTitle = 'getTimeLogQuery ';
            var timeLog = {};
            var tempTimeLogQuery = query.create({
                type:'customrecord_bb_temp_time_log'
            });

            var timesheetJoin = tempTimeLogQuery.autoJoin({
                fieldId: 'custrecord_bb_temp_time_timesheet'
            });

            var idCondition = timesheetJoin.createCondition({
                fieldId: 'id',
                operator: query.Operator.EQUAL,
                values: timesheetId
            });
            tempTimeLogQuery.condition = tempTimeLogQuery.and(idCondition);

            tempTimeLogQuery.columns = [
                tempTimeLogQuery.createColumn({
                    fieldId: 'id'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_start_timer'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_start_dt_time'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_project'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_service_item'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_project_action'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_case'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_memo'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_hours_int'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_mins_int'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_secs_int'
                }),
                tempTimeLogQuery.createColumn({
                    fieldId: 'custrecord_bb_temp_time_timesheet'
                })
            ];

            // Sort the query results based on query columns
            tempTimeLogQuery.sort = [
                tempTimeLogQuery.createSort({
                    column: tempTimeLogQuery.columns[0],
                    ascending: true
                })
            ];

            // Run the query
            var resultSet = tempTimeLogQuery.run();

            // Retrieve and log the results
            var results = resultSet.results;
            log.debug(logTitle+'results',results);
            var values;
            for(var i =0; i< results.length; i++){
                values = results[i].values;
                log.debug(logTitle+'results values',values);
                timeLog.id = values[0];//internal id
                timeLog.startTimer = values[1];//custrecord_bb_temp_time_start_timer
                timeLog.startTime = isNull(values[2])?null:new Date(values[2]);//custrecord_bb_temp_time_start_dt_time
                timeLog.project = values[3];//custrecord_bb_temp_time_project
                timeLog.item = values[4];//custrecord_bb_temp_time_service_item
                timeLog.projectAction = values[5];//custrecord_bb_temp_time_project_action
                timeLog.case = values[6];//custrecord_bb_temp_time_case
                timeLog.memo = values[7];//custrecord_bb_temp_time_memo
                timeLog.hours = values[8];//custrecord_bb_temp_time_hours_int
                timeLog.mins = values[9];//custrecord_bb_temp_time_mins_int
                timeLog.secs = values[10];//custrecord_bb_temp_time_secs_int
                timeLog.triggerTimer = false;
            }
            log.debug(logTitle+'timeLog',timeLog);
            return timeLog;
        }

        /**
         * Determines if the parameter is null. This is used to handle various data types at once
         *
         * Null is defined as:
         * Null
         * Empty string
         * undefined
         * 0
         * Datatype with no length
         * Or date that is equal to the default 1970 date.
         *
         * @param data - parameter to be evaluated
         * @return {boolean} - true if matches definition of "null"
         */
        function isNull(data){
            var logTitle = 'isNull ';
            var startOfTime = new Date(1970,1,1,0,0,0,0);
           // log.debug(logTitle+'data',data);
            //log.debug(logTitle+'typeof data.getTime',typeof data.getTime);

            if(data != undefined && typeof data.getTime === 'function'){
                return data.getTime()==startOfTime.getTime();
            }
            return data == null || data == undefined || data == ''||data==0||data.length==0;
        }

        return {
            pageInit:pageInit,
            fieldChanged: fieldChanged
        };
    });