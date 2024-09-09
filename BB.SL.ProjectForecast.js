/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Michael Golichenko
 * @overview - Project Expense Budget suitelet form
 */


define(['N/record', 'N/search', 'N/redirect', 'N/ui/serverWidget', 'N/runtime', 'N/url', 'N/render'
    , 'N/file', 'N/format', 'N/task', '../BB SS/SS Lib/BB_SS_MD_SolarConfig'
    ,'../BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'],
  function(recordModule, searchModule, redirect, serverWidget, runtimeModule, urlModule, renderModule
           , fileModule, formatModule, taskModule, configModule
           , batchProcessingModule) {

    const
      _processMap = {
        'init': init
        , 'projects': findProjects
      }
      , _seqCalulateFunc = {
      'week': function(date, seq) {
        return date.setDate(date.getDate() + seq * 7);
      }
      , 'month': function(date, seq) {
        if(seq > 0) {
          return date.setMonth(date.getMonth() + seq * 1, 1);
        }
        return date;
      }
    }
      , _sublists = {
        BUDGET_LINE: 'recmachcustrecord_bb_proj_exp_budget'
      , LINE_SEQ: 'recmachcustrecord_bb_proj_exp_budg_line'
      }
      , _url = '/app/common/search/searchresults.nl?rectype=452&searchtype=Custom' +
      '&CUSTRECORD_BB_PATS_PROJECT={projectId}' +
      '&BDZ_Item_PARENT={parentId}' +
      '&CUSTRECORD_BB_PATS_ITEM={itemId}' +
      '&CUSTRECORD_BB_PATS_EXPECTED_PAYMENT_DATErange=CUSTOM' +
      '&CUSTRECORD_BB_PATS_EXPECTED_PAYMENT_DATEfrom={from}' +
      '&CUSTRECORD_BB_PATS_EXPECTED_PAYMENT_DATEto={to}' +
      '&style=NORMAL&CUSTRECORD_BB_PATS_EXPECTED_PAYMENT_DATEmodi=WITHIN&CUSTRECORD_BB_PATS_EXPECTED_PAYMENT_DATE=CUSTOM' +
      '&searchid=1286&dle=T&sortcol=BDZ_Item_PARENT_raw&sortdir=ASC&csv=HTML&OfficeXML=F&size=1000'
    ;

    var
      _seqTypes
      , _firstPaidWeekNumberSegments = {}
      , _startRequest
      , _startTask
    ;

    function logExecutionTime(message, start, end) {
      var diff = end.getTime() - start.getTime();
      var seconds = Math.floor(diff / (1000));
      diff -= seconds * (1000);
      //log.debug(message, seconds + " seconds, " + diff + " milliseconds");
    }

    function buildLink(projectId, parentId, itemId, from, to){
      const
        _projectId = projectId ? projectId : ''
        , _parentId = parentId ? parentId : ''
        , _itemId = itemId ? itemId : ''
        , _from = from ? encodeURIComponent(from) : ''
        , _to = to ? encodeURIComponent(to) : ''
      ;
      return _url
        .replace('{projectId}', _projectId)
        .replace('{parentId}', _parentId)
        .replace('{itemId}', _itemId)
        .replace('{from}', _from)
        .replace('{to}', _to);
    }

    function getSequenceTypes (){
      var _types = [];
      searchModule.create({
        type: 'customlist_bb_proj_exp_budg_seq_type'
        , columns: ['name']
      }).run().each(function(row){
        _types.push({
          seqTypeId: row.id
          , seqTypeName: row.getValue('name')
        });
        return true;
      });
      return _types;
    }

    function getDefaultValues(){
      var
        _seqType = configModule.getConfiguration('custrecord_bb_def_proj_exp_budg_seq_type')
      ;
      if(!_seqTypes){
        _seqTypes = getSequenceTypes();
      }
      if(_seqType) {
        return {
          seqTypeId: _seqType.value
          , seqTypeName: _seqType.text
        }
      }
      return _seqTypes[0];
    }

    function formatAmount(value){
      if(typeof value === 'string'){
        value = value.trim();
        value = value.replace(/\.+$/g, '');
        value = value.replace(',', '');
      }
      return value;
    }

    function getWeek(date) {
      var _fullYear = new Date(date.getFullYear(),0,1);
      return Math.ceil((((date - _fullYear) / 86400000) + _fullYear.getDay()+1)/7);
    }

    function findFirstPaidWeekNumber(seq, projectStartDate, seqName){
      var
        _seqNameLower = typeof seqName === 'string' ? seqName.toLowerCase() : undefined
        , _seqCalcFunc = _seqCalulateFunc[_seqNameLower]
        , _startDate
        , _year
        , _week
        , _segmentName
        , _foundSegment
      ;
      if(typeof _seqCalcFunc === 'function'){
        _startDate = new Date(_seqCalcFunc(projectStartDate, seq - 1));
        if(_startDate instanceof Date) {
          _year = _startDate.getFullYear().toString();
          if(!_firstPaidWeekNumberSegments.hasOwnProperty(_year)) {
            _firstPaidWeekNumberSegments[_year] = [];
            searchModule.create({
              type: 'customrecord_cseg_bb_paid_wk_num'
              , filters: [
                ['name', searchModule.Operator.STARTSWITH, _year]
              ]
              , columns: ['name']
            }).run().each(function(row){
              _firstPaidWeekNumberSegments[_year].push({
                id: row.id
                , name: row.getValue({name: 'name'})
              });
              return true;
            });
          }
          _week = getWeek(_startDate);
          _segmentName = [_year, _week].join('-');
          _foundSegment = _firstPaidWeekNumberSegments[_year].filter(function(s){
            return s.name == _segmentName;
          })[0];
          if(_foundSegment) {
            return _foundSegment.id;
          }
        }
      }
      return undefined;
    }

    function createProjExpBudgetSeq(itemId, seq) {
      var
        _projExpBudgetSeqRecord
      ;
      _projExpBudgetSeqRecord = recordModule.create({
        type: 'customrecord_bb_proj_exp_budg_line_seq'
      });
      _projExpBudgetSeqRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budg_line', value: itemId});
      _projExpBudgetSeqRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budg_line_seq', value: seq.seq});
      _projExpBudgetSeqRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budg_line_seq_amt', value: seq.amount});
      if(seq.firstPaidWeekNumber) {
        _projExpBudgetSeqRecord.setValue({fieldId: 'cseg_bb_paid_wk_num', value: seq.firstPaidWeekNumber});
      }
      if(seq.projectId){
        _projExpBudgetSeqRecord.setValue({fieldId: 'custrecord_bb_exp_budg_line_seq_proj', value: seq.projectId});
      }
      seq.id = _projExpBudgetSeqRecord.save();
    }

    function createProjExpBudgetLine(projExpBudgetId, item){
      var
        _projExpBudgetLineRecord
      ;
      _projExpBudgetLineRecord = recordModule.create({
        type: 'customrecord_bb_proj_exp_budg_line'
      });
      _projExpBudgetLineRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budget', value: projExpBudgetId});
      _projExpBudgetLineRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budget_item', value: item.itemId});
      if(item.amount){
        _projExpBudgetLineRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budget_amount', value: item.amount});
      }
      _projExpBudgetLineRecord.setValue({fieldId: 'custrecord_bb_proj_exp_budget_desc', value: item.desc});
      item.id = _projExpBudgetLineRecord.save();
      item.seqData.forEach(function(seq){
        createProjExpBudgetSeq(item.id, seq);
      });
    }

    function searchProjectSalesOrder(projectId) {
      var
        _so = null
        , _salesorderSearchObj
      ;
      if (projectId) {
        _salesorderSearchObj = searchModule.create({
          type: "salesorder",
          filters:
            [
              ["type","anyof","SalesOrd"],
              "AND",
              ["mainline","is","T"],
              "AND",
              ["custbody_bb_project","anyof", projectId]
            ],
          columns:
            [
              "internalid"
              , 'name'
            ]
        });
        _salesorderSearchObj.run().each(function(result){
          _so = {
            id: result.getValue({name: 'internalid'})
            , name: result.getText({name: 'name'})
          };
          return true;
        });
      }
      return _so;
    }

    function getExpenseItems(){
      var
        _expenseList = searchModule.load({
          id: 'customsearch_bb_expense_item_list'
        })
        , _itemLines = []
        , _item
        , _sections
      ;
      _expenseList.run().each(function(result) {
        _item = {};
        _item.itemId = result.getValue(_expenseList.columns[0]);
        _item.parentId = result.getValue(_expenseList.columns[1]);
        _item.title = result.getValue(_expenseList.columns[2]);
        _item.sequenceNum = result.getValue(_expenseList.columns[3]);
        _itemLines.push(_item);
        return true;
      });

      _sections = _itemLines.filter(function(item){
        return !item.parentId;
      });

      _sections.forEach(function(section){
        section.items = _itemLines.filter(function(item){
          return item.parentId == section.itemId;
        })
      });

      return _sections;
    }

    function getProjectExpenseVersions(projectId){
      var
        _projectExpenseSearch
        , _result = {
          versions: []
        }
        , _defaultReadonly = configModule.getConfiguration('custrecord_bb_uses_proj_actn_tran_schdl').value
      ;

      if(typeof _defaultReadonly === 'string') {
        _defaultReadonly = /t/i.test(_defaultReadonly);
      }

      _projectExpenseSearch = searchModule.create({
        type: 'customrecord_bb_proj_exp_budget'
        , filters: [
          ['custrecord_bb_proj_exp_budget_project', 'anyof', projectId]
        ]
        , columns: [
          'custrecord_bb_proj_exp_budget_version'
          // , 'custrecord_bb_proj_exp_budget_readonly'
        ]
      });

      _projectExpenseSearch.run().each(function(result){
        _result.versions.push({
          id: result.id
          , name: result.getValue({name: 'custrecord_bb_proj_exp_budget_version'})
          // , forceReadonly: result.getValue({name: 'custrecord_bb_proj_exp_budget_readonly'})
        });
        return true;
      });

      _result.versions.sort(function(a,b) { return b.id - a.id});
      _result.count = _result.versions.length;
      _result.baseLineIsSet = _result.count > 0 && /baseline/i.test(_result.versions[_result.versions.length - 1].name);
      _result.versions.forEach(function(v, idx) {
        v.readonly = idx > 0;
      });
      _result.currentVersion = _result.versions.filter(function(v){ return !v.readonly; })[0];
      //_result.readonly = _result.currentVersion ? _result.currentVersion.forceReadonly : _defaultReadonly;
      _result.readonly = _defaultReadonly;
      _result.activePeId = _result.currentVersion ? _result.currentVersion.id : undefined;
      _result.canAddVersion = _result.count > 0 && _result.baseLineIsSet;
      if(_defaultReadonly) {
        _result.versions.forEach(function(v) {
          v.readonly = true;
        });
      }
      return _result;
    }

    function getProjectExpense(projectId, peId){
      var
        _getDefaultTypes = getDefaultValues()
        , _dates = getProjectDates(projectId)
        , _result = {
          seqName: _getDefaultTypes ? _getDefaultTypes.seqTypeName : ''
          , seqCount: 0
          , projectDates: _dates
          , maxSeqCount: getDatesSequenceCount(_getDefaultTypes.seqTypeName, _dates.start, _dates.end)
          , items: []
        }
        , _projectExpenseSearch
        , _projExpBudgetLines = []
        , _filters = peId
        ? [['custrecord_bb_proj_exp_budget', 'anyof', peId]]
        : [["custrecord_bb_proj_exp_budg_line_proj","anyof", projectId]]
      ;
      _projectExpenseSearch = searchModule.create({
        type: "customrecord_bb_proj_exp_budg_line",
        filters: _filters,
        columns:
          [
            "custrecord_bb_proj_exp_budget",
            searchModule.createColumn({ name: "custrecord_bb_proj_exp_budget_seq", join: "CUSTRECORD_BB_PROJ_EXP_BUDGET" }),
            searchModule.createColumn({ name: "custrecord_bb_proj_exp_budget_seq_count", join: "CUSTRECORD_BB_PROJ_EXP_BUDGET" }),
            "internalid",
            "custrecord_bb_proj_exp_budget_item",
            "custrecord_bb_proj_exp_budget_amount",
            "custrecord_bb_proj_exp_budget_desc",
            searchModule.createColumn({ name: "internalid", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" }),
            searchModule.createColumn({ name: "custrecord_bb_proj_exp_budg_line_seq", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" }),
            searchModule.createColumn({ name: "custrecord_bb_proj_exp_budg_line_seq_amt", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" })
          ]
      });
      _projectExpenseSearch.run().each(function(result){
        _projExpBudgetLines.push({
          id: result.getValue({name: 'custrecord_bb_proj_exp_budget'})
          , seqName: result.getText({name: 'custrecord_bb_proj_exp_budget_seq', join: 'CUSTRECORD_BB_PROJ_EXP_BUDGET'})
          , seqCount: result.getValue({ name: "custrecord_bb_proj_exp_budget_seq_count", join: "CUSTRECORD_BB_PROJ_EXP_BUDGET" })
          , lineId: result.getValue({name: 'internalid'})
          , lineItem: result.getValue({name: 'custrecord_bb_proj_exp_budget_item'})
          , lineAmount: result.getValue({name: 'custrecord_bb_proj_exp_budget_amount'})
          , lineDesc: result.getValue({name: 'custrecord_bb_proj_exp_budget_desc'})
          , seqId: result.getValue({ name: "internalid", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" })
          , seqNumber: result.getValue({ name: "custrecord_bb_proj_exp_budg_line_seq", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" })
          , seqAmount: result.getValue({ name: "custrecord_bb_proj_exp_budg_line_seq_amt", join: "CUSTRECORD_BB_PROJ_EXP_BUDG_LINE" })
        });
        return true;
      });

      if(_projExpBudgetLines.length){
        _result.id = _projExpBudgetLines[0].id;
        _result.seqName = _projExpBudgetLines[0].seqName;
        _result.seqCount = isNaN(parseInt(_projExpBudgetLines[0].seqCount))
          ? getDatesSequenceCount(_result.seqName, _dates.start, _dates.end)
          : parseInt(_projExpBudgetLines[0].seqCount);
        _result.items = _projExpBudgetLines.reduce(function(arr, line){
          if(!arr.filter(function(s){ return s.id == line.lineId; })[0]){
            arr.push({
              id: line.lineId
              , itemId: line.lineItem
              , desc: line.lineDesc
              , amount: line.lineAmount || ''
              , seqData: _projExpBudgetLines.filter(function(f){
                return f.lineId == line.lineId;
              }).map(function(m){
                return {
                  id: m.seqId
                  , seq: m.seqNumber
                  , amount: m.seqAmount || ''
                };
              })
            });
          }
          return arr;
        }, []);
      } else {
        _result.seqCount = getDatesSequenceCount(_getDefaultTypes.seqTypeName, _dates.start, _dates.end);
      }

      return _result;
    }

    function getProjectDates(projectId){
      var
        _dates = {
          start: null
          , end: null
        }
        , _lookupFields
      ;
        if(projectId){
          _lookupFields = searchModule.lookupFields({
            type: searchModule.Type.JOB
            , id: projectId
            , columns: [
              'startdate'
              , 'projectedenddate'
            ]
          });
          if(_lookupFields.startdate){
            _dates.start = _lookupFields.startdate instanceof Date
              ? _lookupFields.startdate
              : formatModule.parse({value: _lookupFields.startdate, type: formatModule.Type.DATE});
          }
          if(_lookupFields.projectedenddate) {
            _dates.end = _lookupFields.projectedenddate instanceof Date
              ? _lookupFields.projectedenddate
              : formatModule.parse({value: _lookupFields.projectedenddate, type: formatModule.Type.DATE});
          }
        }
        return _dates;
    }

    function getDatesSequenceCount(seqType, startDate, endDate){
      const _seqCalulateFunc = {
        'week': function(start, end) {
          return parseInt(Math.floor((end - start)/(1000*60*60*24*7))) + 1;
        }
        , 'month': function(start, end) {
          return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        }
      };

      var
        _seqCount = 0
        //, _startDate
        , _seqFunc
      ;

      if(seqType && startDate instanceof Date && endDate instanceof Date
        && _seqCalulateFunc.hasOwnProperty(seqType.toLowerCase())) {
        _seqFunc = _seqCalulateFunc[seqType.toLowerCase()];
        _seqCount = _seqFunc(startDate, endDate);
      }

      return _seqCount;
    }


    // new code

    function getFilterColumnName(column) {
      var
        _key = column.name
      ;
      if(/formula/i.test(_key)){
        _key = [_key, column.formula].join(': ');
      } else if(column.join) {
        _key = [column.join, _key].join('.').toLowerCase()
      }
      return _key;
    }

    function getSearchConfig(searchId){
      var
        _searchId = searchId
        , _search
        , _filterFunc = function(columns, regexp) {
          return columns.filter(function(c) {
            return regexp.test(c.label);
          });
        }
        , _columns = {}
      ;
      if(_searchId){
        _search = searchModule.load({ id: _searchId });
        _columns.project = _filterFunc(_search.columns, /^project$/i)[0];
        _columns.item = _filterFunc(_search.columns, /^item$/i)[0];
        _columns.year = _filterFunc(_search.columns, /^year$/i)[0];
        _columns.month = _filterFunc(_search.columns, /^month$/i)[0];
        _columns.upside = _filterFunc(_search.columns, /^upside$/i)[0];
        _columns.actual = _filterFunc(_search.columns, /^actual$/i)[0];
        _columns.downside = _filterFunc(_search.columns, /^downside$/i)[0];
      }
      log.debug('columns', _columns);
      return _columns;
    }

    function getProjects(searchId, term) {
      var
        _data = []
        , _searchConfig = getSearchConfig(searchId)
        , _search
      ;
      log.debug('project column', _searchConfig.project);
      _search = searchModule.load({ id: searchId});
      _search.filterExpression = _search.filterExpression.concat([
        'AND'
        , [[_searchConfig.project.name, 'entityid'].join('.'), 'contains', term]
      ]);
      _search.columns = [_searchConfig.project];
      _search.run().each(function(row){
        var _projectId = row.getValue(_searchConfig.project);
        _data.push({
          name: row.getText(_searchConfig.project)
          , projectId: row.getValue(_searchConfig.project)
          , url: urlModule.resolveScript({
            scriptId: 'customscript_bb_ss_sl_project_forecast'
            , deploymentId: 'customdeploy_bb_ss_sl_project_forecast'
            , params: {project: _projectId}
          })
        });
        return true;
      });

      return _data

    }

    function getTransactionsData(searchId, projectId) {
      var
        _data = []
        , _searchConfig = getSearchConfig(searchId)
        , _search
        , _value
      ;

      _search = searchModule.load({ id: searchId});
      _search.filterExpression = _search.filterExpression.concat([
        'AND'
        , [getFilterColumnName(_searchConfig.project), 'ANYOF', [projectId]]
      ]);

      log.debug('_searchConfig', _searchConfig);
      _search.run().each(function(row){
        _value = {
          itemId: row.getValue(_searchConfig.item)
          , year: row.getValue(_searchConfig.year)
          , month: row.getValue(_searchConfig.month)
          , upside: row.getValue(_searchConfig.upside)
          , actual: row.getValue(_searchConfig.actual)
          , downside: row.getValue(_searchConfig.downside)
        };
        _value.date = new Date(Number(_value.year), Number(_value.month) - 1, 1);
        _data.push(_value);
        return true;
      });

      return _data
    }

    function init(context){
      var
        _response = context.response
        , _projectId = context.request.parameters.project
        , _project
        , _expenseSearchId = 'customsearch_bb_ss_pat_budget_info_2_2'
        , _revenueSearchId = 'customsearch_bb_ss_pat_budget_info_2_2_2'
        , _result = undefined
        , _dates
        , _max
        , _min
      ;

      if(_projectId) {
        _result = {
          sections: []
        };
        _result.expense = getTransactionsData(_expenseSearchId, _projectId);
        _result.revenue = getTransactionsData(_revenueSearchId, _projectId);
        _dates = _result.expense.concat(_result.revenue).map(function(i){ return i.date; });
        _max = _dates.reduce(function (a, b) { return a > b ? a : b; });
        _min = _dates.reduce(function (a, b) { return a < b ? a : b; });
        _result.min = _min;
        _result.max = _max;

        _project = _projectId
          ? searchModule.lookupFields({
            type: searchModule.Type.JOB
            , id: _projectId
            , columns: [
              'entityid'
            ]
          })
          : null;
        _result.projectId = _projectId;
        if(_project){
          _result.project = {
            id: _projectId
            , name: _project.entityid
            , url: urlModule.resolveRecord({recordType: 'job', recordId: _projectId})
          }
        }
        _result.sections.push({
          collapsed: false
          , title: 'Revenue'
          , items: _result.revenue.reduce(function(arr, item){
            var _item = arr.filter(function(a){
              return a.itemId === item.itemId;
            })[0];
            if(!_item) {
              arr.push({
                itemId: item.itemId
                , title: item.itemId
                , seqData: _result.revenue.filter(function(f) {
                  return f.itemId === item.itemId;
                })
              })
            }
            return arr;
          }, [])
        });

        _result.sections.push({
          collapsed: false
          , title: 'Expense'
          , items: _result.expense.reduce(function(arr, item){
            var _item = arr.filter(function(a){
              return a.itemId === item.itemId;
            })[0];
            if(!_item) {
              arr.push({
                itemId: item.itemId
                , title: item.itemId
                , seqData: _result.expense.filter(function(f) {
                  return f.itemId === item.itemId;
                })
              })
            }
            return arr;
          }, [])
        });

        _result.seqCount = (_result.max.getFullYear() - _result.min.getFullYear()) * 12 + (_result.max.getMonth() - _result.min.getMonth()) + 1;

        delete _result.revenue;
        delete _result.expense;
      }
      else {
        _result = {noProject: true};
      }

      _response.setHeader({
        name: 'Content-Type',
        value: 'application/json; charset=utf-8',
      });
      _response.write(JSON.stringify(_result));
    }

    function render(context){
      var
        _htmlFile = fileModule.load({id:'./template.html'})
        , _html = _htmlFile.getContents()
        , _form
        , _htmlField
        , _regexStr
        , _templateRender
        , _title = 'Project Forecast'
        , _saveButtonText = 'Submit Expense Budget Records'
      ;

      searchModule.create({
        type: 'file'
        , filters:[
          ['folder', searchModule.Operator.ANYOF, _htmlFile.folder]
          , 'AND'
          , ['filetype', searchModule.Operator.ANYOF, 'JAVASCRIPT']
        ]
        , columns: ['name', 'url']
      }).run().each(function(result){
        _regexStr = ['<script.* src="(', result.getValue('name'), ')".*?>'].join('');
        _html = _html.replace(new RegExp(_regexStr, 'igm'), function(match, p1){
          return match.replace(p1, result.getValue('url'));
        });
        return true;
      });

      _templateRender = renderModule.create();
      _templateRender.templateContent = _html;
      _templateRender.addCustomDataSource({
        format: renderModule.DataSource.OBJECT,
        alias: 'form',
        data: {
          view: {
            saveButtonText: _saveButtonText
          }
        }
      });
      _html = _templateRender.renderAsString();

      _form = serverWidget.createForm({
        title: _title
      });

      _htmlField = _form.addField({
        id: 'custpage_proj_exp_budget_form'
        , label: ' '
        , type: serverWidget.FieldType.INLINEHTML
      });
      _htmlField.defaultValue = _html;

      context.response.writePage(_form);
    }

    function findProjects(context) {
      const
        _request = context.request
        , _response = context.response
        , _term = _request.parameters.term
        , _expenseSearchId = 'customsearch_bb_ss_pat_budget_info_2_2'
        , _revenueSearchId = 'customsearch_bb_ss_pat_budget_info_2_2_2'
      ;
      var _projects = [];

      _projects = _projects.concat(getProjects(_revenueSearchId, _term));
      _projects = _projects.concat(getProjects(_expenseSearchId, _term));
      log.debug('projects', _projects);
      _projects = _projects.reduce(function(arr, proj){
        if(proj) {
          var _found = arr.filter(function(f) {
            return f.projectId == proj.projectId;
          })[0];
          if(!_found){
            arr.push(proj);
          }
        }
        return arr;
      }, []);

      _response.setHeader({
        name: 'Content-Type',
        value: 'application/json; charset=utf-8',
      });
      _response.write(JSON.stringify(_projects));
    }

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
      const
        _method = context.request.method
        , _request = context.request
        , _params = _request.parameters
        , _process = _params.process
      ;

      _startRequest = new Date();

      if (_method === 'GET') {
        if(typeof _process === 'string' && _process.trim().length > 0){
          if(_processMap.hasOwnProperty(_process)){
            _processMap[_process](context);
          }
        } else {
          render(context);
        }
      } else if(_method === 'POST') {
        if(typeof _process === 'string' && _process.trim().length > 0){
          if(_processMap.hasOwnProperty(_process)){
            _processMap[_process](context);
          }
        }
      }

      logExecutionTime('onRequest process', _startRequest, new Date());
    }

    return {
      onRequest: onRequest
    };
  });