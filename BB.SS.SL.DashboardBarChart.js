/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope public
 * @author Ashley Wallace
 * 
 */
define(['N/record', 'N/search', 'N/render', 'N/file'], 
function(record, search, renders, file) {

    var TEMPLATE_START = [
    '    <html>',
    '    <head>',
    '      <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>',
    '      <script type="text/javascript">',
    '        google.charts.load(\'current\', {\'packages\':\'bar\']});',
    '        google.charts.setOnLoadCallback(drawChart);', 
    '        function drawChart() {',
    '          var data = google.visualization.arrayToDataTable('  
    ].join('\n');
    var TEMPLATE_END = [
    '        );',
    '        var options = {',
    '        chart: {',
    '            title: \'Projects by Finance Type\',',
    '            subtitle: \'Cash, Loan, and TPO counts for 2018\',',
    '        }',
    '        };',
    '        var chart = new google.charts.Bar(document.getElementById(\'columnchart_material\'));',
    '        chart.draw(data, google.charts.Bar.convertOptions(options));',
    '    }',
    '    </script>',
    '    </head>',
    '    <body>',
    '    <div id="columnchart_material" style="width: 800px; height: 500px;"></div>',
    '    </body>',
    '    </html>', 
    ].join('\n');

	function onRequest(context) { 

        var dataSearch = search.load('customsearch_bb_project_count_by_fin_typ').run().getRange({
            start: 0,
            end: 1000
        }); //get search results

        var results = createDataObject(dataSearch); //turn search results into object
        var uniqueLabels = getLabels(dataSearch); //get the all the labels
        results = addDataNulls(results, uniqueLabels.xAxis, uniqueLabels.labels); //add 0 values not in search

        var dataArray = getDataArray(results, dataSearch[0].columns[1].label, uniqueLabels); //turn data object into arrays
        var html = getHTML(dataArray);

        context.response.write(html);
    }
    

    function getHTML(dataArray)
    {
        var html = TEMPLATE_START + dataArray + TEMPLATE_END;
        return html;
    }

    /**
     * Loads the template
     * @return {string} template contents
     */
    function getTemplate() {
        return file.load({
            id: TEMPLATE_FILE
        }).getContents();
    }

    function createDataObject(results)
    {
        var resultData = {};

        for(var i= 0; i < results.length; i++)
        {
            var label = results[i].getText(results[i].columns[0]);
            var timeAxisLabel = results[i].getValue(results[i].columns[1]);
            var data = results[i].getValue(results[i].columns[2]);

            if(!resultData[timeAxisLabel])
               resultData[timeAxisLabel] = {labels: {} };
                
            resultData[timeAxisLabel].labels[label] = data;

        }

        return resultData;    
    }




    function getLabels(results)
    {
        var uniqueLabels = {xAxis: {}, labels: {} };

        for(var i= 0; i < results.length; i++)
        {
            var label = results[i].getText(results[i].columns[0]);
            var timeAxisLabel = results[i].getValue(results[i].columns[1]);

            if(!uniqueLabels.xAxis[timeAxisLabel])
                uniqueLabels.xAxis[timeAxisLabel] = timeAxisLabel;

            if(!uniqueLabels.labels[label])
                uniqueLabels.labels[label] = label;
        }

        return uniqueLabels;
    }




    function addDataNulls(resultData, xAxis, labels)
    {
        for(axi in xAxis)
        {
            for(label in labels)
            {
                if(!resultData[axi].labels[label])
                    resultData[axi].labels[label] = 0;
            }
        }
            
        return resultData;

    }


    function getDataArray(resultData, labelName, uniqueLabels)
    {
        var dataArray = '[';
        dataArray += getHeaderLine(labelName, uniqueLabels);

        for(axi in uniqueLabels.xAxis)
        {
            var graphLine = '[';
            graphLine += '\'' + axi + '\'';

            for(label in uniqueLabels.labels)
                graphLine += ',' + resultData[axi].labels[label].toString();
            
            graphLine += ']';
            
            dataArray += ',' + graphLine;
        };

        dataArray += ']';
        return dataArray;
    }


    function getHeaderLine(labelName, uniqueLabels)
    {
        var headerLine = '[';
        headerLine += '\'' + labelName + '\'';

        for(label in uniqueLabels.labels)
            headerLine += ',' + '\'' + label + '\'';
    
        headerLine += ']';

        return headerLine;
    }


	
	return {
		onRequest: onRequest
	};

});