/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Michael Golichenko
 * @overview - Project Expense Budget suitelet form
 */

define(['N/search', 'N/format', 'N/ui/serverWidget', 'N/runtime', 'N/url'],
  function (searchModule, formatModule, uiServerWidgetModule, runtimeModule, urlModule) {

  const
    FORMATTERS = {
      link: function(text, link){
        if(typeof text !== 'string' || typeof link !== 'string') {
          return '';
        }
        return ['<a href="', link, '" target="_blank">', text, '</a>'].join('');
      }
    }
    , TESTERS = {
      link: function(label, formatterLabel) {
        return (new RegExp(['link\\["', label, '"\\]'].join(''), 'i')).test(formatterLabel);
      }
    }
  ;

  function getTextOrValue(row, column){
    var
      _result = undefined
    ;
    try {
      _result = row.getText(column);
      if(!_result || _result == null || (typeof _result === 'string' && _result.trim().length === 0)) {
        _result = row.getValue(column);
      }
    } catch(e) {
      _result = row.getValue(column);
    }
    return _result;
  }

  function runSearch() {
    var
      _searchId = runtimeModule.getCurrentScript().getParameter({name: 'custscript_selected_search'})
      , _search
      , _result = {
        title: undefined
        , type: undefined
        , columns: []
        , data: []
      }
      , _data
      , _columns
      , _formatters
      , _formatter
      , _totals = {}
    ;

    if(!_searchId){
      _result.title = 'Search Not Set.'
      return _result;
    }

    _search = searchModule.load({id: _searchId});
    _result.type = _search.searchType;
    _result.title = searchModule.lookupFields({
      type: searchModule.Type.SAVED_SEARCH
      , id: _searchId
      , columns: ['title']
    })['title'];

    _columns = _search.columns.map(function(c){
      var _column = {
        id: (Math.random() + 100).toString(36).replace(/[^a-z]+/g, '').substr(2, 10)
        , name: c.name
        , label: typeof c.label === 'string' && c.label.trim().length > 0 ? c.label.trim() : c.name
        , searchColumn: c
      };


      _column.formatter = /link\[".*"\]/i.test(_column.label) ? FORMATTERS.link : undefined;
      _column.tester = /link\[".*"\]/i.test(_column.label) ? function(label) { return TESTERS.link(label, _column.label); } : undefined;
      _column.type = /link\[".*"\]/i.test(_column.label) ? uiServerWidgetModule.FieldType.TEXT : uiServerWidgetModule.FieldType.TEXT;
      _column.isId = /internalid/i.test(_column.label);
      return _column;
    });

    _formatters = _columns.filter(function(c) { return typeof c.formatter === 'function'; });
    _result.columns = _columns.filter(function(c) { return typeof c.formatter !== 'function' && !c.isId; });

    _search.run().each(function (r) {
      _data = {
        internalid: ''
      };
      _columns.forEach(function(c){
        if(c.isId){
          _data.internalid = r.getValue(c.searchColumn);
        } else {
          _data[c.id] = getTextOrValue(r, c.searchColumn);
        }
      });
      _result.columns.forEach(function(c){
        _formatter = _formatters.filter(function(f){
          return f.tester(c.label);
        })[0];
        if(_formatter){
          _data[c.id] = _formatter.formatter(_data[c.id], _data[_formatter.id]);
        } else {
          if(!isNaN(parseFloat(_data[c.id]))) {
            c.type = uiServerWidgetModule.FieldType.FLOAT;
            if(!_totals[c.id]) {
              _totals[c.id] = 0;
            }
            _totals[c.id] += parseFloat(_data[c.id]);
          }
        }
      });
      _result.data.push(_data);
      return true;
    });

    _result.totals = _totals;
    return _result;
  }

  function render(result){

    var
      _list = uiServerWidgetModule.createList({ title : result.title ? result.title : 'Here comes title override' })
    ;

    result.columns.forEach(function(c) {
      var _column = _list.addColumn({
        id : c.id
        , type : c.type
        , label : c.label
      })
      if(/^name$/i.test(c.label)){
        _column.setURL({
          url: urlModule.resolveRecord({ recordType: result.type })
        }).addParamToURL({
          param: 'id'
          , value: 'internalid'
          , dynamic: true
        })
      }
      if(typeof result.totals[c.id] === 'undefined'){
        result.totals[c.id] = '';
      } else if(util.isNumber(result.totals[c.id])) {
        result.totals[c.id] = formatModule.format({value: result.totals[c.id], type: formatModule.Type.CURRENCY});
      }
    });

    result.totals[result.columns[0].id] = 'Total';

    for(var k in result.totals){
      if(result.totals.hasOwnProperty(k)){
        result.totals[k] = ['<b>', result.totals[k], '</b>'].join('');
      }
    }

    log.debug('totals', result.totals);
    //result.data.push(result.totals);

    _list.addRows({ rows: result.data});
    _list.addRow({row: result.totals});

    return _list;
  }


  function onRequest(context) {
    var
      _result = runSearch()
    ;
    context.response.writePage({
      pageObject: render(_result)
    })
  }


  return {
    onRequest: onRequest
  }

});
