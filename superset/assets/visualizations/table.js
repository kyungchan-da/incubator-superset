import d3 from 'd3';
import 'datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css';
import 'datatables.net';
import dt from 'datatables.net-bs';

import {
  fixDataTableBodyHeight
}
  from '../javascripts/modules/utils';
import {
  timeFormatFactory, formatDate
}
  from '../javascripts/modules/dates';
import './table.css';
import './table.scss';

import $ from 'jquery';

dt(window, $);

var imported = document.createElement('script');
imported.src = "/static/assets/vendor/javascripts/dataTables.colResize.js";
document.head.appendChild(imported);

function tableVis(slice, payload) {
  const container = $(slice.selector);
  const fC = d3.format('0,000');
  let timestampFormatter;
  const data = payload.data;
  const fd = slice.formData;
  let styling = fd.styling ? fd.styling : null;
  // For the color saved in the database, change the value structure
  if (styling !== null) {
    for (let metricForStyling in styling) {
      if (typeof(styling[metricForStyling]) == "string") {
        let savedColorString = styling[metricForStyling];
        let savedColorArray = savedColorString.split(",");
        let savedColorObject = {rgb: {r: savedColorArray[0], g: savedColorArray[1], b: savedColorArray[2]}};
        styling[metricForStyling] = {};
        styling[metricForStyling]['active'] = 'Represent with color bar length';
        styling[metricForStyling]['Represent with color bar length'] = {};
        styling[metricForStyling]['Represent with color bar length']['color'] = savedColorObject;
        styling[metricForStyling]['exclude_rows_from_progress_bar'] = [];
      }
    }
  }
  const columnConfiguration = fd.column_configuration ? fd.column_configuration : {};
  const rowConfiguration = fd.row_configuration ? fd.row_configuration : {};
  const formatting = {};
  const comparisionOptions = {};
  const basements = {};
  const coloringOptions = {};
  const bcColoringOptions = {};
  const fontOptions = {};
  const textAligns = {};
  let metric;
  let mode;
  const colorings = ['seagreen', 'lightpink', 'lightblue', 'beige',
    'lightgray'
  ];
  const colorStyles = ['background-lightseagreen', 'background-lightpink',
    'background-lightblue', 'background-beige', 'background-lightgray'
  ];
  const fontWeights = ['bold', 'normal'];
  const fontWeightStyles = ['bold', 'normal'];
  // variables for row configuration
  var rowContains = [];
  var rowColor = '';
  var rowFont = '';
  for (metric in columnConfiguration) {
    for (mode in columnConfiguration[metric]) {
      const columnName = mode === 'Normal' ? metric : mode + ' ' +
        metric;
      if (columnConfiguration[metric][mode].comparisionOption) {
        comparisionOptions[columnName] = columnConfiguration[metric]
        [mode].comparisionOption;
      }
      if (columnConfiguration[metric][mode].basement) {
        basements[columnName] = columnConfiguration[metric][mode]
          .basement;
      }
      if (columnConfiguration[metric][mode].coloringOption) {
        coloringOptions[columnName] = columnConfiguration[metric][
          mode
        ].coloringOption;
      }
      if (columnConfiguration[metric][mode].bcColoringOption) {
        bcColoringOptions[columnName] = columnConfiguration[metric]
        [mode].bcColoringOption;
      }
      if (columnConfiguration[metric][mode].formatting) {
        formatting[columnName] = columnConfiguration[metric][mode]
          .formatting;
      }
      if (columnConfiguration[metric][mode].fontOption) {
        fontOptions[columnName] = columnConfiguration[metric][mode]
          .fontOption;
      }
      if (columnConfiguration[metric][mode].textAlign) {
        textAligns[columnName] = columnConfiguration[metric][mode]
          .textAlign;
      }
    }
  }
  if (rowConfiguration.coloringOption) {
    rowColor = colorStyles[colorings.indexOf(
      rowConfiguration.coloringOption)];
  }
  if (rowConfiguration.fontOption) {
    rowFont = fontWeightStyles[fontWeights.indexOf(
      rowConfiguration.fontOption)];
  }
  if (rowConfiguration.basements) {
    rowContains = rowConfiguration.basements;
  }
  // Removing metrics (aggregates) that are strings
  const metrics = data.columns.filter(m => !isNaN(data.records[0][m]));
  var arrForMax = {};
  for (var i in metrics) {
    arrForMax[metrics[i]] = [];
  }
  if (fd.table_timestamp_format === 'smart_date') {
    timestampFormatter = formatDate;
  } else if (fd.table_timestamp_format !== undefined) {
    timestampFormatter = timeFormatFactory(fd.table_timestamp_format);
  }

  const div = d3.select(slice.selector);
  div.html('');
  const table = div.append('table')
    .classed(
    'dataframe dataframe table table-striped table-bordered ' +
    'table-condensed table-hover dataTable no-footer', true)
    .attr('width', '100%');

  const cols = data.columns.map(c => slice.datasource.verbose_map[c] || c);

  table.append('thead').append('tr')
    .selectAll('th')
    .data(cols)
    .enter()
    .append('th')
    .text(function (d) {
      return d;
    });
  table.append('tbody')
    .selectAll('tr')
    .data(data.records)
    .enter()
    .append('tr')
    .selectAll('td')
    .data(row => data.columns.map((c) => {
      var val = row[c];
      let html = val;
      const isMetric = metrics.indexOf(c) >= 0;
      if (c === 'timestamp') {
        html = timestampFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${val}</span>`;
      }
      if (formatting[c]) {
        if (val.toString().length > 0) {
          html = d3.format(formatting[c])(val);
        }
      }
      return {
        col: c,
        val,
        html,
        isMetric,
        comparisionOption: comparisionOptions[c],
        basement: basements[c],
        coloringOption: coloringOptions[c],
        bcColoringOption: bcColoringOptions[c],
        fontOption: fontOptions[c],
        textAlign: textAligns[c],
      };
    }))
    .enter()
    .append('td')
    .attr('class', function (d) {
      var base = $.trim(d.basement)
      var coloringOptionClass = ''
      var bcColoringOptionClass = ''
      var fontOptionClass = ''
      if (d.coloringOption !== null) {
        if (d.coloringOption === 'seagreen') {
          coloringOptionClass = 'background-lightseagreen'
        } else if (d.coloringOption === 'lightpink') {
          coloringOptionClass = 'background-lightpink'
        } else if (d.coloringOption === 'lightblue') {
          coloringOptionClass = 'background-lightblue'
        } else if (d.coloringOption === 'beige') {
          coloringOptionClass = 'background-beige'
        } else if (d.coloringOption === 'lightgray') {
          coloringOptionClass = 'background-lightgray'
        }
      }
      if (d.bcColoringOption !== null) {
        if (d.bcColoringOption === 'seagreen') {
          bcColoringOptionClass = 'background-lightseagreen'
        } else if (d.bcColoringOption === 'lightpink') {
          bcColoringOptionClass = 'background-lightpink'
        } else if (d.bcColoringOption === 'lightblue') {
          bcColoringOptionClass = 'background-lightblue'
        } else if (d.bcColoringOption === 'beige') {
          bcColoringOptionClass = 'background-beige'
        } else if (d.bcColoringOption === 'lightgray') {
          bcColoringOptionClass = 'background-lightgray'
        }
      }
      if (d.fontOption !== null) {
        if (d.fontOption === 'bold') {
          fontOptionClass = 'bold'
        } else if (d.fontOption === 'normal') {
          fontOptionClass = 'normal'
        }
      }
      if (!isNaN(parseFloat(base))) {
        if (d.comparisionOption !== null) {
          if (d.comparisionOption === '<') {
            return d.val < base ? coloringOptionClass + ' ' +
              fontOptionClass : bcColoringOptionClass;
          } else if (d.comparisionOption === '=') {
            return d.val == base ? coloringOptionClass +
              ' ' + fontOptionClass :
              bcColoringOptionClass;
          } else if (d.comparisionOption === '>') {
            return d.val > base ? coloringOptionClass + ' ' +
              fontOptionClass : bcColoringOptionClass;
          }
        }
      }
      if (d.comparisionOption !== null) {
        if (d.comparisionOption === 'contains') {
          return (d.val.toString().indexOf(base) !== -1) ?
            coloringOptionClass + ' ' + fontOptionClass :
            bcColoringOptionClass;
        } else if (d.comparisionOption === 'startsWith') {
          return (d.val.toString().startsWith(base)) ?
            coloringOptionClass + ' ' + fontOptionClass :
            bcColoringOptionClass;
        } else if (d.comparisionOption === 'endsWith') {
          return (d.val.toString().endsWith(base)) ?
            coloringOptionClass + ' ' + fontOptionClass :
            bcColoringOptionClass;
        }
      }
      return null;
    })
    .classed('text-right', d=>$.isNumeric(d.val) && (d.textAlign=='right' || d.textAlign == undefined))
    .classed('text-left', d=>$.isNumeric(d.val) && d.textAlign=='left')
    .classed('text-center', d=>$.isNumeric(d.val) && d.textAlign=='center')
    .attr('title', (d) => {
      if (!isNaN(d.val)) {
        return fC(d.val);
      }
      return null;
    })
    .attr('data-sort', function (d) {
      return (d.isMetric) ? d.val : null;
    })
    .on('click', function (d) {
      if (!d.isMetric && fd.table_filter) {
        const td = d3.select(this);
        if (td.classed('filtered')) {
          slice.removeFilter(d.col, [d.val]);
          d3.select(this).classed('filtered', false);
        } else {
          d3.select(this).classed('filtered', true);
          slice.addFilter(d.col, [d.val]);
        }
      }
    })
    .style('cursor', function (d) {
      return (!d.isMetric) ? 'pointer' : '';
    })
    .html(d => d.html ? d.html : d.val);
  table.selectAll('tbody tr').each(function () {
    var that = this;
    for (var i in rowContains) {
      for (var j in this.cells) {
        if (this.cells[j].innerText == rowContains[i]) {
          $(this).addClass(rowColor);
          $(this).addClass(rowFont);
        }
        continue;
      }
      continue;
    }
    $(this).find('td').each(function (index){
      var column = data.columns[index];
      if ($.inArray(column, metrics) !== -1) {
        var exclude = false;
        for (var i = 0; i < that.cells.length; i++) {
          if (styling[column] && ('exclude_rows_from_progress_bar' in styling[column]) &&
            ($.inArray(that.cells[i].innerText, styling[column]['exclude_rows_from_progress_bar']) !== -1)) {
            exclude = true;
          }
        }
        if (!exclude) {
          arrForMax[column].push(parseFloat(this.getAttribute('data-sort') || this.innerText));
        }
      }
    });
  });
  const maxes = {};
  const mins = {};
  for (let i = 0; i < metrics.length; i += 1) {
    maxes[metrics[i]] = d3.max(arrForMax[metrics[i]]);
    mins[metrics[i]] = d3.min(arrForMax[metrics[i]]);
  }
  const height = slice.height();
  let paging = false;
  let pageLength;
  if (fd.page_length && fd.page_length > 0) {
    paging = true;
    pageLength = parseInt(fd.page_length, 10);
  }
  const datatable = container.find('.dataTable').DataTable({
    "dom": 'Zlfrtip',
    "colResize": {
      "tableWidthFixed": true,
    },
    paging,
    pageLength,
    aaSorting: [],
    searching: fd.include_search,
    bInfo: false,
    scrollY: height + 'px',
    scrollCollapse: true,
    scrollX: true,
    stateSave: true,
    stateDuration: 0,
    slice: slice,
    sliceId: slice.formData.slice_id,
    stateSaveCallback: function(settings, data) {
      localStorage.setItem('datatable_slice_state_' +
                           settings.oInit.sliceId, JSON.stringify(data))
    },
    stateLoadCallback: function(settings) {
      if (('slice_state' in settings.oInit.slice.formData) &&
        (settings.oInit.slice.formData['slice_state']!==undefined)) {
          return JSON.parse(settings.oInit.slice.formData.slice_state);
        }
      else {
        return null;
      }
    },
    rowCallback: (row, rowData, index) => {
      $(row).find('td').each(function (index) {
        var column = data.columns[index];
        var maxKey = column;
        if ($.inArray(column, metrics) !== -1) {
          var exclude = false;
          for (var i = 0; i < row.cells.length; i++) {
            if (styling[column] && ('exclude_rows_from_progress_bar' in styling[column]) &&
                ($.inArray(row.cells[i].innerText, styling[column]['exclude_rows_from_progress_bar']) !== -1)) {
              exclude = true;
            }
          }
          if (!exclude) {
            var val = this.getAttribute('data-sort') || $(this).html();
            if (styling !== null && styling[column] && styling[column]['active']) {
              const progressbarChoice = styling[column]['active'];
              if (progressbarChoice == 'Represent with color bar length' && styling[column][progressbarChoice] &&
                    styling[column][progressbarChoice]['color']) {
                const perc = Math.round((val / maxes[maxKey]) * 100);
                const colorObject = styling[column][progressbarChoice]['color'];
                const colorString = colorObject.rgb.r + ', ' + colorObject.rgb.g + ', ' + colorObject.rgb.b;
                const progressBarLengthStyle = `linear-gradient(to right, rgba(` +
                  colorString + `, 0.7), rgba(` +
                  colorString + `, 0.4) ${perc}%,     ` +
                  `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`;
                $(this).css('background-image', progressBarLengthStyle);
              }
              else if (progressbarChoice == 'Represent with color scale' && styling[column][progressbarChoice]) {
                const min = mins[maxKey];
                const max = maxes[maxKey];
                var maxColorString = "255, 255, 255";
                var minColorString = "255, 255, 255";
                var midpoint = 0;
                if (styling[column][progressbarChoice]['maximumColor']) {
                  const maxColorObject = styling[column][progressbarChoice]['maximumColor'];
                  maxColorString = maxColorObject.rgb.r + ', ' + maxColorObject.rgb.g + ', ' + maxColorObject.rgb.b;
                }
                if (styling[column][progressbarChoice]['minimumColor']) {
                  const minColorObject = styling[column][progressbarChoice]['minimumColor'];
                  minColorString = minColorObject.rgb.r + ', ' + minColorObject.rgb.g + ', ' + minColorObject.rgb.b;
                }
                if (styling[column][progressbarChoice]['midPoint']) {
                  midpoint = (styling[column][progressbarChoice]['midPoint']) ? (
                    styling[column][progressbarChoice]['midPoint']) : '0';
                }
                var percForGradient = 0;
                var progressBarGradientStyle = '';
                val = parseFloat(val)
                if (val > midpoint) {
                  percForGradient = 1 - ((max - val) / (max - midpoint));
                  progressBarGradientStyle = `rgba(` + maxColorString +
                  `, ` + percForGradient + `)`;
                }
                else if (val < midpoint) {
                  percForGradient = 1 - ((val - min) / (midpoint - min));
                  progressBarGradientStyle = `rgba(` + minColorString +
                  `, ` + percForGradient + `)`;
                }
                else if (val == midpoint) {
                  percForGradient = 0;
                  progressBarGradientStyle = `rgba(` + minColorString +
                  `, ` + percForGradient + `)`;
                }
                $(this).css('background', progressBarGradientStyle);
              }
            }
          }
        }
      });
    },
  });

  fixDataTableBodyHeight(container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  // if (metrics.length > 0) {
  //   const mainMetric = metrics[0];
  //   datatable.column(data.columns.indexOf(mainMetric)).order('desc').draw();
  // }
  container.parents('.widget').find('.tooltip').remove();
}

module.exports = tableVis;
