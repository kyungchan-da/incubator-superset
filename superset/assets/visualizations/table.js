import d3 from 'd3';
import 'datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css';
import 'datatables.net';
import dt from 'datatables.net-bs';

import { fixDataTableBodyHeight } from '../javascripts/modules/utils';
import { timeFormatFactory, formatDate } from '../javascripts/modules/dates';
import './table.css';
import './table.scss';

import $ from 'jquery';

dt(window, $);

function tableVis(slice, payload) {
  const container = $(slice.selector);
  const fC = d3.format('0,000');
  let timestampFormatter;

  const data = payload.data;
  const fd = slice.formData;
  const styling = fd.styling ? fd.styling : null;
  const columnConfiguration = fd.column_configuration ? fd.column_configuration : {};
  const formatting = {};
  const coloringOptions = {};
  let metric;
  let mode;
  for (metric in columnConfiguration) {
    for (mode in columnConfiguration[metric]) {
      const columnName = mode === 'Normal' ? metric : mode + ' ' +metric;
      if (columnConfiguration[metric][mode].coloringOption) {
        coloringOptions[columnName] = columnConfiguration[metric][mode].coloringOption;
      }
      if (columnConfiguration[metric][mode].formatting) {
        formatting[columnName] = columnConfiguration[metric][mode].formatting;
      }
    }
  }

  // Removing metrics (aggregates) that are strings
  const tempMetrics = data.columns.map(m => m.toLowerCase()) || [];
  const metrics = tempMetrics.filter(m => !isNaN(data.records[0][m]));
  const percentageMetrics = tempMetrics.filter(m => /%/.test(m));

  function col(c) {
    const arr = [];
    for (let i = 0; i < data.records.length; i += 1) {
      arr.push(data.records[i][c]);
    }
    return arr;
  }
  const maxes = {};
  for (let i = 0; i < metrics.length; i += 1) {
    maxes[metrics[i]] = d3.max(col(metrics[i]));
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

  table.append('thead').append('tr')
    .selectAll('th')
    .data(data.columns)
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
      const val = row[c];
      let html = val;
      const isMetric = metrics.indexOf(c.toLowerCase()) >= 0;

      if (c === 'timestamp') {
        html = timestampFormatter(val);
      }
      if (typeof (val) === 'string') {
        html = `<span class="like-pre">${val}</span>`;
      }
      if (formatting[c]) {
        html = d3.format(formatting[c])(val);
      }
      return {
        col: c,
        val,
        html,
        isMetric,
        coloringOption: coloringOptions[c],
      };
    }))
    .enter()
    .append('td')
    .attr('class', function(d) {
      if (d.coloringOption !== null) {
        if (d.coloringOption === 'Green over 100%') {
          return d.val >= 1.0 ? 'pivot-table-hit' : 'pivot-table-not-hit';
        }
        else if (d.coloringOption === 'Red over 100%') {
          return d.val <= 1.0 ? 'pivot-table-hit' : 'pivot-table-not-hit';
        }
      }
      return null;
    })
    .style('background-color', function(d) {
      if (styling === null || !d.isMetric) {
        return null;
      }
      if (d.coloringOption !== null) {
        return null;
      }
      const perc = d.val / maxes[d.col] * 1.4;
      const colorIndex = metrics.indexOf(d.col);
      if (colorIndex >= 0 && styling.length > colorIndex) {
        return 'rgba(' + styling[colorIndex] + ', ' + perc + ')';
      }
      return 'lightgrey';
    })
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
  const height = slice.height();
  let paging = false;
  let pageLength;
  if (fd.page_length && fd.page_length > 0) {
    paging = true;
    pageLength = parseInt(fd.page_length, 10);
  }
  const datatable = container.find('.dataTable').DataTable({
    paging,
    pageLength,
    aaSorting: [],
    searching: fd.include_search,
    bInfo: false,
    scrollY: height + 'px',
    scrollCollapse: true,
    scrollX: true,
  });
  fixDataTableBodyHeight(container.find('.dataTables_wrapper'), height);
  // Sorting table by main column
  if (metrics.length > 0) {
    const mainMetric = metrics[0];
    datatable.column(data.columns.indexOf(mainMetric)).order('desc').draw();
  }
  container.parents('.widget').find('.tooltip').remove();
}

module.exports = tableVis;
