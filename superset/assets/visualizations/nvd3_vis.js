// JS
import $ from 'jquery';
import throttle from 'lodash.throttle';
import d3 from 'd3';

import { category21 } from '../javascripts/modules/colors';
import { timeFormatFactory, formatDate } from '../javascripts/modules/dates';
import { customizeToolTip } from '../javascripts/modules/utils';

import { TIME_STAMP_OPTIONS } from '../javascripts/explorev2/stores/controls';

const nv = require('nvd3');

// CSS
require('../node_modules/nvd3/build/nv.d3.min.css');
require('./nvd3_vis.css');

const timeStampFormats = TIME_STAMP_OPTIONS.map(opt => opt[0]);
const minBarWidth = 15;
const animationTime = 1000;

const BREAKPOINTS = {
  small: 340,
};

const addTotalBarValues = function (svg, chart, data, stacked, axisFormat) {
  svg.select('g.nv-barsWrap-value').remove();
  const format = d3.format(axisFormat || '.3s');
  const countSeriesDisplayed = data.length;

  let biggestI = -1;
  let offset = 0;
  // Find the largest available
  if (chart._options.showControls) {
    svg.selectAll('g.nv-series').filter(
      function (d, i) {
        if (chart.stacked() && i < countSeriesDisplayed) {
          if (d.disabled) {
            offset += 1;
            return null;
          }
          if (i > biggestI) {
            biggestI = i - offset;
          }
        }
        return null;
      });
  } else {
    svg.selectAll('g.nv-series').filter(
      function (d, i) {
        if (stacked) {
          if (d.disabled) {
            offset += 1;
            return null;
          }
          if (i > biggestI) {
            biggestI = i - offset;
          }
        }
        return null;
      });
  }

  if (biggestI === -1) biggestI = countSeriesDisplayed - 1;

  const rectsToBeLabeled = svg.selectAll('g.nv-group').filter(
    function (d, i) {
      return !chart.stacked() || (chart.stacked() && i === biggestI);
    }).selectAll('rect');

  const groupLabels = svg.select('g.nv-barsWrap').append('g')
    .attr('class', 'nv-barsWrap-value');

  rectsToBeLabeled.each(
    function (d, index) {
      const rectObj = d3.select(this);
      const transformAttr = rectObj.attr('transform');
      const yPos = parseFloat(rectObj.attr('y'));
      const xPos = parseFloat(rectObj.attr('x'));
      const rectWidth = parseFloat(rectObj.attr('width'));
      const t = groupLabels.append('text')
        .attr('x', xPos) // rough position first, fine tune later
        .attr('y', yPos - 5)
        .text(format(stacked ? d.y1 : d.y))
        .attr('transform', transformAttr)
        .attr('class', 'bar-chart-label')
        .attr('font-size', '10');
      const labelWidth = t.node().getBBox().width;
      t.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
    });
};

const showEachBarValue = function (svg, chart, data, stacked, axisFormat, min) {
  svg.select('g.nv-barsWrap-value-on-bar').remove();
  const format = d3.format(axisFormat || '.3s');
  const countSeriesDisplayed = data.length;
  const rectsToBeLabeled = svg.selectAll('g.nv-group').selectAll('rect');
  const groupLabels = svg.select('g.nv-barsWrap').append('g')
    .attr('class', 'nv-barsWrap-value-on-bar');
  rectsToBeLabeled.each(
    function (d, index) {
      const rectObj = d3.select(this);
      const transformAttr = rectObj.attr('transform');
      const yPos = parseFloat(rectObj.attr('y'));
      const xPos = parseFloat(rectObj.attr('x'));
      const rectWidth = parseFloat(rectObj.attr('width'));
      const rectHeight = parseFloat(rectObj.attr('height'));
      const t = groupLabels.append('text')
        .attr('x', xPos) // rough position first, fine tune later
        .attr('y', yPos + 15)
        .text((min !== '' && d.y < parseFloat(min)) ? null : format(d.y))
        .attr('transform', transformAttr)
        .attr('class', 'bar-chart-label')
        .attr('font-size', '13');
      const labelWidth = t.node().getBBox().width;
      const labelHeight = t.node().getBBox().height;
      t.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      t.attr('y', yPos + rectHeight / 2 - labelHeight / 2 + 10); //fine tune
    });
};

function hideTooltips() {
  $('.nvtooltip').css({ opacity: 0 });
}

function getMaxLabelSize(container, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const labelEls = container.find(`.${axisClass} text`).not('.nv-axislabel');
  const labelDimensions = labelEls.map(i => labelEls[i].getComputedTextLength());
  return Math.max(...labelDimensions);
}

function formatLabel(column, verbose_map) {
  let label;
  if (Array.isArray(column) && column.length) {
    label = verbose_map[column[0]] || column[0];
    if (column.length > 1) {
      label += ', ';
    }
    label += column.slice(1).join(', ');
  } else {
    label = verbose_map[column] || column;
  }
  return label;
}

function nvd3Vis(slice, payload) {
  let chart;
  let colorKey = 'key';
  const isExplore = $('#explore-container').length === 1;

  let startTime = payload.query_obj['from_dttm'];
  let endTime = payload.query_obj['to_dttm'];

  let data;
  if (payload.data) {
    data = payload.data.map(x => ({
      ...x, key: formatLabel(x.key, slice.datasource.verbose_map),
    }));
  } else {
    data = [];
  }
  slice.container.html('');
  slice.clearError();

  // Calculates the longest label size for stretching bottom margin
  function calculateStretchMargins(payloadData) {
    let stretchMargin = 0;
    const pixelsPerCharX = 4.5; // approx, depends on font size
    let maxLabelSize = 10; // accommodate for shorter labels
    payloadData.data.forEach((d) => {
      const axisLabels = d.values;
      for (let i = 0; i < axisLabels.length; i++) {
        maxLabelSize = Math.max(axisLabels[i].x.toString().length, maxLabelSize);
      }
    });
    stretchMargin = Math.ceil(pixelsPerCharX * maxLabelSize);
    return stretchMargin;
  }

  function customYearlyTickFunc (t0, t1, step) {
    var startTime = new Date(t0),
        endTime= new Date(t1), times = [];
    endTime.setUTCFullYear(endTime.getUTCFullYear());
    startTime.setUTCFullYear(startTime.getUTCFullYear());
    while (startTime <= endTime) {
      times.push(new Date(startTime));
      startTime.setUTCFullYear(startTime.getUTCFullYear() + 1);
    }
    return times;
  }

  function customMonthlyTickFunc (t0, t1, step) {
    var startTime = new Date(t0),
        endTime= new Date(t1), times = [];
    endTime.setUTCMonth(endTime.getUTCMonth());
    startTime.setUTCMonth(startTime.getUTCMonth());
    while (startTime <= endTime) {
      times.push(new Date(startTime));
      startTime.setUTCMonth(startTime.getUTCMonth() + 1);
    }
    return times;
  }

  function customWeeklyTickFunc (t0, t1, step) {
    var startTime = new Date(t0),
        endTime= new Date(t1), times = [];
    endTime.setUTCDate(endTime.getUTCDate());
    startTime.setUTCDate(startTime.getUTCDate());
    while (startTime <= endTime) {
      times.push(new Date(startTime));
      startTime.setUTCDate(startTime.getUTCDate() + 7);
    }
    return times;
  }

  function customDailyTickFunc (t0, t1, step) {
    var startTime = new Date(t0),
        endTime= new Date(t1), times = [];
    endTime.setUTCDate(endTime.getUTCDate());
    startTime.setUTCDate(startTime.getUTCDate());
    while (startTime <= endTime) {
      times.push(new Date(startTime));
      startTime.setUTCDate(startTime.getUTCDate() + 1);
    }
    return times;
  }

  const customTickFuncDict = {"customYearlyTickFunc": customYearlyTickFunc,
                              "customMonthlyTickFunc": customMonthlyTickFunc,
                              "customWeeklyTickFunc": customWeeklyTickFunc,
                              "customDailyTickFunc": customDailyTickFunc};

  let width = slice.width();
  const fd = slice.formData;

  const barchartWidth = function () {
    let bars;
    if (fd.bar_stacked) {
      bars = d3.max(data, function (d) { return d.values.length; });
    } else {
      bars = d3.sum(data, function (d) { return d.values.length; });
    }
    if (bars * minBarWidth > width) {
      return bars * minBarWidth;
    }
    return width;
  };

  const vizType = fd.viz_type;
  const f = d3.format('.3s');
  const reduceXTicks = fd.reduce_x_ticks || false;
  let stacked = false;
  let row;

  const drawGraph = function () {
    let svg = d3.select(slice.selector).select('svg');
    if (svg.empty()) {
      svg = d3.select(slice.selector).append('svg');
    }
    switch (vizType) {
      case 'line':
        if (fd.show_brush) {
          chart = nv.models.lineWithFocusChart();
          chart.focus.xScale(d3.time.scale.utc());
          chart.x2Axis
          .showMaxMin(fd.x_axis_showminmax)
          .staggerLabels(false);
        } else {
          chart = nv.models.lineChart();
        }
        // To alter the tooltip header
        // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
        chart.xScale(d3.time.scale.utc().clamp(true));
        chart.interpolate(fd.line_interpolation);
        chart.xAxis
        .showMaxMin(fd.x_axis_showminmax)
        .staggerLabels(false);

        if (fd.x_axis_customize_tick_function &&
            fd.x_axis_customize_tick_function !== 'auto') {
          var customFunc = fd.x_axis_customize_tick_function;
          chart.xAxis.ticks(customTickFuncDict[customFunc]);
        }
        break;

      case 'simpleline':
        if (fd.show_brush) {
          chart = nv.models.lineWithFocusChart();
          // chart.focus.xScale(d3.time.scale.utc());
          chart.x2Axis
          .showMaxMin(fd.x_axis_showminmax)
          .staggerLabels(false);
        } else {
          chart = nv.models.lineChart();
        }
        // To alter the tooltip header
        chart.interpolate(fd.line_interpolation);
        chart.xAxis
        .showMaxMin(true)
        .staggerLabels(false);
        chart.forceX([50])
        break;

      case 'dual_line':
        chart = nv.models.multiChart();
        chart.interpolate('linear');
        break;

      case 'bar':
        chart = nv.models.multiBarChart()
        .reduceXTicks(false)
        .rotateLabels(45)
        .showControls(fd.show_controls)
        .groupSpacing(0.1);

        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        chart.xAxis
        .showMaxMin(false)
        .staggerLabels(true);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);

        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }

        if (fd.show_bar_value_on_the_bar) {
          setTimeout(function () {
            showEachBarValue(svg, chart, data, stacked, fd.y_axis_format, fd.hide_value_below);
          }, animationTime);
        }

        break;

      case 'dist_bar':
        chart = nv.models.multiBarChart()
        .showControls(fd.show_controls)
        .reduceXTicks(reduceXTicks)
        .rotateLabels(45)
        .groupSpacing(0.1); // Distance between each group of bars.

        chart.xAxis
        .showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);

        if (fd.order_x_bars === 0) {
          // do nothing
        } else if (fd.order_x_bars === 1) {
          payload.data.forEach((d) => {
            d.values.sort(
              function compare(a, b) {
                if (a.x < b.x) return -1;
                if (a.x > b.x) return 1;
                return 0;
              },
            );
          });
        } else if (fd.order_x_bars === 2) {
          payload.data.forEach((d) => {
            d.values.sort(
              function compare(a, b) {
                if (a.x < b.x) return 1;
                if (a.x > b.x) return -1;
                return 0;
              },
            );
          });
        }
        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        if (fd.show_bar_value_on_the_bar) {
          setTimeout(function () {
            showEachBarValue(svg, chart, data, stacked, fd.y_axis_format, fd.hide_value_below);
          }, animationTime);
        }
        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        break;

      case 'pie':
        chart = nv.models.pieChart();
        colorKey = 'x';
        chart.valueFormat(f);
        if (fd.donut) {
          chart.donut(true);
        }
        chart.labelsOutside(fd.labels_outside);
        chart.labelThreshold(0.05)  // Configure the minimum slice size for labels to show up
          .labelType(fd.pie_label_type);
        chart.cornerRadius(true);

        if (fd.pie_label_type === 'percent') {
          let total = 0;
          data.forEach((d) => { total += d.y; });
          chart.tooltip.valueFormatter(d => `${((d / total) * 100).toFixed()}%`);
        }

        break;

      case 'column':
        chart = nv.models.multiBarChart()
        .reduceXTicks(false)
        .rotateLabels(45);
        break;

      case 'compare':
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.xAxis
        .showMaxMin(false)
        .staggerLabels(true);
        break;

      case 'bubble':
        row = (col1, col2) => `<tr><td>${col1}</td><td>${col2}</td></tr>`;
        chart = nv.models.scatterChart();
        chart.showDistX(true);
        chart.showDistY(true);
        chart.tooltip.contentGenerator(function (obj) {
          const p = obj.point;
          let s = '<table>';
          s += (
            `<tr><td style="color: ${p.color};">` +
              `<strong>${p[fd.entity]}</strong> (${p.group})` +
            '</td></tr>');
          s += row((slice.datasource.verbose_map[fd.x] || fd.x), f(p.x));
          s += row((slice.datasource.verbose_map[fd.y] || fd.y), f(p.y));
          s += row(fd.size, f(p.size));
          s += '</table>';
          return s;
        });
        chart.pointRange([5, fd.max_bubble_size * fd.max_bubble_size]);
        break;

      case 'area':
        chart = nv.models.stackedAreaChart();
        chart.showControls(fd.show_controls);
        chart.style(fd.stacked_style);
        chart.xScale(d3.time.scale.utc());
        chart.xAxis
        .showMaxMin(fd.x_axis_showminmax)
        .staggerLabels(true);
        break;

      case 'box_plot':
        colorKey = 'label';
        chart = nv.models.boxPlotChart();
        chart.x(function (d) {
          return d.label;
        });
        chart.staggerLabels(true);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        break;

      case 'bullet':
        chart = nv.models.bulletChart();
        break;

      default:
        throw new Error('Unrecognized visualization for nvd3' + vizType);
    }

    if ('showLegend' in chart && typeof fd.show_legend !== 'undefined') {
      if (width < BREAKPOINTS.small && vizType !== 'pie') {
        chart.showLegend(false);
      } else {
        chart.showLegend(fd.show_legend);
      }
    }

    let height = slice.height() - 15;
    if (vizType === 'bullet') {
      height = Math.min(height, 50);
    }

    chart.height(height);
    slice.container.css('height', height + 'px');

    if ((vizType === 'line' || vizType === 'area') && fd.rich_tooltip) {
      chart.useInteractiveGuideline(true);
    }
    if (fd.y_axis_zero) {
      chart.forceY([0]);
    } else if (fd.y_log_scale) {
      chart.yScale(d3.scale.log());
    }
    if (vizType === 'line') {
      chart.pointActive(function (d) {
        return d.y !== null;
      });
      chart.defined(function (d) {
        return d.y !== null;
      });
    }
    if (fd.y_range_min || fd.y_range_max) {
      let min = d3.min(data, function(c) {
        return d3.min(c.values, function(d){
            return d.y;
        })
      });
      let max = d3.max(data, function(c) {
        return d3.max(c.values, function(d){
            return d.y;
        })
      });
      if (fd.y_range_min) {
        min = fd.y_range_min;
      }
      if (fd.y_range_max) {
        max = fd.y_range_max;
      }
      chart.pointActive(function (d) {
        return d.y !== null && d.y >= min && d.y <= max;
      });
      chart.defined(function (d) {
        return d.y !== null && d.y >= min && d.y <= max;
      });
      chart.yDomain([min, max]);
    }

    if (fd.x_axis_domain_type && fd.x_axis_domain_type !== 'auto') {
      chart.xDomain([new Date(startTime), new Date(endTime)]);
    }

    if (fd.x_log_scale) {
      chart.xScale(d3.scale.log());
    }
    let xAxisFormatter;
    if (vizType === 'bubble' || vizType === 'simpleline') {
      xAxisFormatter = d3.format('.3s');
      chart.xAxis.tickFormat(xAxisFormatter);
    } else if (fd.x_axis_format === 'smart_date') {
      xAxisFormatter = formatDate;
      chart.xAxis.tickFormat(xAxisFormatter);
    } else if (fd.x_axis_format !== undefined) {
      xAxisFormatter = timeFormatFactory(fd.x_axis_format);
      chart.xAxis.tickFormat(xAxisFormatter);
    }

    const isTimeSeries = timeStampFormats.indexOf(fd.x_axis_format) > -1;
    // if x axis format is a date format, rotate label 90 degrees
    if (isTimeSeries) {
      chart.xAxis.rotateLabels(45);
    }

    if (fd.rotate_x_lable && fd.rotate_x_lable !== 0) {
      chart.xAxis.rotateLabels(fd.rotate_x_lable);
    }

    if (chart.hasOwnProperty('x2Axis')) {
      chart.x2Axis.tickFormat(xAxisFormatter);
      height += 30;
    }

    if (vizType === 'bubble' || vizType === 'simpleline') {
      xAxisFormatter = d3.format('.3s');
      chart.xAxis.tickFormat(xAxisFormatter);
    } else if (fd.x_axis_format === 'smart_date') {
      xAxisFormatter = formatDate;
      chart.xAxis.tickFormat(xAxisFormatter);
    } else if (fd.x_axis_format !== undefined) {
      xAxisFormatter = timeFormatFactory(fd.x_axis_format);
      chart.xAxis.tickFormat(xAxisFormatter);
    }
    if (chart.yAxis !== undefined) {
      chart.yAxis.tickFormat(d3.format('.3s'));
    }

    if (fd.y_axis_format && chart.yAxis) {
      chart.yAxis.tickFormat(d3.format(fd.y_axis_format));
      if (chart.y2Axis !== undefined) {
        chart.y2Axis.tickFormat(d3.format(fd.y_axis_format));
      }
    }
    if (vizType !== 'bullet') {
      chart.color(d => category21(d[colorKey]));
    }

    if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
      let distance = 0;
      if (fd.bottom_margin && !isNaN(fd.bottom_margin)) {
        distance = fd.bottom_margin - 50;
      }
      chart.xAxis.axisLabel(fd.x_axis_label).axisLabelDistance(distance);
    }

    if (fd.y_axis_label && fd.y_axis_label !== '' && chart.yAxis) {
      chart.yAxis.axisLabel(fd.y_axis_label);
      chart.margin({ left: 90 });
    }

    if (fd.bottom_margin === 'auto') {
      if (vizType === 'dist_bar') {
        const stretchMargin = calculateStretchMargins(payload);
        chart.margin({ bottom: stretchMargin });
      } else {
        chart.margin({ bottom: 50 });
      }
    } else {
      chart.margin({ bottom: fd.bottom_margin });
    }

    if (vizType === 'dual_line') {
      const yAxisFormatter1 = d3.format(fd.y_axis_format);
      const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
      chart.yAxis1.tickFormat(yAxisFormatter1);
      chart.yAxis2.tickFormat(yAxisFormatter2);
      customizeToolTip(chart, xAxisFormatter, [yAxisFormatter1, yAxisFormatter2]);
      chart.showLegend(width > BREAKPOINTS.small);
    }


    if (fd.x_axis_class_range) {
      const lowerBoundary = fd.x_axis_lower_bound || null;
      const xValues = data[0].values.map((value) => value.x);
      if (xValues.reduce((acc, value) => isNaN(value) && isNaN(Date.parse(value)) ? acc + 1 : 0) === 0) {
        let xLabels = [];
        for (let i = 0; i < xValues.length; i++) {
          xLabels.push(xValues[i]);
        }
        if (xValues.length > 1) {
          let predictFirstValue = '';
          if (lowerBoundary) {
            predictFirstValue = lowerBoundary;
          }
          else if (!isNaN(xValues[0])) {
            predictFirstValue = xValues[0] - (xValues[1] - xValues[0]);
          }
          else if (!isNaN(Date.parse(xValues[0]))) {
            const date1 = new Date(xValues[0]);
            const date2 = new Date(xValues[1]);
            predictFirstValue = new Date(date1.getTime() - (date2.getTime() - date1.getTime())).toISOString().slice(0, 10);
          }
          xLabels.unshift(predictFirstValue);
        }
        else if (lowerBoundary) {
          xLabels.unshift(lowerBoundary);
        }
        else {
          xLabels = xValues;
        }
        chart.xAxis.tickFormat(function(d, i) {
          return xAxisFormatter ?
              (xAxisFormatter(xLabels[i]) + ' - ' + xAxisFormatter(xLabels[i] + 1)) :
              (xLabels[i] + '-' + xLabels[i + 1]);
        });
      }
    }

    svg
    .datum(data)
    .transition().duration(500)
    .attr('height', height)
    .attr('width', width)
    .call(chart);

    if (fd.show_markers) {
      svg.selectAll('.nv-point')
      .style('stroke-opacity', 1)
      .style('fill-opacity', 1);
    }

    let firstUpdate = true;

    try {
      chart.dispatch.on('renderEnd', () => {
        svg.select('.nv-scatterWrap').attr('clip-path', null);
        svg.select('.nv-line > g').attr('clip-path', null);
        if (typeof fd.show_point_value !== "undefined" && fd.show_point_value) {
          svg.selectAll('.nv-point-label').remove();
          svg.selectAll('path.nv-point').each(function (d, i) {
            d3.select(this.parentNode).append('text')
                .classed('nv-point-label nv-point-label-' + i, true)
                .attr('dy', '-.35em')
                .attr('transform', d3.select(this).attr('transform'))
                .attr('dx', '.2em')
                .attr('font-size', '10')
                .text(d3.format(fd.y_axis_format || '.1s')(d[0].y))
                .style({stroke: 'initial'});
          });
        }
        if (typeof fd.show_bar_value !== "undefined" && fd.show_bar_value) {
          const offsetTop = chart.legend._options.height
                            + chart.legend._options.margin.top + 10;
          chart.margin({ top: offsetTop });
          svg.select('g.nv-barsWrap-value').remove();
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
          if (firstUpdate) {
            chart.update();
            firstUpdate = false;
          }
        }
        if (typeof fd.show_bar_value_on_the_bar !== "undefined" && fd.show_bar_value_on_the_bar) {
          svg.select('g.nv-barsWrap-value-on-bar').remove();
          setTimeout(function () {
            showEachBarValue(svg, chart, data, stacked, fd.y_axis_format, fd.hide_value_below);
          }, animationTime);
        }
      });
    } catch (err) {
      // pass
    }
    try {
      chart.dispatch.on('stateChange', () => {
        svg.select('.nv-scatterWrap').attr('clip-path', null);
        svg.select('.nv-line > g').attr('clip-path', null);
        if (typeof fd.show_point_value !== "undefined" && fd.show_point_value) {
          svg.selectAll('.nv-point-label').remove();
          svg.selectAll('path.nv-point').each(function (d, i) {
            d3.select(this.parentNode).append('text')
                .classed('nv-point-label nv-point-label-' + i, true)
                .attr('dy', '-.35em')
                .attr('transform', d3.select(this).attr('transform'))
                .attr('dx', '.2em')
                .attr('font-size', '10')
                .text(d3.format(fd.y_axis_format || '.1s')(d[0].y))
                .style({ stroke: 'initial' });
          });
        }
        if (typeof fd.show_bar_value !== "undefined" && fd.show_bar_value) {
          const offsetTop = chart.legend._options.height
                            + chart.legend._options.margin.top + 10;
          chart.margin({ top: offsetTop });
          svg.select('g.nv-barsWrap-value').remove();
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        if (typeof fd.show_bar_value_on_the_bar !== "undefined" && fd.show_bar_value_on_the_bar) {
          svg.select('g.nv-barsWrap-value-on-bar').remove();
          setTimeout(function () {
            showEachBarValue(svg, chart, data, stacked, fd.y_axis_format, fd.hide_value_below);
          }, animationTime);
        }
      });
    } catch (err) {
      // pass
    }

    if (chart.yAxis !== undefined) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const marginPad = isExplore ? width * 0.01 : width * 0.03;
      const maxYAxisLabelWidth = getMaxLabelSize(slice.container, 'nv-y');
      const maxXAxisLabelHeight = getMaxLabelSize(slice.container, 'nv-x');
      chart.margin({ left: maxYAxisLabelWidth + marginPad });
      if (fd.y_axis_label && fd.y_axis_label !== '') {
        chart.margin({ left: maxYAxisLabelWidth + marginPad + 25 });
      }
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      if ((isTimeSeries || (fd.rotate_x_lable && fd.rotate_x_lable != 0))
        && vizType !== 'bar') {
        const chartMargins = {
          bottom: maxXAxisLabelHeight + marginPad,
          right: maxXAxisLabelHeight + marginPad,
        };

        if (vizType === 'dual_line') {
          const maxYAxis2LabelWidth = getMaxLabelSize(slice.container, 'nv-y2');
          // use y axis width if it's wider than axis width/height
          if (maxYAxis2LabelWidth > maxXAxisLabelHeight) {
            chartMargins.right = maxYAxis2LabelWidth + marginPad;
          }
        }

        // apply margins
        chart.margin(chartMargins);
      }
      if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
        chart.margin({ bottom: maxXAxisLabelHeight + marginPad + 25 });
      }

      // render chart
      svg
      .datum(data)
      .transition().duration(500)
      .attr('height', height)
      .attr('width', width)
      .call(chart);
    }

    // on scroll, hide tooltips. throttle to only 4x/second.
    $(window).scroll(throttle(hideTooltips, 250));

    return chart;
  };

  // hide tooltips before rendering chart, if the chart is being re-rendered sometimes
  // there are left over tooltips in the dom,
  // this will clear them before rendering the chart again.
  hideTooltips();

  nv.addGraph(drawGraph);
}

module.exports = nvd3Vis;
